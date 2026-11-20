/**
 * Palette de recherche : index et lignes de résultats. Fonctions pures.
 *
 * Aucune règle de copie n'est réécrite ici : les cartes passent par `cardParts` /
 * `partCommand`. Un parcours Farm donne UNE ligne, qui ne copie rien : elle ouvre la fenêtre du
 * parcours, où chaque position se copie une à une. Les commandes sont du texte brut, jamais modifié.
 */
import { EMPTY_DICTIONARY, type AliasDictionary } from '../aliases/aliases';
import type { Destination } from '../catalog/schema';
import { buildSearchIndex, searchIndexRank } from '../catalog/searchIndex';
import { cardParts, orderVariants, partVariants, type PartIndex, type VariantKind } from '../commands/cardParts';
import { parseFarmRoute, type FarmRoute } from '../farm/farmRoute';
import {
  paletteKey,
  subtitleBase,
  VARIANT_LABELS,
  type PaletteEntry,
  type PaletteIndex,
  type PaletteVariantKind,
} from './types';
import {
  DEFAULT_WORLD,
  EMPTY_ZAAPS,
  formatDistance,
  NEAR_EXAMPLE,
  nearestZaaps,
  parseNearQuery,
  zaapTripCommand,
  type MapPosition,
  type NearestZaap,
  type ZaapCatalog,
} from '../zaaps/zaaps';

export type { PaletteEntry, PaletteVariantKind } from './types';

/** Nombre maximal de lignes affichées (pas de virtualisation). */
export const PALETTE_LIMIT = 50;

/** Nom de chaque étape d'une carte à deux étapes, en fin de sous-titre. */
export const STEP_NAMES: Record<PartIndex, string> = {
  1: 'accès',
  2: 'sur place',
};

/** Variante sélectionnée par défaut (réglage absent) : le comportement d'avant l'issue n°11. */
export const DEFAULT_VARIANT: VariantKind = 'withoutZaap';

const NO_FAVORITES: ReadonlySet<string> = new Set();

/**
 * Index de la palette : destinations actives seulement, index de recherche construit avec le
 * dictionnaire d'alias, et chaque parcours Farm analysé une seule fois ici (jamais pendant la
 * frappe). Ni favoris ni variante préférée : ils sont donnés à chaque recherche.
 */
export function buildPaletteIndex(
  destinations: readonly Destination[],
  dictionary: AliasDictionary = EMPTY_DICTIONARY,
  zaaps: ZaapCatalog = EMPTY_ZAAPS,
): PaletteIndex {
  const search = buildSearchIndex(destinations, dictionary);
  const routes = new Map<string, FarmRoute>();
  for (const d of search.docs) {
    if (d.category === 'farm') routes.set(d.id, parseFarmRoute(d.command));
  }
  return { search, routes, zaaps, cache: new Map() };
}

/**
 * Lignes d'une carte PNJ / Donjon / Lieu-dit (issue n°11) : UNE LIGNE PAR ÉTAPE (`cardParts`),
 * dans l'ordre. Chaque ligne porte ses propres variantes (`partVariants`), la variante préférée
 * en premier. Le nombre d'étapes vient des données, jamais d'une constante.
 */
export function cardEntries(d: Destination, favorite: boolean, defaultVariant: VariantKind = DEFAULT_VARIANT): PaletteEntry[] {
  const parts = cardParts(d);
  const split = parts.length > 1;
  return parts.map((part) => ({
    key: split ? paletteKey(d.id, 'card', part.index) : paletteKey(d.id, 'card'),
    kind: 'card',
    destinationId: d.id,
    title: d.name,
    step: split ? { index: part.index, count: parts.length } : null,
    subtitle: split ? `${subtitleBase(d)} · ${STEP_NAMES[part.index]}` : subtitleBase(d),
    image: d.image,
    favorite,
    variants: orderVariants(partVariants(part), defaultVariant),
  }));
}

/**
 * Ligne d'un zaap proposé pour la position tapée. Deux variantes, dans cet ordre quel que soit
 * le réglage : le trajet complet (zaap puis `/travel` vers la position), puis la commande du
 * zaap seule. Position sur le zaap : une seule variante.
 */
function zaapEntry(near: NearestZaap, target: MapPosition): PaletteEntry {
  const { zaap, distance } = near;
  const trip = zaapTripCommand(zaap, target);
  return {
    key: paletteKey(zaap.id, 'zaap'),
    kind: 'zaap',
    destinationId: zaap.id,
    title: zaap.name,
    step: null,
    subtitle: `${formatDistance(distance)} · Zaap ${zaap.x},${zaap.y} · ${zaap.zone}`,
    image: null,
    favorite: false,
    variants:
      trip === zaap.command
        ? [{ kind: 'trip', text: trip }]
        : [
            { kind: 'trip', text: trip },
            { kind: 'zaapOnly', text: zaap.command },
          ],
  };
}

/**
 * Recherche « proche X,Y » (issue n°7) : les zaaps les plus proches, ou un message court.
 * `null` si la requête n'est pas une recherche de zaap.
 */
function searchNearestZaap(zaaps: ZaapCatalog, query: string): PaletteSearchResult | null {
  const near = parseNearQuery(query, zaaps.worlds);
  switch (near.kind) {
    case 'none':
      return null;
    case 'incomplete':
      return { entries: [], notice: `Position attendue : ${NEAR_EXAMPLE}` };
    case 'invalid':
      return { entries: [], notice: near.message };
  }
  const world = near.world?.id ?? DEFAULT_WORLD;
  const found = nearestZaaps(zaaps.zaaps, near.position, world);
  if (found.length === 0) {
    const name = near.world?.name ?? zaaps.worlds.find((w) => w.id === world)?.name ?? world;
    return { entries: [], notice: `Aucun zaap répertorié dans ${name}` };
  }
  return { entries: found.map((n) => zaapEntry(n, near.position)), notice: null };
}

/** Libellé d'une variante : infobulle et lecteur d'écran. */
export const variantLabel = (kind: PaletteVariantKind): string => VARIANT_LABELS[kind].long;

/** Libellé court d'une variante : pied d'aide (« sans Zaap », « trajet complet »…). */
export const variantShortLabel = (kind: PaletteVariantKind): string => VARIANT_LABELS[kind].short;

export interface PaletteSearchResult {
  entries: PaletteEntry[];
  /** Message à afficher au-dessus des résultats (position tapée absente), ou `null`. */
  notice: string | null;
}

export interface PaletteSearchOptions {
  /** Nombre maximal de lignes. */
  limit: number;
  /** Favoris actuels : classement et étoile. */
  favorites?: ReadonlySet<string>;
  /** Variante sélectionnée par défaut (réglage, issue n°11). */
  defaultVariant?: VariantKind;
}

/**
 * Lignes d'une destination, prises dans le cache de l'index si elles ont été fabriquées avec
 * le même favori et la même variante préférée : même objet d'une frappe à l'autre.
 */
function cachedEntries(
  index: PaletteIndex,
  key: string,
  favorite: boolean,
  variant: VariantKind | null,
  make: () => readonly PaletteEntry[],
): readonly PaletteEntry[] {
  const hit = index.cache.get(key);
  if (hit && hit.favorite === favorite && hit.variant === variant) return hit.entries;
  const entries = make();
  index.cache.set(key, { favorite, variant, entries });
  return entries;
}

/**
 * Ligne d'un parcours Farm : aucune variante à copier, son activation ouvre la fenêtre du
 * parcours (`Palette`). Le sous-titre donne le nombre de positions.
 */
export function farmEntry(d: Destination, route: FarmRoute, favorite: boolean): PaletteEntry {
  const n = route.steps.length;
  const count = n === 0 ? 'aucune position' : `${n} position${n > 1 ? 's' : ''}`;
  const check = route.issues.length > 0 ? ' · parcours à vérifier' : '';
  return {
    key: paletteKey(d.id, 'farm'),
    kind: 'farm',
    destinationId: d.id,
    title: d.name,
    step: null,
    subtitle: `${subtitleBase(d)} · ${count}${check}`,
    image: d.image,
    favorite,
    variants: [],
  };
}

/**
 * Recherche classée (`searchIndexRank`) : une ligne par étape pour une carte, une seule ligne
 * par parcours Farm. Les lignes sont fabriquées dans l'ordre d'affichage, sans doublon, et la
 * fabrication s'arrête au plafond `limit` : une requête d'une lettre ne construit pas les lignes
 * de tout le catalogue.
 */
export function searchPalette(index: PaletteIndex, query: string, options: PaletteSearchOptions): PaletteSearchResult {
  const limit = Math.max(0, options.limit);
  const favorites = options.favorites ?? NO_FAVORITES;
  const defaultVariant = options.defaultVariant ?? DEFAULT_VARIANT;

  // « proche X,Y » : recherche du zaap le plus proche, exclusive des autres résultats.
  const zaapResult = searchNearestZaap(index.zaaps, query);
  if (zaapResult) return { entries: zaapResult.entries.slice(0, limit), notice: zaapResult.notice };

  const { routes } = index;
  const entries: PaletteEntry[] = [];
  const add = (lines: readonly PaletteEntry[]) => {
    for (const e of lines) {
      if (entries.length >= limit) return;
      entries.push(e);
    }
  };
  const isFav = (d: Destination) => favorites.has(d.id);

  for (const d of searchIndexRank(index.search, query, favorites)) {
    if (entries.length >= limit) break;
    if (d.category !== 'farm') {
      add(cachedEntries(index, paletteKey(d.id, 'card'), isFav(d), defaultVariant, () =>
        cardEntries(d, isFav(d), defaultVariant),
      ));
      continue;
    }
    const route = routes.get(d.id);
    if (route) add(cachedEntries(index, paletteKey(d.id, 'farm'), isFav(d), null, () => [farmEntry(d, route, isFav(d))]));
  }
  return { entries, notice: null };
}
