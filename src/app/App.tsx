import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { CategoryTabs, VIEWS } from '../components/CategoryTabs';
import { CompactCard } from '../components/CompactCard';
import { DestinationForm } from '../components/DestinationForm';
import { FarmPanel } from '../components/FarmPanel';
import { PencilIcon, PlusIcon, SearchIcon } from '../components/icons';
import { DEFAULT_SETTINGS_SECTION, SettingsPanel, type SettingsSectionId } from '../components/SettingsPanel';
import { WindowHeader } from '../components/WindowHeader';
import {
  draftFromDestination,
  duplicateDraft,
  emptyDraft,
  type DestinationDraft,
} from '../features/catalog/editor';
import { CATEGORIES, type Category, type Destination } from '../features/catalog/schema';
import { filterDestinations, type ViewFilter } from '../features/catalog/search';
import { cardParts, partCommand, type ClickButton, type PartIndex } from '../features/commands/cardParts';
import { farmResumeCommand, farmStartCommand, parseFarmRoute } from '../features/farm/farmRoute';
import { describeUpdateState } from '../features/updates/types';
import { loadFavorites, saveFavorites } from '../lib/tauri/storage';
import { setMainBusy } from '../lib/tauri/window';
import { useAliases } from './useAliases';
import { useCatalog } from './useCatalog';
import { useCopyFeedback } from './useCopyFeedback';
import { useGridWindow } from './useGridWindow';
import { useSettings } from './useSettings';
import { useUpdater } from './useUpdater';

/** Un seul panneau ouvert à la fois. `key` remonte le formulaire à chaque ouverture. */
type PanelState =
  | null
  | { type: 'farm'; id: string }
  | { type: 'editor'; draft: DestinationDraft; key: number }
  | { type: 'settings'; section: SettingsSectionId };

const NOTHING_TO_COPY = 'Aucune commande à copier';
const FARM_KEY = 'farm:';

/** Le menu contextuel du navigateur n'a pas sa place dans l'app, sauf dans les champs de saisie. */
function blockContextMenu(e: MouseEvent) {
  if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault();
}

/** Types d'`<input>` sans saisie de texte (Paramètres) : Échap doit y fermer le panneau. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset']);

/** Vrai si la cible d'un évènement clavier est un champ de saisie de texte. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

const isCategory = (v: ViewFilter): v is Category => CATEGORIES.includes(v as Category);

/** État vide d'une vue : un titre, et une indication quand il y a quelque chose à faire. */
function emptyMessage(view: ViewFilter, query: string): { title: string; hint?: string } {
  if (query.trim()) return { title: `Aucun résultat pour « ${query.trim()} »`, hint: 'Échap pour effacer la recherche' };
  if (view === 'favorites') return { title: 'Aucun favori', hint: "Cliquez sur l'étoile d'une carte pour l'ajouter" };
  return { title: 'Aucune destination dans cette catégorie' };
}

export function App() {
  const { load, destinations, save, remove } = useCatalog();
  // Dictionnaire global d'alias de recherche : même moteur pour la grille et la palette.
  const { dictionary, binding: aliases } = useAliases();
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const [view, setView] = useState<ViewFilter>('all');
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<PanelState>(null);
  /** Mode gestion : un crayon sur chaque carte ouvre le formulaire (non persistant). */
  const [manageMode, setManageMode] = useState(false);
  /** Dernière position cliquée par parcours (session uniquement) ; -1 = début. */
  const [farmProgress, setFarmProgress] = useState<Record<string, number>>({});
  const { feedback, copy, notify } = useCopyFeedback();
  const { settings, loaded: settingsLoaded, update: updateSettings } = useSettings((message) => notify(message, 'warning'));
  const searchRef = useRef<HTMLInputElement>(null);
  const favoritesRef = useRef(favorites);
  const editorSeq = useRef(0);
  /** Destination à faire défiler jusqu'à l'écran dès qu'elle est rendue (après enregistrement). */
  const revealRef = useRef<string | null>(null);
  /** Incrémenté après un enregistrement : relance l'effet qui amène la carte à l'écran (la grille
   *  a pu être rendue avec la nouvelle destination avant que `revealRef` soit posé). */
  const [revealTick, setRevealTick] = useState(0);
  /** Dernière rubrique des paramètres consultée (session uniquement). */
  const settingsSectionRef = useRef<SettingsSectionId>(DEFAULT_SETTINGS_SECTION);

  const ready = load.status === 'ready';
  const editorOpen = panel?.type === 'editor';
  const settingsOpen = panel?.type === 'settings';
  /** Panneau plein écran (formulaire, paramètres) : la grille et la barre d'outils sont inertes. */
  const overlayOpen = editorOpen || settingsOpen;

  // Moteur de mise à jour au niveau de l'application : le mode automatique fonctionne panneau
  // fermé ; l'installation (qui ferme l'application) attend la fermeture du formulaire.
  const { binding: updater, state: updateState } = useUpdater({
    settings,
    settingsLoaded,
    updateSettings,
    installBlocked: editorOpen,
    notify,
  });
  // Indicateur discret dans la bulle d'état pendant un téléchargement ou une installation, hors
  // Paramètres (la rubrique affiche déjà l'état). Un message ponctuel (copie…) reste prioritaire.
  const updateBusy =
    updateState.status === 'downloading' || updateState.status === 'ready' || updateState.status === 'installing';
  const updateIndicator = updateBusy && !settingsOpen ? describeUpdateState(updateState, null) : null;

  // Formulaire ouvert : Rust ne détruit jamais la fenêtre (zone de notification), la saisie
  // en cours n'est jamais perdue.
  useEffect(() => {
    setMainBusy(editorOpen).catch((e: unknown) => console.error('État « occupé » non transmis', e));
  }, [editorOpen]);

  useEffect(() => {
    void loadFavorites().then((favs) => {
      favoritesRef.current = favs;
      setFavorites(favs);
    });
  }, []);

  // Raccourcis : Échap (retour / effacer / quitter le mode gestion), Ctrl+F (recherche),
  // frappe directe → recherche. Le formulaire gère son propre clavier : rien ici quand il est ouvert.
  // Paramètres : Échap ferme le panneau ; pendant la capture d'un raccourci, le champ arrête la
  // propagation de toutes les touches, donc Échap n'annule que la capture.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editorOpen) return;
      const search = searchRef.current;
      // Une saisie dans un champ (autre que la recherche) ne doit jamais être détournée.
      if (isEditableTarget(e.target) && e.target !== search) return;
      if (e.key === 'Escape') {
        if (panel !== null) setPanel(null);
        else if (query !== '') setQuery('');
        else setManageMode(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setPanel(null);
        const focusSearch = () => {
          search?.focus();
          search?.select();
        };
        // Sous les paramètres, la recherche est inerte : focus une fois le panneau retiré.
        if (settingsOpen) setTimeout(focusSearch, 0);
        else focusSearch();
        return;
      }
      const printable = e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (printable && panel === null && document.activeElement !== search) search?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [panel, editorOpen, settingsOpen, query]);

  const openEditor = useCallback((draft: DestinationDraft) => {
    editorSeq.current += 1;
    setPanel({ type: 'editor', draft, key: editorSeq.current });
  }, []);

  // Gestionnaires stables : nécessaires pour que la mémoïsation des cartes soit effective.
  // Clic gauche ou droit sur une zone de carte (zone 1 pour une carte classique).
  const onCardAction = useCallback(
    (d: Destination, part: PartIndex, button: ClickButton) => {
      if (d.category === 'farm') {
        setPanel({ type: 'farm', id: d.id }); // V1 : clic gauche et droit ouvrent le parcours
        return;
      }
      const parts = cardParts(d);
      const target = parts[part - 1];
      // La zone n'est transmise au retour visuel que pour une carte à deux étapes.
      void copy(d.id, target ? partCommand(target, button) : null, NOTHING_TO_COPY, parts.length > 1 ? part : undefined);
    },
    [copy],
  );

  const onToggleFavorite = useCallback((d: Destination) => {
    const next = new Set(favoritesRef.current);
    if (!next.delete(d.id)) next.add(d.id);
    favoritesRef.current = next;
    setFavorites(next);
    void saveFavorites(next);
  }, []);

  const onEdit = useCallback((d: Destination) => openEditor(draftFromDestination(d)), [openEditor]);

  const onNew = () => openEditor(emptyDraft(isCategory(view) ? view : undefined));

  const onToggleAlwaysOnTop = () => updateSettings({ alwaysOnTop: !settings.alwaysOnTop });

  // Pendant l'édition, le bouton est désactivé : la saisie en cours n'est jamais perdue.
  const onToggleSettings = () =>
    setPanel((p) => {
      if (p?.type === 'editor') return p;
      if (p?.type === 'settings') return null;
      return { type: 'settings', section: settingsSectionRef.current };
    });

  const onSettingsSection = (section: SettingsSectionId) => {
    settingsSectionRef.current = section;
    setPanel({ type: 'settings', section });
  };

  // L'état n'est mis à jour qu'après l'écriture sur disque (`useCatalog`) ; une erreur remonte au formulaire.
  const onSaveDraft = async (draft: DestinationDraft) => {
    const saved = await save(draft);
    setPanel(null);
    // Si la vue courante masque la destination, basculer sur sa catégorie et vider la recherche.
    if (saved.enabled && filterDestinations([saved], view, query, favorites, dictionary).length === 0) {
      setView(saved.category);
      setQuery('');
    }
    revealRef.current = saved.enabled ? saved.id : null;
    setRevealTick((t) => t + 1);
    notify('Destination enregistrée');
  };

  const onDeleteDestination = async (id: string) => {
    await remove(id);
    setPanel(null);
    if (favoritesRef.current.has(id)) {
      const next = new Set(favoritesRef.current);
      next.delete(id);
      favoritesRef.current = next;
      setFavorites(next);
      void saveFavorites(next);
    }
    setFarmProgress((p) => {
      if (!(id in p)) return p;
      const next = { ...p };
      delete next[id];
      return next;
    });
    notify('Destination supprimée');
  };

  const onDuplicate = (id: string) => {
    const d = destinations.find((x) => x.id === id);
    if (d) openEditor(duplicateDraft(d));
  };

  // La saisie reste fluide sur un gros catalogue : le filtrage suit avec une priorité basse.
  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(
    () => filterDestinations(destinations, view, deferredQuery, favorites, dictionary),
    [destinations, view, deferredQuery, favorites, dictionary],
  );

  // Grille fenêtrée : seules les rangées visibles (plus une marge) sont dans le DOM.
  const {
    scrollRef: gridScrollRef,
    gridRef,
    start: gridStart,
    end: gridEnd,
    style: gridStyle,
    reveal,
  } = useGridWindow(visible.length);

  // Après un enregistrement : amener la carte à l'écran dès qu'elle fait partie de la grille,
  // par calcul de sa rangée (elle n'est pas forcément rendue).
  useEffect(() => {
    const id = revealRef.current;
    if (id === null) return;
    const index = visible.findIndex((d) => d.id === id);
    if (index < 0) return;
    revealRef.current = null;
    reveal(index);
  }, [visible, reveal, revealTick]);

  // Nombre de destinations par onglet, hors recherche : même filtre que la grille, requête vide.
  const tabCounts = useMemo(
    () =>
      ready
        ? (Object.fromEntries(
            VIEWS.map((v) => [v.id, filterDestinations(destinations, v.id, '', favorites, dictionary).length]),
          ) as Record<ViewFilter, number>)
        : undefined,
    [ready, destinations, favorites, dictionary],
  );

  const farmId = panel?.type === 'farm' ? panel.id : null;
  const farm = useMemo(() => destinations.find((d) => d.id === farmId) ?? null, [destinations, farmId]);
  const farmRoute = useMemo(() => (farm ? parseFarmRoute(farm.command) : null), [farm]);

  const setFarmStep = (id: string, step: number) => setFarmProgress((p) => ({ ...p, [id]: step }));
  const farmStep = farm ? (farmProgress[farm.id] ?? -1) : -1;

  const emptyView = ready && destinations.length > 0 && visible.length === 0 ? emptyMessage(view, deferredQuery) : null;

  const manageLabel = manageMode ? 'Quitter le mode gestion (Échap)' : 'Gérer les destinations';

  return (
    <div className="app" onContextMenu={blockContextMenu}>
      <WindowHeader
        alwaysOnTop={settings.alwaysOnTop}
        onToggleAlwaysOnTop={onToggleAlwaysOnTop}
        settingsOpen={settingsOpen}
        settingsDisabled={editorOpen}
        onToggleSettings={onToggleSettings}
      />

      {/* Sous le formulaire ou les paramètres, rien ne doit recevoir le focus clavier ni les clics. */}
      <div className="toolbar" inert={overlayOpen}>
        {/* Loupe à gauche, rappel du raccourci à droite tant que le champ est vide (CSS seul). */}
        <label className="search">
          <SearchIcon />
          <input
            ref={searchRef}
            className="search__input"
            type="search"
            placeholder="Rechercher"
            aria-label="Rechercher une destination"
            title="Tapez directement pour rechercher · Échap pour effacer"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="search__key" aria-hidden>
            Ctrl F
          </kbd>
        </label>
        <div className="toolbar__row">
          <CategoryTabs value={view} onChange={setView} counts={tabCounts} />
          <button
            type="button"
            className="icon-btn"
            title="Nouvelle destination"
            aria-label="Nouvelle destination"
            disabled={!ready}
            onClick={onNew}
          >
            <PlusIcon />
          </button>
          <button
            type="button"
            className={`icon-btn${manageMode ? ' is-active' : ''}`}
            title={manageLabel}
            aria-label="Gérer les destinations"
            aria-pressed={manageMode}
            disabled={!ready}
            onClick={() => setManageMode((m) => !m)}
          >
            <PencilIcon />
          </button>
        </div>
      </div>

      <main ref={gridScrollRef} className={`grid-scroll${manageMode ? ' is-managing' : ''}`} inert={overlayOpen}>
        {load.status === 'loading' && (
          <div className="empty">
            <p className="empty__title">Chargement…</p>
          </div>
        )}
        {load.status === 'error' && (
          <div className="empty">
            <p className="empty__title">Catalogue illisible, il n'a pas été modifié</p>
            <p className="empty__hint empty__detail">{load.message}</p>
          </div>
        )}
        {ready && destinations.length === 0 && (
          <div className="empty">
            <p className="empty__title">Aucune destination pour l'instant</p>
            <button type="button" className="btn btn--primary" onClick={onNew}>
              Créer une destination
            </button>
          </div>
        )}
        {emptyView && (
          <div className="empty">
            <p className="empty__title">{emptyView.title}</p>
            {emptyView.hint && <p className="empty__hint">{emptyView.hint}</p>}
          </div>
        )}
        <div ref={gridRef} className="grid" style={gridStyle}>
          {visible.slice(gridStart, gridEnd).map((d) => (
            <CompactCard
              key={d.id}
              destination={d}
              favorite={favorites.has(d.id)}
              feedback={feedback?.key === d.id ? feedback.kind : null}
              feedbackPart={feedback?.key === d.id ? (feedback.part ?? null) : null}
              onAction={onCardAction}
              onToggleFavorite={onToggleFavorite}
              manage={manageMode}
              onEdit={onEdit}
            />
          ))}
        </div>
      </main>

      {farm && farmRoute && (
        <FarmPanel
          name={farm.name}
          route={farmRoute}
          currentStep={farmStep >= 0 ? farmStep : null}
          feedbackKey={feedback?.key.startsWith(FARM_KEY) ? feedback.key.slice(FARM_KEY.length) : null}
          onClose={() => setPanel(null)}
          onStart={() => {
            setFarmStep(farm.id, -1);
            void copy(`${FARM_KEY}start`, farmStartCommand(farmRoute), 'Parcours vide');
          }}
          onStep={(i) => {
            setFarmStep(farm.id, i);
            void copy(`${FARM_KEY}${i}`, farmResumeCommand(farmRoute, i), 'Fin de parcours : rien à copier');
          }}
        />
      )}

      {panel?.type === 'editor' && (
        <DestinationForm
          key={panel.key}
          initial={panel.draft}
          onSave={onSaveDraft}
          onDelete={onDeleteDestination}
          onDuplicate={onDuplicate}
          onClose={() => setPanel(null)}
        />
      )}

      {panel?.type === 'settings' && (
        <SettingsPanel
          section={panel.section}
          settings={settings}
          updater={updater}
          aliases={aliases}
          destinations={destinations}
          onSectionChange={onSettingsSection}
          onChange={updateSettings}
          onClose={() => setPanel(null)}
        />
      )}

      {feedback ? (
        <div className={`status${feedback.kind === 'warning' ? ' is-warning' : ''}`} role="status">
          {feedback.text}
        </div>
      ) : (
        updateIndicator && (
          <div className="status" role="status">
            {updateIndicator}
          </div>
        )
      )}
    </div>
  );
}
