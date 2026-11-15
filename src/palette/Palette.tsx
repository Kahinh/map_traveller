import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { SearchIcon } from '../components/icons';
import type { Destination } from '../features/catalog/schema';
import type { ClickButton } from '../features/commands/cardParts';
import { buildPaletteIndex, PALETTE_LIMIT, searchPalette, type PaletteEntry } from '../features/palette/entries';
import { navReducer, type NavAction, type NavState } from '../features/palette/navigation';
import { copyText } from '../lib/tauri/clipboard';
import { initImages } from '../lib/tauri/images';
import { hidePalette, onPaletteShown } from '../lib/tauri/palette';
import { loadCatalog, loadFavorites } from '../lib/tauri/storage';
import { PaletteRow } from './PaletteRow';

const LIST_ID = 'palette-list';
const optionId = (i: number) => `palette-opt-${i}`;

type Status = { kind: 'copied' | 'warning'; text: string } | null;

/**
 * État de navigation rattaché à la liste de résultats pour laquelle il a été calculé. Quand
 * la liste change (frappe, rechargement), l'état est dérivé par l'action `results` pendant le
 * rendu, sans effet ni rendu intermédiaire (premier résultat sélectionné, étape 1).
 */
interface NavSlot {
  entries: readonly PaletteEntry[] | null;
  nav: NavState;
}

const EMPTY_NAV: NavState = { index: -1, choice: 0 };

/**
 * Palette de recherche globale. Le focus reste toujours dans le champ ; Entrée / clic gauche
 * copie sans le `/zaap` initial, Ctrl+Entrée / clic droit copie la commande complète. Copie
 * d'abord, masque ensuite, et seulement si la copie a réussi. Aucun minuteur : au repos, rien
 * ne tourne.
 */
export function Palette() {
  const [destinations, setDestinations] = useState<readonly Destination[]>([]);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [slot, setSlot] = useState<NavSlot>({ entries: null, nav: EMPTY_NAV });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const loadSeq = useRef(0);
  const copying = useRef(false);
  /** Dernière position écran du pointeur vue sur la liste. */
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  // Index construit une fois par chargement ; recherche à chaque frappe sur le texte en cache.
  const index = useMemo(() => buildPaletteIndex(destinations, favorites), [destinations, favorites]);
  const { entries, notice } = useMemo(() => searchPalette(index, query, PALETTE_LIMIT), [index, query]);
  const choiceCounts = useMemo(() => entries.map((e) => e.choices.length), [entries]);

  const nav = slot.entries === entries ? slot.nav : navReducer(slot.nav, { type: 'results' }, choiceCounts);
  const selected = nav.index >= 0 ? entries[nav.index] : undefined;

  const dispatch = useCallback(
    (action: NavAction) => {
      setSlot((prev) => {
        const base = prev.entries === entries ? prev.nav : navReducer(prev.nav, { type: 'results' }, choiceCounts);
        const next = navReducer(base, action, choiceCounts);
        return prev.entries === entries && next === prev.nav ? prev : { entries, nav: next };
      });
    },
    [entries, choiceCounts],
  );

  /** Recharge catalogue et favoris (à chaque affichage) ; seul le dernier chargement compte. */
  const reload = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [catalog, favs] = await Promise.all([loadCatalog(), loadFavorites(), initImages()]);
      if (seq !== loadSeq.current) return;
      if (catalog.ok) {
        setDestinations(catalog.catalog.destinations);
        setLoadError(null);
      } else {
        setLoadError(`Catalogue invalide : ${catalog.errors[0]?.message ?? 'erreur inconnue'}`);
      }
      setFavorites(favs);
    } catch (e) {
      if (seq === loadSeq.current) setLoadError(`Chargement impossible : ${String(e)}`);
    } finally {
      if (seq === loadSeq.current) setLoaded(true);
    }
  }, []);

  /** À chaque affichage : champ vidé, sélection remise au premier résultat, données rechargées. */
  const onShown = useCallback(() => {
    copying.current = false;
    setQuery('');
    setStatus(null);
    setSlot({ entries: null, nav: EMPTY_NAV });
    inputRef.current?.focus();
    if (listRef.current) listRef.current.scrollTop = 0;
    void reload();
  }, [reload]);

  useEffect(() => onPaletteShown(onShown), [onShown]);

  // La fenêtre qui reprend le focus le rend au champ (aucun autre élément n'est focalisable).
  useEffect(() => {
    const refocus = () => inputRef.current?.focus();
    window.addEventListener('focus', refocus);
    return () => window.removeEventListener('focus', refocus);
  }, []);

  // La ligne sélectionnée reste visible quand on navigue au clavier.
  useEffect(() => {
    if (nav.index < 0) return;
    document.getElementById(optionId(nav.index))?.scrollIntoView({ block: 'nearest' });
  }, [nav.index, entries]);

  /** Copie la commande de la case `choice` de la ligne `i`, puis masque la palette. */
  const activate = useCallback(
    async (i: number, choice: number, button: ClickButton) => {
      const entry = entries[i];
      if (!entry) return;
      const c = entry.choices[choice] ?? entry.choices[0];
      const text = c ? (button === 'left' ? c.primary : c.secondary) : null;
      if (text === null) {
        setStatus({
          kind: 'warning',
          text: entry.kind === 'farm-step' ? 'Fin de parcours : rien à copier.' : 'Aucune commande à copier.',
        });
        return;
      }
      if (copying.current) return;
      copying.current = true;
      try {
        await copyText(text);
      } catch (e) {
        copying.current = false;
        setStatus({ kind: 'warning', text: `Copie impossible : ${String(e)}` });
        return; // la palette reste ouverte : rien n'a été copié
      }
      setStatus({ kind: 'copied', text: `Copié : ${text}` });
      try {
        await hidePalette();
      } catch (e) {
        setStatus({ kind: 'warning', text: `Copié, mais fermeture impossible : ${String(e)}` });
      } finally {
        copying.current = false;
      }
    },
    [entries],
  );

  const onHover = useCallback(
    (i: number, choice: number | null, screenX: number, screenY: number) => {
      // Pointeur immobile (liste défilée au clavier dessous) : la sélection ne bouge pas.
      const last = lastPointer.current;
      if (last && last.x === screenX && last.y === screenY) return;
      lastPointer.current = { x: screenX, y: screenY };
      dispatch({ type: 'set', index: i });
      if (choice !== null) dispatch({ type: 'set-choice', choice });
    },
    [dispatch],
  );

  const onActivate = useCallback(
    (i: number, choice: number, button: ClickButton) => {
      void activate(i, choice, button);
    },
    [activate],
  );

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setStatus(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Pendant une composition de saisie (accents, IME), les touches appartiennent à l'éditeur.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const modified = e.shiftKey || e.altKey || e.ctrlKey || e.metaKey;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        dispatch({ type: 'next' });
        return;
      case 'ArrowUp':
        e.preventDefault();
        dispatch({ type: 'prev' });
        return;
      case 'Home':
      case 'End':
        // Seulement si le champ est vide : sinon elles déplacent le curseur de texte.
        if (query !== '' || modified) return;
        e.preventDefault();
        dispatch({ type: e.key === 'Home' ? 'first' : 'last' });
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
        // Interceptées uniquement sur une ligne à deux étapes (sinon : curseur de texte).
        if (modified || !selected || selected.choices.length < 2) return;
        e.preventDefault();
        dispatch({ type: e.key === 'ArrowRight' ? 'choice-next' : 'choice-prev' });
        return;
      case 'Enter':
        e.preventDefault();
        if (nav.index < 0) return;
        void activate(nav.index, nav.choice, e.ctrlKey || e.metaKey ? 'right' : 'left');
        return;
      case 'Escape':
        e.preventDefault();
        void hidePalette().catch((err: unknown) =>
          setStatus({ kind: 'warning', text: `Fermeture impossible : ${String(err)}` }),
        );
        return;
      case 'Tab':
        e.preventDefault(); // le focus reste dans le champ
        return;
    }
  };

  const showSteps = selected !== undefined && selected.choices.length > 1;
  const showZaapHint = selected?.choices.some((c) => c.primary !== c.secondary) ?? false;
  const trimmed = query.trim();

  let message: string | null = null;
  if (!loaded) message = 'Chargement…';
  else if (entries.length === 0) {
    if (trimmed) message = `Aucun résultat pour « ${trimmed} ».`;
    else if (!loadError) message = 'Aucune destination dans le catalogue.';
  }

  return (
    <div className="palette">
      <div className="palette__bar">
        <SearchIcon />
        <input
          ref={inputRef}
          className="palette__search"
          type="text"
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Rechercher une destination ou un parcours…"
          aria-label="Rechercher une destination ou un parcours"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={entries.length > 0}
          aria-controls={LIST_ID}
          aria-activedescendant={selected ? optionId(nav.index) : undefined}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {(loadError || notice) && (
        <p className={`palette__notice${loadError ? ' is-error' : ''}`}>{loadError ?? notice}</p>
      )}

      <ul ref={listRef} id={LIST_ID} className="palette__list" role="listbox" aria-label="Résultats">
        {entries.map((entry, i) => (
          <PaletteRow
            key={entry.key}
            entry={entry}
            index={i}
            id={optionId(i)}
            selected={i === nav.index}
            activeChoice={i === nav.index ? nav.choice : null}
            onHover={onHover}
            onActivate={onActivate}
          />
        ))}
      </ul>
      {message && <p className="palette__empty">{message}</p>}

      {/* Région annoncée par les lecteurs d'écran : toujours présente, contenu seul variable. */}
      <span className="palette__sr" role="status" aria-live="polite">
        {status?.text ?? ''}
      </span>
      <footer className="palette__hints">
        {status ? (
          <span className={`palette__status is-${status.kind}`}>{status.text}</span>
        ) : (
          <>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> naviguer
            </span>
            {showSteps && (
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd> étape
              </span>
            )}
            <span>
              <kbd>Entrée</kbd> copier
            </span>
            {showZaapHint && (
              <span>
                <kbd>Ctrl</kbd>+<kbd>Entrée</kbd> avec Zaap
              </span>
            )}
            <span>
              <kbd>Échap</kbd> fermer
            </span>
          </>
        )}
      </footer>
    </div>
  );
}
