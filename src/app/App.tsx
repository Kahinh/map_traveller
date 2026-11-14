import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { CategoryTabs } from '../components/CategoryTabs';
import { CompactCard } from '../components/CompactCard';
import { FarmPanel } from '../components/FarmPanel';
import { WindowHeader } from '../components/WindowHeader';
import type { Destination } from '../features/catalog/schema';
import { filterDestinations, type ViewFilter } from '../features/catalog/search';
import { cardParts, partCommand, type ClickButton, type PartIndex } from '../features/commands/cardParts';
import { farmResumeCommand, farmStartCommand, parseFarmRoute } from '../features/farm/farmRoute';
import { initImages } from '../lib/tauri/images';
import {
  DEFAULT_SETTINGS,
  loadCatalog,
  loadFavorites,
  loadSettings,
  saveFavorites,
  saveSettings,
  type Settings,
} from '../lib/tauri/storage';
import { setAlwaysOnTop } from '../lib/tauri/window';
import { useCopyFeedback } from './useCopyFeedback';

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

const NOTHING_TO_COPY = 'Aucune commande à copier.';
const FARM_KEY = 'farm:';

/** Le menu contextuel du navigateur n'a pas sa place dans l'app, sauf dans les champs de saisie. */
function blockContextMenu(e: MouseEvent) {
  if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
}

function emptyMessage(total: number, view: ViewFilter, query: string): string {
  if (total === 0) return 'Catalogue vide.';
  if (query.trim()) return `Aucun résultat pour « ${query.trim()} ».`;
  if (view === 'favorites') return 'Aucun favori : cliquez sur ☆ pour en ajouter.';
  return 'Aucune destination dans cette catégorie.';
}

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<ViewFilter>('all');
  const [query, setQuery] = useState('');
  const [farmId, setFarmId] = useState<string | null>(null);
  /** Dernière position cliquée par parcours (session uniquement) ; -1 = début. */
  const [farmProgress, setFarmProgress] = useState<Record<string, number>>({});
  const { feedback, copy } = useCopyFeedback();
  const searchRef = useRef<HTMLInputElement>(null);
  const favoritesRef = useRef(favorites);

  useEffect(() => {
    void (async () => {
      const [cat, favs, sets] = await Promise.all([loadCatalog(), loadFavorites(), loadSettings(), initImages()]);
      if (!cat.ok) {
        setLoad({ status: 'error', message: cat.errors.map((e) => `${e.path} ${e.message}`.trim()).join(' · ') });
        return;
      }
      favoritesRef.current = favs;
      setDestinations(cat.catalog.destinations);
      setFavorites(favs);
      setSettings(sets);
      void setAlwaysOnTop(sets.alwaysOnTop);
      setLoad({ status: 'ready' });
    })().catch((e: unknown) => setLoad({ status: 'error', message: String(e) }));
  }, []);

  // Raccourcis : Échap (retour / effacer), Ctrl+F (recherche), frappe directe → recherche.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const search = searchRef.current;
      if (e.key === 'Escape') {
        if (farmId !== null) setFarmId(null);
        else setQuery('');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFarmId(null);
        search?.focus();
        search?.select();
        return;
      }
      const printable = e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (printable && farmId === null && document.activeElement !== search) search?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [farmId]);

  // Gestionnaires stables : nécessaires pour que la mémoïsation des cartes soit effective.
  // Clic gauche ou droit sur une zone de carte (zone 1 pour une carte classique).
  const onCardAction = useCallback(
    (d: Destination, part: PartIndex, button: ClickButton) => {
      if (d.category === 'farm') {
        setFarmId(d.id); // V1 : clic gauche et droit ouvrent le parcours
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

  const onToggleAlwaysOnTop = () => {
    const next = { ...settings, alwaysOnTop: !settings.alwaysOnTop };
    setSettings(next);
    void setAlwaysOnTop(next.alwaysOnTop);
    void saveSettings(next);
  };

  // La saisie reste fluide sur un gros catalogue : le filtrage suit avec une priorité basse.
  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(
    () => filterDestinations(destinations, view, deferredQuery, favorites),
    [destinations, view, deferredQuery, favorites],
  );

  const farm = useMemo(() => destinations.find((d) => d.id === farmId) ?? null, [destinations, farmId]);
  const farmRoute = useMemo(() => (farm ? parseFarmRoute(farm.command) : null), [farm]);

  const setFarmStep = (id: string, step: number) => setFarmProgress((p) => ({ ...p, [id]: step }));
  const farmStep = farm ? (farmProgress[farm.id] ?? -1) : -1;

  return (
    <div className="app" onContextMenu={blockContextMenu}>
      <WindowHeader alwaysOnTop={settings.alwaysOnTop} onToggleAlwaysOnTop={onToggleAlwaysOnTop} />

      <div className="toolbar">
        <input
          ref={searchRef}
          className="search"
          type="search"
          placeholder="Rechercher une destination…"
          aria-label="Rechercher une destination"
          title="Tapez directement pour rechercher · Échap pour effacer"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <CategoryTabs value={view} onChange={setView} />
      </div>

      <main className="grid-scroll">
        {load.status === 'loading' && <p className="empty">Chargement…</p>}
        {load.status === 'error' && (
          <p className="empty">
            Catalogue illisible, il n'a pas été modifié.
            <br />
            {load.message}
          </p>
        )}
        {load.status === 'ready' && visible.length === 0 && (
          <p className="empty">{emptyMessage(destinations.length, view, deferredQuery)}</p>
        )}
        <div className="grid">
          {visible.map((d) => (
            <CompactCard
              key={d.id}
              destination={d}
              favorite={favorites.has(d.id)}
              feedback={feedback?.key === d.id ? feedback.kind : null}
              feedbackPart={feedback?.key === d.id ? (feedback.part ?? null) : null}
              onAction={onCardAction}
              onToggleFavorite={onToggleFavorite}
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
          onClose={() => setFarmId(null)}
          onStart={() => {
            setFarmStep(farm.id, -1);
            void copy(`${FARM_KEY}start`, farmStartCommand(farmRoute), 'Parcours vide.');
          }}
          onStep={(i) => {
            setFarmStep(farm.id, i);
            void copy(`${FARM_KEY}${i}`, farmResumeCommand(farmRoute, i), 'Fin de parcours : rien à copier.');
          }}
        />
      )}

      {feedback && (
        <div className={`status${feedback.kind === 'warning' ? ' is-warning' : ''}`} role="status">
          {feedback.text}
        </div>
      )}
    </div>
  );
}
