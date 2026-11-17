import { useCallback, useEffect, useRef, useState } from 'react';
import { buildDictionary, EMPTY_DICTIONARY, type AliasDictionary } from '../features/aliases/aliases';
import { formatValidationErrors, type Destination } from '../features/catalog/schema';
import type { VariantKind } from '../features/commands/cardParts';
import { DEFAULT_VARIANT } from '../features/palette/entries';
import { textFingerprint } from '../features/palette/fingerprint';
import { errorText } from '../lib/errors';
import { initImages } from '../lib/tauri/images';
import { onStoreChanged } from '../lib/tauri/palette';
import {
  DEFAULT_ALIASES,
  loadFavorites,
  loadPaletteSettings,
  parseAliasesText,
  parseCatalogText,
  readStoreText,
  type StoreName,
} from '../lib/tauri/storeRead';

/** Fichiers relus par la palette. */
type PaletteStore = Extract<StoreName, 'catalog' | 'aliases' | 'favorites' | 'settings'>;
const PALETTE_STORES: readonly PaletteStore[] = ['catalog', 'aliases', 'favorites', 'settings'];
const isPaletteStore = (name: string): name is PaletteStore => (PALETTE_STORES as readonly string[]).includes(name);

/** Vrai si les deux ensembles ont les mêmes éléments. */
function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

const loadErrorText = (e: unknown) => `Chargement impossible : ${errorText(e)}`;

export interface PaletteData {
  destinations: readonly Destination[];
  favorites: ReadonlySet<string>;
  dictionary: AliasDictionary;
  /** Réglage « variante sélectionnée par défaut » (issue n°11). */
  defaultVariant: VariantKind;
  /** Premier chargement terminé (réussi ou non). */
  loaded: boolean;
  /** Échec du dernier chargement, sinon catalogue invalide, sinon `null`. */
  loadError: string | null;
  /** Relit les quatre fichiers (montage, chaque affichage). */
  reload: () => Promise<void>;
}

/**
 * Données de la palette : catalogue, alias, favoris et réglage de variante, lus en lecture seule.
 * Chaque fichier écrit par la fenêtre principale (`store:changed`) est relu tout de suite,
 * palette masquée comprise, pour que la prochaine ouverture n'ait rien à reconstruire.
 *
 * Un catalogue ou des alias dont l'empreinte n'a pas changé ne sont ni revalidés ni réindexés :
 * l'état, donc l'index de recherche et les parcours analysés, est réutilisé tel quel. Un
 * changement de favoris ou de variante ne touche pas aux destinations ni au dictionnaire.
 */
export function usePaletteData(): PaletteData {
  const [destinations, setDestinations] = useState<readonly Destination[]>([]);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const [dictionary, setDictionary] = useState<AliasDictionary>(EMPTY_DICTIONARY);
  const [defaultVariant, setDefaultVariant] = useState<VariantKind>(DEFAULT_VARIANT);
  const [loaded, setLoaded] = useState(false);
  /** Catalogue invalide : conservée tant que le texte du fichier ne change pas. */
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** Échec du dernier chargement : effacée dès qu'un chargement réussit. */
  const [readError, setReadError] = useState<string | null>(null);
  const loadSeq = useRef(0);
  /** Dernière lecture lancée par fichier : seule la plus récente s'applique. */
  const storeSeq = useRef<Record<PaletteStore, number>>({ catalog: 0, aliases: 0, favorites: 0, settings: 0 });
  /** Empreintes des fichiers au dernier chargement. */
  const catalogPrint = useRef<string | null>(null);
  const aliasesPrint = useRef<string | null>(null);

  /** Relit un fichier. Lève si la lecture du catalogue ou des alias échoue. */
  const loadStore = useCallback(async (name: PaletteStore) => {
    const seq = ++storeSeq.current[name];
    const stale = () => seq !== storeSeq.current[name];
    switch (name) {
      case 'catalog': {
        const text = await readStoreText('catalog');
        const print = textFingerprint(text);
        if (stale() || print === catalogPrint.current) return;
        catalogPrint.current = print;
        const catalog = parseCatalogText(text);
        if (catalog.ok) {
          setDestinations(catalog.catalog.destinations);
          setCatalogError(null);
        } else {
          setCatalogError(`Catalogue invalide : ${formatValidationErrors(catalog.errors, ' · ')}`);
        }
        return;
      }
      case 'aliases': {
        const text = await readStoreText('aliases');
        const print = textFingerprint(text);
        if (stale() || print === aliasesPrint.current) return;
        aliasesPrint.current = print;
        // Fichier illisible : les alias fournis restent utilisés (la rubrique Alias signale l'erreur).
        setDictionary(buildDictionary(DEFAULT_ALIASES, parseAliasesText(text).user));
        return;
      }
      case 'favorites': {
        const favs = await loadFavorites();
        if (!stale()) setFavorites((prev) => (sameSet(prev, favs) ? prev : favs));
        return;
      }
      case 'settings': {
        const settings = await loadPaletteSettings();
        if (!stale()) setDefaultVariant(settings.defaultVariant);
        return;
      }
    }
  }, []);

  // Seul le dernier chargement complet signale son état.
  const reload = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      await Promise.all([...PALETTE_STORES.map(loadStore), initImages()]);
      if (seq === loadSeq.current) setReadError(null);
    } catch (e) {
      if (seq === loadSeq.current) setReadError(loadErrorText(e));
    } finally {
      if (seq === loadSeq.current) setLoaded(true);
    }
  }, [loadStore]);

  useEffect(
    () =>
      onStoreChanged((name) => {
        if (!isPaletteStore(name)) return;
        loadStore(name).catch((e: unknown) => setReadError(loadErrorText(e)));
      }),
    [loadStore],
  );

  return {
    destinations,
    favorites,
    dictionary,
    defaultVariant,
    loaded,
    loadError: readError ?? catalogError,
    reload,
  };
}
