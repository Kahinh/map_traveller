import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { SearchIcon } from '../components/icons';
import { buildDictionary, EMPTY_DICTIONARY, type AliasDictionary } from '../features/aliases/aliases';
import type { Destination } from '../features/catalog/schema';
import type { ClickButton } from '../features/commands/cardParts';
import {
  buildPaletteIndex,
  PALETTE_LIMIT,
  searchPalette,
  type PaletteEntry,
  type PaletteSearchResult,
} from '../features/palette/entries';
import { navReducer, type NavAction, type NavState } from '../features/palette/navigation';
import { copyText } from '../lib/tauri/clipboard';
import { initImages } from '../lib/tauri/images';
import { hidePalette, onPaletteShown, setPaletteHeight } from '../lib/tauri/palette';
import {
  DEFAULT_ALIASES,
  loadFavorites,
  parseAliasesText,
  parseCatalogText,
  readStoreText,
} from '../lib/tauri/storage';
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
const NO_FAVORITES: ReadonlySet<string> = new Set();
/** Champ vide : la barre seule, aucune ligne (objet stable : la navigation n'est pas recalculée). */
const NO_RESULT: PaletteSearchResult = { entries: [], notice: null };

/** Vrai si les deux ensembles ont les mêmes éléments. */
function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * Palette de recherche globale. Le focus reste toujours dans le champ ; Entrée / clic gauche
 * copie sans le `/zaap` initial, Ctrl+Entrée / clic droit copie la commande complète. Copie
 * d'abord, masque ensuite, et seulement si la copie a réussi. Aucun minuteur : au repos, rien
 * ne tourne.
 *
 * Compacte (issue n°19) : champ vide ou aucun résultat, seule la barre est rendue ; sinon les
 * lignes et le pied d'aide s'ajoutent dessous. La FENÊTRE prend la hauteur de ce contenu
 * (`setPaletteHeight`) : mesurée une fois par rendu, envoyée seulement quand elle change.
 */
export function Palette() {
  const [destinations, setDestinations] = useState<readonly Destination[]>([]);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const [dictionary, setDictionary] = useState<AliasDictionary>(EMPTY_DICTIONARY);
  const [loaded, setLoaded] = useState(false);
  /** Catalogue invalide : conservée tant que le texte du fichier ne change pas. */
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** Échec du dernier chargement : effacée dès qu'un chargement réussit. */
  const [readError, setReadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [slot, setSlot] = useState<NavSlot>({ entries: null, nav: EMPTY_NAV });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const loadSeq = useRef(0);
  const copying = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Dernière hauteur envoyée à la fenêtre ; `null` : à renvoyer. */
  const lastHeight = useRef<number | null>(null);
  /** Textes des fichiers au dernier chargement : inchangés, rien n'est revalidé ni réindexé. */
  const lastCatalogText = useRef<string | null | undefined>(undefined);
  const lastAliasesText = useRef<string | null | undefined>(undefined);
  /** Dernière position écran du pointeur vue sur la liste. */
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  // Index construit une fois par catalogue ou dictionnaire chargé (ni à chaque affichage, ni
  // quand seuls les favoris changent) ; à chaque frappe, seul le dernier mot tapé est recherché.
  const index = useMemo(() => buildPaletteIndex(destinations, NO_FAVORITES, dictionary), [destinations, dictionary]);
  const hasQuery = query.trim() !== '';
  const { entries, notice } = useMemo(
    () => (hasQuery ? searchPalette(index, query, PALETTE_LIMIT, favorites) : NO_RESULT),
    [index, query, favorites, hasQuery],
  );
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

  /**
   * Relit catalogue, alias et favoris à chaque affichage ; seul le dernier chargement compte.
   * Un fichier dont le texte n'a pas changé n'est ni revalidé ni réindexé : l'état, donc l'index
   * de recherche et les parcours analysés, est réutilisé tel quel.
   */
  const reload = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const [catalogText, aliasesText, favs] = await Promise.all([
        readStoreText('catalog'),
        readStoreText('aliases'),
        loadFavorites(),
        initImages(),
      ]);
      if (seq !== loadSeq.current) return;
      if (catalogText !== lastCatalogText.current) {
        lastCatalogText.current = catalogText;
        const catalog = parseCatalogText(catalogText);
        if (catalog.ok) {
          setDestinations(catalog.catalog.destinations);
          setCatalogError(null);
        } else {
          setCatalogError(`Catalogue invalide : ${catalog.errors[0]?.message ?? 'erreur inconnue'}`);
        }
      }
      if (aliasesText !== lastAliasesText.current) {
        lastAliasesText.current = aliasesText;
        // Fichier illisible : les alias fournis restent utilisés (la rubrique Alias signale l'erreur).
        setDictionary(buildDictionary(DEFAULT_ALIASES, parseAliasesText(aliasesText).user));
      }
      setFavorites((prev) => (sameSet(prev, favs) ? prev : favs));
      setReadError(null);
    } catch (e) {
      if (seq === loadSeq.current) setReadError(`Chargement impossible : ${String(e)}`);
    } finally {
      if (seq === loadSeq.current) setLoaded(true);
    }
  }, []);

  /**
   * Donne à la fenêtre la hauteur réelle du contenu. La feuille de style reste la seule source
   * des dimensions : rien n'est recalculé ici. Un seul appel à Rust par CHANGEMENT de hauteur.
   */
  const syncHeight = useCallback(() => {
    const height = rootRef.current?.offsetHeight;
    if (height === undefined || height === lastHeight.current) return;
    lastHeight.current = height;
    setPaletteHeight(height);
  }, []);

  // Après chaque rendu, avant l'affichage : la fenêtre suit le contenu sans image intermédiaire.
  useLayoutEffect(syncHeight);

  /** À chaque affichage : champ vidé, sélection remise au premier résultat, données rechargées. */
  const onShown = useCallback(() => {
    // Rust vient de rouvrir la fenêtre réduite à la barre : la hauteur est à renvoyer, même si
    // le contenu n'a pas changé depuis le dernier affichage (message de chargement, par exemple).
    lastHeight.current = null;
    syncHeight();
    copying.current = false;
    setQuery('');
    setStatus(null);
    setSlot({ entries: null, nav: EMPTY_NAV });
    inputRef.current?.focus();
    if (listRef.current) listRef.current.scrollTop = 0;
    void reload();
  }, [reload, syncHeight]);

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
  const loadError = readError ?? catalogError;
  const trimmed = query.trim();

  const hasResults = entries.length > 0;

  // Information courte affichée DANS la barre, à droite : elle n'agrandit jamais la fenêtre.
  // Sans résultat, il n'y a pas de pied : l'état d'une copie (échec) s'affiche donc ici.
  let barInfo: Status = null;
  if (!hasResults) {
    if (status) barInfo = status;
    else if (!loaded) barInfo = { kind: 'warning', text: 'Chargement…' };
    else if (trimmed && !loadError) barInfo = { kind: 'warning', text: 'Aucun résultat' };
  }

  return (
    <div ref={rootRef} className="palette">
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
        {barInfo && (
          <span className={`palette__bar-info${status ? ` is-${barInfo.kind}` : ''}`} title={barInfo.text}>
            {barInfo.text}
          </span>
        )}
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

      {/* Région annoncée par les lecteurs d'écran : toujours présente, contenu seul variable. */}
      <span className="palette__sr" role="status" aria-live="polite">
        {status?.text ?? barInfo?.text ?? ''}
      </span>
      {hasResults && (
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
      )}
    </div>
  );
}
