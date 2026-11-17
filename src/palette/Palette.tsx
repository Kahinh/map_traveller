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
import { Keys } from '../components/Keys';
import {
  buildPaletteIndex,
  PALETTE_LIMIT,
  searchPalette,
  variantShortLabel,
  type PaletteEntry,
  type PaletteSearchResult,
} from '../features/palette/entries';
import { createCopyGate, enterChoice, variantText, type CopyChoice } from '../features/palette/enter';
import { navReducer, type NavAction, type NavState } from '../features/palette/navigation';
import { heightToSend, PALETTE_BAR_HEIGHT, PALETTE_VISIBLE_ROWS } from '../features/palette/windowHeight';
import { DEFAULT_ZAAPS } from '../features/zaaps/defaultZaaps';
import { errorText } from '../lib/errors';
import { copyText } from '../lib/tauri/clipboard';
import { forgetMissingThumbs } from '../lib/tauri/images';
import { hidePalette, onPaletteHidden, onPaletteShown, setPaletteHeight } from '../lib/tauri/palette';
import { perf } from './perf';
import { PaletteRow } from './PaletteRow';
import { usePaletteData } from './usePaletteData';

const LIST_ID = 'palette-list';
const optionId = (i: number) => `palette-opt-${i}`;

/**
 * Lignes rendues avant tout défilement : les visibles (`PALETTE_VISIBLE_ROWS`) et cette marge.
 * Les suivantes sont remplacées par un espace de même hauteur (barre de défilement juste, aucun
 * saut) et rendues au premier défilement, ou au fil de la flèche bas.
 */
const ROW_MARGIN = 4;

/** Message d'état ; `detail` (infobulle) garde le texte technique d'un échec. */
type Status = { kind: 'copied' | 'warning'; text: string; detail?: string } | null;

/**
 * État de navigation rattaché à la liste de résultats pour laquelle il a été calculé. Quand
 * la liste change (frappe, rechargement), l'état est dérivé par l'action `results` pendant le
 * rendu, sans effet ni rendu intermédiaire (premier résultat sélectionné, étape 1).
 */
interface NavSlot {
  entries: readonly PaletteEntry[] | null;
  nav: NavState;
}

const EMPTY_SLOT: NavSlot = { entries: null, nav: { index: -1, choice: 0 } };
/** Champ vide : la barre seule, aucune ligne (objet stable : la navigation n'est pas recalculée). */
const NO_RESULT: PaletteSearchResult = { entries: [], notice: null };

/** Une case par variante ; une ligne sans variante compte une case (rien à copier). */
const choiceCountsOf = (entries: readonly PaletteEntry[]) => entries.map((e) => Math.max(1, e.variants.length));

/**
 * Palette de recherche globale. Le focus reste toujours dans le champ. Une ligne par étape ;
 * sur une ligne à deux variantes (avec / sans Zaap, issue n°11), ←/→ choisissent la variante,
 * Entrée / clic gauche copie la variante active, Ctrl+Entrée / clic droit l'autre. Copie
 * d'abord, masque ensuite, et seulement si la copie a réussi. Aucun minuteur : au repos, rien
 * ne tourne.
 *
 * Cycle : au MONTAGE (palette préchargée et masquée au lancement), elle lit les fichiers et
 * construit son index (`onPaletteShown` appelle aussi son rappel une fois à l'abonnement) ; à
 * chaque ÉCRITURE d'un fichier (`store:changed`), elle relit ce fichier et réindexe, même
 * masquée ; au MASQUAGE (`palette:hidden`), la page se remet à zéro (champ, état, défilement,
 * barre seule) pendant que la fenêtre est invisible ; à l'AFFICHAGE (`palette:shown`), elle
 * prend le focus et relit les fichiers, sans toucher au champ : la première image montre déjà
 * la barre vide, et une frappe faite avant l'événement n'est pas perdue. Cette relecture n'est
 * qu'un filet (fichier modifié à la main) : empreinte inchangée, rien n'est réindexé.
 *
 * Entrée agit sur la valeur du champ au moment de la touche, jamais sur des résultats en retard
 * (`enterChoice`) : « rdv » + Entrée tapés plus vite que le rendu copient bien « rdv ».
 *
 * Compacte (issue n°19) : champ vide ou aucun résultat, seule la barre est rendue ; sinon les
 * lignes et le pied d'aide s'ajoutent dessous. La FENÊTRE prend la hauteur de ce contenu
 * (`setPaletteHeight`) : mesurée une fois par rendu, envoyée seulement quand elle change
 * (`heightToSend`).
 */
export function Palette() {
  const { destinations, favorites, dictionary, defaultVariant, loaded, loadError, reload } = usePaletteData();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [slot, setSlot] = useState<NavSlot>(EMPTY_SLOT);
  /** Liste de résultats déjà défilée : toutes ses lignes sont rendues. */
  const [scrolledList, setScrolledList] = useState<readonly PaletteEntry[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [copyGate] = useState(createCopyGate);
  const rootRef = useRef<HTMLDivElement>(null);
  /** Hauteur actuelle de la fenêtre ; `null` : inconnue, à renvoyer au prochain rendu. */
  const windowHeight = useRef<number | null>(PALETTE_BAR_HEIGHT);
  /** Dernière position écran du pointeur vue sur la liste. */
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  // Index construit une fois par catalogue ou dictionnaire chargé (ni à chaque affichage, ni
  // quand les favoris ou le réglage de variante changent) ; à chaque frappe, seul le dernier
  // mot tapé est recherché, et les lignes déjà fabriquées sont reprises de l'index.
  const index = useMemo(() => buildPaletteIndex(destinations, dictionary, DEFAULT_ZAAPS), [destinations, dictionary]);
  const hasQuery = query.trim() !== '';
  /** Recherche synchrone avec les options de l'affichage : rendu, et Entrée en avance sur le rendu. */
  const search = useCallback(
    (q: string) => searchPalette(index, q, { limit: PALETTE_LIMIT, favorites, defaultVariant }),
    [index, favorites, defaultVariant],
  );
  const { entries, notice } = useMemo(() => {
    if (!hasQuery) return NO_RESULT;
    const result = search(query);
    perf?.mark('search_done');
    return result;
  }, [search, query, hasQuery]);
  const choiceCounts = useMemo(() => choiceCountsOf(entries), [entries]);
  /** Catégorie par destination, pour l'icône des vignettes sans image : une fois par catalogue. */
  const categoryOf = useMemo(() => new Map(destinations.map((d) => [d.id, d.category])), [destinations]);

  const nav = slot.entries === entries ? slot.nav : navReducer(slot.nav, { type: 'results' }, choiceCounts);
  const selected = nav.index >= 0 ? entries[nav.index] : undefined;

  // Derniers résultats, lus par les rappels stables (lignes mémoïsées : rappels inchangés d'une
  // frappe à l'autre).
  const latest = useRef({ entries, choiceCounts });
  useLayoutEffect(() => {
    latest.current = { entries, choiceCounts };
  }, [entries, choiceCounts]);

  const dispatch = useCallback((action: NavAction) => {
    setSlot((prev) => {
      const { entries: current, choiceCounts: counts } = latest.current;
      const base = prev.entries === current ? prev.nav : navReducer(prev.nav, { type: 'results' }, counts);
      const next = navReducer(base, action, counts);
      return prev.entries === current && next === prev.nav ? prev : { entries: current, nav: next };
    });
  }, []);

  /**
   * Donne à la fenêtre la hauteur réelle du contenu. La feuille de style reste la seule source
   * des dimensions : rien n'est recalculé ici. Un seul appel à Rust par CHANGEMENT de hauteur.
   */
  const syncHeight = useCallback(() => {
    const height = heightToSend(rootRef.current?.offsetHeight, windowHeight.current);
    if (height === null) return;
    windowHeight.current = height;
    setPaletteHeight(height);
  }, []);

  // Après chaque rendu, avant l'affichage : la fenêtre suit le contenu sans image intermédiaire.
  useLayoutEffect(syncHeight);

  // Résultats de la frappe en place dans le DOM (instrumentation, désactivée en production).
  useLayoutEffect(() => {
    perf?.mark('results_rendered');
  }, [query, entries]);

  /** Masquée : tout revient à la barre vide, hors de la vue de l'utilisateur. */
  const onHidden = useCallback(() => {
    // Hauteur inconnue : le rendu de la barre seule l'enverra, fenêtre encore masquée.
    windowHeight.current = null;
    setQuery('');
    setStatus(null);
    setSlot(EMPTY_SLOT);
    setScrolledList(null);
    if (listRef.current) listRef.current.scrollTop = 0;
    // Plus de curseur clignotant dans une fenêtre invisible.
    inputRef.current?.blur();
  }, []);

  /** Affichée : la page est déjà remise à zéro ; focus et données fraîches. */
  const onShown = useCallback(() => {
    perf?.mark('palette_shown');
    // Rust vient de rouvrir la fenêtre réduite à la barre. Un contenu plus haut (message de
    // chargement en échec, par exemple) est renvoyé ; sinon, rien.
    windowHeight.current = PALETTE_BAR_HEIGHT;
    syncHeight();
    copyGate.release();
    // Vignettes fabriquées entre-temps par la fenêtre principale : retentées une fois.
    forgetMissingThumbs();
    inputRef.current?.focus();
    perf?.mark('palette_focused');
    void reload();
  }, [reload, syncHeight, copyGate]);

  useEffect(() => onPaletteShown(onShown), [onShown]);
  useEffect(() => onPaletteHidden(onHidden), [onHidden]);

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

  /**
   * Copie le texte choisi, puis masque la palette. Une seule copie à la fois (`copyGate`) : une
   * seconde Entrée ou un double clic pendant la copie ne copie rien de plus.
   */
  const copyChoice = useCallback(async ({ entry, text }: CopyChoice) => {
    if (text === null) {
      setStatus({
        kind: 'warning',
        text: entry.kind === 'farm-step' ? 'Fin de parcours : rien à copier' : 'Aucune commande à copier',
      });
      return;
    }
    if (!copyGate.acquire()) return;
    try {
      await copyText(text);
      perf?.mark('clipboard_done');
    } catch (e) {
      copyGate.release();
      setStatus({ kind: 'warning', text: 'Copie impossible, réessayez', detail: errorText(e) });
      return; // la palette reste ouverte : rien n'a été copié
    }
    // Visible seulement si le masquage tarde ou échoue (et dans le navigateur) : la page est
    // remise à zéro dès `palette:hidden`, avant qu'un lecteur d'écran ait pu l'annoncer.
    setStatus({ kind: 'copied', text: `Copié : ${text}` });
    try {
      await hidePalette();
    } catch (e) {
      setStatus({ kind: 'warning', text: 'Copié, mais fermeture impossible', detail: errorText(e) });
    } finally {
      copyGate.release();
    }
  }, [copyGate]);

  /** Clic sur une ligne : variante `choice` de la ligne `i` (l'autre si `alternate` : clic droit). */
  const activate = useCallback(
    (i: number, choice: number, alternate: boolean) => {
      const entry = latest.current.entries[i];
      if (entry) void copyChoice({ entry, text: variantText(entry, choice, alternate) });
    },
    [copyChoice],
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

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    perf?.mark('input_received');
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
        // Interceptées uniquement sur une ligne à deux variantes (sinon : curseur de texte).
        if (modified || !selected || selected.variants.length < 2) return;
        e.preventDefault();
        dispatch({ type: e.key === 'ArrowRight' ? 'choice-next' : 'choice-prev' });
        return;
      case 'Enter': {
        e.preventDefault();
        // Touche maintenue : une seule copie.
        if (e.repeat) return;
        perf?.mark('enter_received');
        // Valeur du champ à cet instant, et résultats affichés avec leur requête : si le rendu est
        // en retard sur la frappe, la recherche est refaite ici, sur ce qui est tapé.
        const chosen = enterChoice(e.currentTarget.value, { query, entries }, nav, e.ctrlKey || e.metaKey, (q) =>
          search(q).entries,
        );
        if (chosen) void copyChoice(chosen);
        return;
      }
      case 'Escape':
        e.preventDefault();
        void hidePalette().catch((err: unknown) =>
          setStatus({ kind: 'warning', text: 'Fermeture impossible', detail: errorText(err) }),
        );
        return;
      case 'Tab':
        e.preventDefault(); // le focus reste dans le champ
        return;
    }
  };

  // Ligne à deux variantes : ←/→ et Ctrl+Entrée, libellés de la variante active et de l'autre.
  const variants = selected?.variants ?? [];
  const twoVariants = selected !== undefined && variants.length === 2;
  const activeIdx = twoVariants ? Math.min(nav.choice, 1) : 0;
  const enterLabel = twoVariants ? variantShortLabel(variants[activeIdx]!.kind) : 'copier';
  const otherLabel = twoVariants ? variantShortLabel(variants[1 - activeIdx]!.kind) : '';
  const trimmed = query.trim();

  const hasResults = entries.length > 0;
  // Lignes rendues : les visibles et une marge, la sélection toujours comprise ; toutes une fois
  // la liste défilée. Le reste est un espace de même hauteur (lignes de hauteur fixe).
  const rendered =
    scrolledList === entries
      ? entries.length
      : Math.min(entries.length, Math.max(PALETTE_VISIBLE_ROWS, nav.index + 1) + ROW_MARGIN);
  const rest = entries.length - rendered;
  const onScroll = () => {
    if (rest > 0) setScrolledList(entries);
  };

  // Information courte affichée DANS la barre, à droite : elle n'agrandit jamais la fenêtre.
  // Sans résultat, il n'y a pas de pied : l'état d'une copie (échec) s'affiche donc ici.
  let barInfo: Status = null;
  if (!hasResults) {
    if (status) barInfo = status;
    else if (!loaded) barInfo = { kind: 'warning', text: 'Chargement…' };
    // Sans résultat, le message tient dans la barre : la fenêtre reste réduite à la barre.
    else if (notice && !loadError) barInfo = { kind: 'warning', text: notice };
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
          placeholder="Rechercher, ou proche -20,-20 pour le zaap le plus proche"
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
          <span className={`palette__bar-info${status ? ` is-${barInfo.kind}` : ''}`} title={barInfo.detail ?? barInfo.text}>
            {barInfo.text}
          </span>
        )}
      </div>

      {(loadError || (notice && hasResults)) && (
        <p className={`palette__notice${loadError ? ' is-error' : ''}`}>{loadError ?? notice}</p>
      )}

      <ul
        ref={listRef}
        id={LIST_ID}
        className="palette__list"
        role="listbox"
        aria-label="Résultats"
        onScroll={onScroll}
      >
        {entries.slice(0, rendered).map((entry, i) => (
          <PaletteRow
            key={entry.key}
            entry={entry}
            category={categoryOf.get(entry.destinationId) ?? null}
            index={i}
            count={entries.length}
            id={optionId(i)}
            selected={i === nav.index}
            activeChoice={i === nav.index ? nav.choice : null}
            onHover={onHover}
            onActivate={activate}
          />
        ))}
        {rest > 0 && (
          <li role="presentation" aria-hidden style={{ height: `calc(var(--pal-row-h) * ${rest})` }} />
        )}
      </ul>

      {/* Région annoncée par les lecteurs d'écran : toujours présente, contenu seul variable. */}
      <span className="palette__sr" role="status" aria-live="polite">
        {status?.text ?? barInfo?.text ?? ''}
      </span>
      {hasResults && (
        <footer className="palette__hints">
          {status ? (
            <span className={`palette__status is-${status.kind}`} title={status.detail}>
              {status.text}
            </span>
          ) : (
            <>
              <span className="palette__hint">
                <Keys keys={['ArrowUp', 'ArrowDown']} /> naviguer
              </span>
              {twoVariants && (
                <span className="palette__hint">
                  <Keys keys={['ArrowLeft', 'ArrowRight']} /> variante
                </span>
              )}
              <span className="palette__hint">
                <Keys keys={['Entrée']} /> {enterLabel}
              </span>
              {twoVariants && (
                <span className="palette__hint">
                  <Keys keys={['Ctrl', 'Entrée']} combo /> {otherLabel}
                </span>
              )}
              <span className="palette__hint">
                <Keys keys={['Échap']} /> fermer
              </span>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
