import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { CatalogGrid } from '../components/CatalogGrid';
import { DestinationForm } from '../components/DestinationForm';
import { FarmPanel } from '../components/FarmPanel';
import { DEFAULT_SETTINGS_SECTION, SettingsPanel, type SettingsSectionId } from '../components/SettingsPanel';
import { StatusBubble, type StatusMessage } from '../components/StatusBubble';
import { Toolbar } from '../components/Toolbar';
import { WindowHeader } from '../components/WindowHeader';
import {
  draftFromDestination,
  duplicateDraft,
  emptyDraft,
  type DestinationDraft,
} from '../features/catalog/editor';
import { CATEGORIES, type Category, type Destination } from '../features/catalog/schema';
import type { ViewFilter } from '../features/catalog/search';
import { cardParts, partCommand, partVariants, type ClickButton, type PartIndex } from '../features/commands/cardParts';
import { farmStartCommand, farmStepCommand, parseFarmRoute } from '../features/farm/farmRoute';
import { describeUpdateState } from '../features/updates/types';
import { errorText } from '../lib/errors';
import { IS_TAURI } from '../lib/tauri/env';
import { openFarm } from '../lib/tauri/farm';
import { setMainBusy } from '../lib/tauri/window';
import { useAliases } from './useAliases';
import { useAppKeyboard } from './useAppKeyboard';
import { useCatalog } from './useCatalog';
import { useCatalogView } from './useCatalogView';
import { useCopyFeedback } from './useCopyFeedback';
import { useFarmProgress } from './useFarmProgress';
import { useFavorites } from './useFavorites';
import { usePanel } from './usePanel';
import { useSettings } from './useSettings';
import { useUpdater } from './useUpdater';

/** Un seul panneau ouvert à la fois. `key` remonte le formulaire à chaque ouverture. */
type PanelState =
  | { type: 'farm'; id: string }
  | { type: 'editor'; draft: DestinationDraft; key: number }
  | { type: 'settings'; section: SettingsSectionId };

const NOTHING_TO_COPY = 'Aucune commande à copier';
/** Message de copie d'une zone à deux variantes : clic gauche sans Zaap, clic droit avec. */
const COPIED_LABEL: Record<ClickButton, string> = { left: 'Copié sans Zaap', right: 'Copié avec Zaap' };
const FARM_KEY = 'farm:';
const GRID_ID = 'catalog-grid';

/** Le menu contextuel du navigateur n'a pas sa place dans l'app, sauf dans les champs de saisie. */
function blockContextMenu(e: MouseEvent) {
  if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault();
}

/** Première zone de copie de la grille dont le bas est sous le haut de la zone défilante. */
function firstCardOnScreen(): HTMLElement | null {
  const grid = document.getElementById(GRID_ID);
  if (!grid) return null;
  const top = grid.getBoundingClientRect().top;
  const zones = grid.querySelectorAll<HTMLElement>('.card__main, .card__zone--1');
  for (const zone of zones) if (zone.getBoundingClientRect().bottom > top) return zone;
  return null;
}

const isCategory = (v: ViewFilter): v is Category => CATEGORIES.includes(v as Category);

export function App() {
  const { load, destinations, save, remove } = useCatalog();
  // Dictionnaire global d'alias de recherche : même moteur pour la grille et la palette.
  const { dictionary, binding: aliases } = useAliases();
  const { feedback, copy, notify } = useCopyFeedback();
  const warn = useCallback((message: string) => notify(message, 'warning'), [notify]);
  const { favorites, toggle: toggleFavorite, forget: forgetFavorite } = useFavorites(warn);
  const { settings, loaded: settingsLoaded, error: settingsError, update: updateSettings } = useSettings(warn);
  const farmProgress = useFarmProgress();
  const searchRef = useRef<HTMLInputElement>(null);
  const { panel, open: openPanel, close: closePanel, closeAndFocus } = usePanel<PanelState>(searchRef);
  /** Mode gestion : un crayon sur chaque carte ouvre le formulaire (non persistant). */
  const [manageMode, setManageMode] = useState(false);
  /** Carte à amener à l'écran après un enregistrement (un nouvel objet par demande). */
  const [reveal, setReveal] = useState<{ id: string } | null>(null);
  const editorSeq = useRef(0);
  /** Dernière rubrique des paramètres consultée (session uniquement). */
  const settingsSectionRef = useRef<SettingsSectionId>(DEFAULT_SETTINGS_SECTION);

  const ready = load.status === 'ready';
  const { view, setView, query, setQuery, deferredQuery, visible, counts, allMatches, firstMatch, showDestination } =
    useCatalogView(
    destinations,
    favorites,
    dictionary,
    ready,
  );
  const editorOpen = panel?.type === 'editor';
  const settingsOpen = panel?.type === 'settings';
  const panelOpen = panel !== null;

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

  useAppKeyboard({
    disabled: editorOpen,
    panelOpen,
    query,
    searchRef,
    closePanel,
    focusSearch: () => {
      const search = searchRef.current;
      // La recherche est inerte tant qu'un panneau est là : elle prend le focus à sa fermeture.
      if (panelOpen) {
        closeAndFocus(search);
        setTimeout(() => search?.select(), 0);
      } else {
        search?.focus();
        search?.select();
      }
    },
    clearQuery: () => setQuery(''),
    exitManageMode: () => setManageMode(false),
  });

  const openEditor = useCallback(
    (draft: DestinationDraft) => {
      editorSeq.current += 1;
      openPanel({ type: 'editor', draft, key: editorSeq.current });
    },
    [openPanel],
  );

  // Gestionnaires stables : nécessaires pour que la mémoïsation des cartes soit effective.
  // Clic gauche ou droit sur une zone de carte (zone 1 pour une carte classique).
  const onCardAction = useCallback(
    (d: Destination, part: PartIndex, button: ClickButton) => {
      if (d.category === 'farm') {
        // Clic gauche et droit ouvrent le parcours : dans sa propre fenêtre, toujours au premier
        // plan ; dans le panneau en mode navigateur.
        if (IS_TAURI) openFarm(d.id).catch((e: unknown) => warn(`Ouverture du parcours impossible : ${errorText(e)}`));
        else openPanel({ type: 'farm', id: d.id });
        return;
      }
      const parts = cardParts(d);
      const target = parts[part - 1];
      // Deux variantes : la bulle dit laquelle a été copiée (clic gauche = sans Zaap).
      const label = target && partVariants(target).length === 2 ? COPIED_LABEL[button] : undefined;
      // La zone n'est transmise au retour visuel que pour une carte à deux étapes.
      void copy(d.id, target ? partCommand(target, button) : null, NOTHING_TO_COPY, {
        part: parts.length > 1 ? part : undefined,
        label,
      });
    },
    [copy, openPanel, warn],
  );

  /**
   * Clavier propre au champ de recherche (invariant 11 : c'est la recherche) : ↓ donne le focus
   * à la première carte à l'écran (première zone d'une carte à deux étapes) ; Entrée agit comme
   * un clic gauche sur la première carte de la recherche tapée, ou un clic droit si le clic gauche
   * n'a rien à copier (commande réduite à un `/zaap`, comme la palette). Requête vide : rien.
   */
  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === 'ArrowDown') {
      const card = firstCardOnScreen();
      if (!card) return;
      e.preventDefault();
      card.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      const first = firstMatch();
      if (!first) return;
      const part = cardParts(first)[0];
      const button = part && partCommand(part, 'left') === null && partCommand(part, 'right') !== null ? 'right' : 'left';
      onCardAction(first, 1, button);
    }
  };

  const onToggleFavorite = useCallback((d: Destination) => toggleFavorite(d.id), [toggleFavorite]);

  const onEdit = useCallback((d: Destination) => openEditor(draftFromDestination(d)), [openEditor]);

  const onNew = useCallback(() => openEditor(emptyDraft(isCategory(view) ? view : undefined)), [openEditor, view]);

  // Pendant l'édition, le bouton est désactivé : la saisie en cours n'est jamais perdue.
  const onToggleSettings = () => {
    if (editorOpen) return;
    if (settingsOpen) closePanel();
    else openPanel({ type: 'settings', section: settingsSectionRef.current });
  };

  const onSettingsSection = (section: SettingsSectionId) => {
    settingsSectionRef.current = section;
    openPanel({ type: 'settings', section });
  };

  // L'état n'est mis à jour qu'après l'écriture sur disque (`useCatalog`) ; une erreur remonte au formulaire.
  const onSaveDraft = async (draft: DestinationDraft) => {
    const saved = await save(draft);
    closePanel();
    if (saved.enabled) showDestination(saved);
    setReveal(saved.enabled ? { id: saved.id } : null);
    notify('Destination enregistrée');
  };

  const onDeleteDestination = async (id: string) => {
    await remove(id);
    closePanel();
    forgetFavorite(id);
    farmProgress.forget(id);
    notify('Destination supprimée');
  };

  const onDuplicate = (id: string) => {
    const d = destinations.find((x) => x.id === id);
    if (d) openEditor(duplicateDraft(d));
  };

  const farmId = panel?.type === 'farm' ? panel.id : null;
  const farm = useMemo(() => destinations.find((d) => d.id === farmId) ?? null, [destinations, farmId]);
  const farmRoute = useMemo(() => (farm ? parseFarmRoute(farm.command) : null), [farm]);
  const farmStep = farm ? farmProgress.stepOf(farm.id) : -1;
  const farmStart = farmRoute ? farmStartCommand(farmRoute) : null;

  const statusMessage: StatusMessage | null = feedback ?? (updateIndicator === null ? null : { text: updateIndicator });

  return (
    <div className="app" onContextMenu={blockContextMenu}>
      <WindowHeader
        alwaysOnTop={settings.alwaysOnTop}
        onToggleAlwaysOnTop={() => void updateSettings({ alwaysOnTop: !settings.alwaysOnTop })}
        settingsOpen={settingsOpen}
        settingsDisabled={editorOpen}
        onToggleSettings={onToggleSettings}
        onError={warn}
      />

      {/* Sous un panneau, rien ne doit recevoir le focus clavier ni les clics. */}
      <Toolbar
        searchRef={searchRef}
        query={query}
        onQueryChange={setQuery}
        onSearchKeyDown={onSearchKeyDown}
        view={view}
        onViewChange={setView}
        counts={counts}
        gridId={GRID_ID}
        ready={ready}
        manageMode={manageMode}
        onToggleManage={() => setManageMode((m) => !m)}
        onNew={onNew}
        inert={panelOpen}
      />

      <CatalogGrid
        id={GRID_ID}
        load={load}
        hasDestinations={destinations.length > 0}
        visible={visible}
        view={view}
        query={deferredQuery}
        allMatches={allMatches}
        onShowAll={() => setView('all')}
        favorites={favorites}
        feedback={feedback}
        manageMode={manageMode}
        reveal={reveal}
        onCardAction={onCardAction}
        onToggleFavorite={onToggleFavorite}
        onEdit={onEdit}
        onNew={onNew}
        inert={panelOpen}
      />

      {farm && farmRoute && (
        <FarmPanel
          name={farm.name}
          route={farmRoute}
          hasStart={farmStart !== null}
          currentStep={farmStep >= 0 ? farmStep : null}
          feedbackKey={feedback?.key.startsWith(FARM_KEY) ? feedback.key.slice(FARM_KEY.length) : null}
          onClose={closePanel}
          onStart={() => {
            // « Début » mène à la première position : c'est elle qui devient la position courante.
            farmProgress.setStep(farm.id, 0);
            void copy(`${FARM_KEY}start`, farmStart, NOTHING_TO_COPY);
          }}
          onStep={(i) => {
            farmProgress.setStep(farm.id, i);
            void copy(`${FARM_KEY}${i}`, farmStepCommand(farmRoute, i), NOTHING_TO_COPY);
          }}
        />
      )}

      {panel?.type === 'editor' && (
        <DestinationForm
          key={panel.key}
          initial={panel.draft}
          destinations={destinations}
          onSave={onSaveDraft}
          onDelete={onDeleteDestination}
          onDuplicate={onDuplicate}
          onClose={closePanel}
        />
      )}

      {panel?.type === 'settings' && (
        <SettingsPanel
          section={panel.section}
          settings={settings}
          settingsError={settingsError}
          updater={updater}
          aliases={aliases}
          destinations={destinations}
          onSectionChange={onSettingsSection}
          onChange={updateSettings}
          onClose={closePanel}
        />
      )}

      <StatusBubble message={statusMessage} warning={feedback?.kind === 'warning'} />
    </div>
  );
}
