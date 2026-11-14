import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CategoryTabs } from '../components/CategoryTabs';
import { CompactCard, type Feedback } from '../components/CompactCard';
import { FarmPanel } from '../components/FarmPanel';
import { WindowHeader } from '../components/WindowHeader';
import type { Destination } from '../features/catalog/schema';
import { filterDestinations, type ViewFilter } from '../features/catalog/search';
import { leftClickCommand, rightClickCommand } from '../features/commands/copyRules';
import { farmResumeCommand, farmStartCommand, parseFarmRoute } from '../features/farm/farmRoute';
import { copyText } from '../lib/tauri/clipboard';
import {
  loadCatalog,
  loadFavorites,
  loadSettings,
  saveFavorites,
  saveSettings,
  DEFAULT_SETTINGS,
  type Settings,
} from '../lib/tauri/storage';
import { setAlwaysOnTop } from '../lib/tauri/window';

const FEEDBACK_MS = 800;

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

interface Status {
  text: string;
  warning: boolean;
}

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<ViewFilter>('all');
  const [query, setQuery] = useState('');
  const [farm, setFarm] = useState<Destination | null>(null);
  const [feedback, setFeedback] = useState<{ key: string; kind: Exclude<Feedback, null> } | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      const [cat, favs, sets] = await Promise.all([loadCatalog(), loadFavorites(), loadSettings()]);
      if (!cat.ok) {
        setLoad({ status: 'error', message: cat.errors.map((e) => `${e.path} ${e.message}`.trim()).join(' · ') });
        return;
      }
      setDestinations(cat.catalog.destinations);
      setFavorites(favs);
      setSettings(sets);
      void setAlwaysOnTop(sets.alwaysOnTop);
      setLoad({ status: 'ready' });
    })().catch((e: unknown) => setLoad({ status: 'error', message: String(e) }));
  }, []);

  const flash = useCallback((key: string, kind: Exclude<Feedback, null>, text: string) => {
    window.clearTimeout(timer.current);
    setFeedback({ key, kind });
    setStatus({ text, warning: kind === 'warning' });
    timer.current = window.setTimeout(() => {
      setFeedback(null);
      setStatus(null);
    }, FEEDBACK_MS + (kind === 'warning' ? 700 : 0));
  }, []);

  /** Copie `text` (ou signale qu'il n'y a rien à copier) et affiche un retour non bloquant. */
  const copyWithFeedback = useCallback(
    async (key: string, text: string | null, emptyMessage: string) => {
      if (text === null) {
        flash(key, 'warning', emptyMessage);
        return;
      }
      try {
        await copyText(text);
        flash(key, 'copied', `Copié : ${text}`);
      } catch (e) {
        flash(key, 'warning', `Copie impossible : ${String(e)}`);
      }
    },
    [flash],
  );

  const onLeftClick = (d: Destination) => {
    if (d.category === 'farm') return setFarm(d);
    void copyWithFeedback(d.id, leftClickCommand(d.command), 'Aucune commande à copier.');
  };

  const onRightClick = (d: Destination) => {
    if (d.category === 'farm') return setFarm(d); // V1 : même action que le clic gauche
    void copyWithFeedback(d.id, rightClickCommand(d.command), 'Aucune commande à copier.');
  };

  const onToggleFavorite = (d: Destination) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(d.id)) next.delete(d.id);
      else next.add(d.id);
      void saveFavorites(next);
      return next;
    });
  };

  const onToggleAlwaysOnTop = () => {
    const next = { ...settings, alwaysOnTop: !settings.alwaysOnTop };
    setSettings(next);
    void setAlwaysOnTop(next.alwaysOnTop);
    void saveSettings(next);
  };

  const visible = useMemo(
    () => filterDestinations(destinations, view, query, favorites),
    [destinations, view, query, favorites],
  );

  const farmRoute = useMemo(() => (farm ? parseFarmRoute(farm.command) : null), [farm]);

  return (
    <div className="app">
      <WindowHeader alwaysOnTop={settings.alwaysOnTop} onToggleAlwaysOnTop={onToggleAlwaysOnTop} />

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Rechercher une destination…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
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
          <p className="empty">
            {destinations.length === 0
              ? 'Catalogue vide.'
              : view === 'favorites' && !query
                ? 'Aucun favori : cliquez sur ☆ pour en ajouter.'
                : 'Aucune destination ne correspond.'}
          </p>
        )}
        <div className="grid">
          {visible.map((d) => (
            <CompactCard
              key={d.id}
              destination={d}
              favorite={favorites.has(d.id)}
              feedback={feedback?.key === d.id ? feedback.kind : null}
              onLeftClick={onLeftClick}
              onRightClick={onRightClick}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </main>

      {farm && farmRoute && (
        <FarmPanel
          destination={farm}
          feedbackKey={feedback && feedback.key.startsWith('farm:') ? feedback.key.slice(5) : null}
          onClose={() => setFarm(null)}
          onStart={() => void copyWithFeedback('farm:start', farmStartCommand(farmRoute), 'Parcours vide.')}
          onStep={(i) => void copyWithFeedback(`farm:${i}`, farmResumeCommand(farmRoute, i), 'Fin de parcours : rien à copier.')}
        />
      )}

      {status && <div className={`status${status.warning ? ' is-warning' : ''}`}>{status.text}</div>}
    </div>
  );
}
