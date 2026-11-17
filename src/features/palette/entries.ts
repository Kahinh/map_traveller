/**
 * Palette de recherche : index et lignes de résultats. Fonctions pures.
 *
 * Aucune règle de copie n'est réécrite ici : les cartes passent par `cardParts` /
 * `partCommand`, les parcours Farm par `parseFarmRoute`, `farmStartCommand` et
 * `farmResumeCommand` (via `farmQuery.ts`). Les commandes sont du texte brut, jamais modifié.
 */
import { EMPTY_DICTIONARY, type AliasDictionary } from '../aliases/aliases';
import type { Destination } from '../catalog/schema';
import { queryWords } from '../catalog/search';
import { buildSearchIndex, searchIndexRank } from '../catalog/searchIndex';
import { cardParts, orderVariants, partVariants, type PartIndex, type VariantKind } from '../commands/cardParts';
import { parseFarmRoute, type FarmRoute } from '../farm/farmRoute';
import {
  farmPositionEntries,
  farmRouteEntries,
  farmStartEntry,
  formatPosition,
  parsePaletteQuery,
} from './farmQuery';
import { paletteKey, subtitleBase, type PaletteEntry, type PaletteIndex, type PaletteVariantKind } from './types';
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

export type { PaletteEntry, PaletteEntryKind, PaletteIndex, PaletteStep, PaletteVariant, PaletteVariantKind } from './types';

/** Nombre maximal de lignes affichées (pas de virtualisation). */
export const PALETTE_LIMIT = 50;

/** Nom de chaque étape d'une carte à deux étapes, en fin de sous-titre. */
export const STEP_NAMES: Record<PartIndex, string> = {
  1: 'accès',
  2: 'sur place',
};

/** Variante sélectionnée par défaut (réglage absent) : le comportement d'avant l'issue n°11. */
export const DEFAULT_VARIANT: VariantKind = 'withoutZaap';

/**
 * Index de la palette : destinations actives seulement, index de recherche construit avec le
 * dictionnaire d'alias, et chaque parcours Farm analysé une seule fois ici (jamais pendant la
 * frappe).
 */
export function buildPaletteIndex(
  destinations: readonly Destination[],
  favorites: ReadonlySet<string>,
  dictionary: AliasDictionary = EMPTY_DICTIONARY,
  zaaps: ZaapCatalog = EMPTY_ZAAPS,
  defaultVariant: VariantKind = DEFAULT_VARIANT,
): PaletteIndex {
  const search = buildSearchIndex(destinations, dictionary);
  const active = search.docs;
  const routes = new Map<string, FarmRoute>();
  for (const d of active) {
    if (d.category === 'farm') routes.set(d.id, parseFarmRoute(d.command));
  }
  return { destinations: active, favorites, search, routes, zaaps, defaultVariant };
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
export function zaapEntry(near: NearestZaap, target: MapPosition): PaletteEntry {
  const { zaap, distance } = near;
  const trip = zaapTripCommand(zaap, target);
  return {
    key: paletteKey(zaap.id, 'zaap'),
    kind: 'zaap',
    destinationId: zaap.id,
    title: zaap.name,
    step: null,
    subtitle: `Zaap ${zaap.x},${zaap.y} · ${zaap.zone} · ${formatDistance(distance)}`,
    image: null,
    favorite: false,
    variants:
      trip === zaap.command
        ? [{ kind: 'withZaap', text: trip }]
        : [
            { kind: 'withZaap', text: trip },
            { kind: 'zaapOnly', text: zaap.command },
          ],
  };
}

/**
 * Recherche « proche X,Y » (issue n°7) : les zaaps les plus proches, ou un message court.
 * `null` si la requête n'est pas une recherche de zaap.
 */
export function searchNearestZaap(zaaps: ZaapCatalog, query: string): PaletteSearchResult | null {
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

/** Libellé d'une variante (infobulle, lecteur d'écran, pied d'aide). */
const VARIANT_LABELS: Record<PaletteVariantKind, string> = {
  withoutZaap: 'Sans Zaap : trajet seul',
  withZaap: 'Avec Zaap : commande complète',
  zaapOnly: 'Zaap seul',
};

/** Sur une ligne « zaap le plus proche », la commande complète est le trajet. */
export function variantLabel(entry: Pick<PaletteEntry, 'kind'>, kind: PaletteVariantKind): string {
  if (entry.kind === 'zaap' && kind === 'withZaap') return 'Trajet complet : zaap puis déplacement';
  return VARIANT_LABELS[kind];
}

/** Libellé court du pied d'aide (« avec Zaap », « sans Zaap », « zaap seul », « trajet complet »). */
export function variantShortLabel(entry: Pick<PaletteEntry, 'kind'>, kind: PaletteVariantKind): string {
  if (entry.kind === 'zaap' && kind === 'withZaap') return 'trajet complet';
  return kind === 'withoutZaap' ? 'sans Zaap' : kind === 'withZaap' ? 'avec Zaap' : 'zaap seul';
}

export interface PaletteSearchResult {
  entries: PaletteEntry[];
  /** Message à afficher au-dessus des résultats (position tapée absente), ou `null`. */
  notice: string | null;
}

/** Retire les doublons par clé, en gardant la première occurrence. */
function uniqueByKey(entries: readonly PaletteEntry[]): PaletteEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.key)) return false;
    seen.add(e.key);
    return true;
  });
}

/**
 * Recherche classée. Deux interprétations sont lancées puis fusionnées :
 * (b) la requête entière comme texte (recherche normale, classée par `searchIndexRank`) ;
 * (a) si la requête finit par une position (« farm tremble 2 2 ») et qu'un texte la précède,
 *     les étapes des parcours Farm correspondant au texte qui sont à cette position.
 * Si (a) trouve au moins une étape, ses lignes passent en tête.
 *
 * Parcours Farm en (b) : requête vide ou plusieurs parcours trouvés → une ligne « parcours
 * complet » par parcours ; un seul parcours trouvé → « parcours complet » puis chaque position.
 * Le plafond `limit` s'applique en dernier. `favorites` remplace ceux de l'index : la palette
 * peut ainsi garder son index quand seuls les favoris changent.
 */
export function searchPalette(
  index: PaletteIndex,
  query: string,
  limit: number,
  favorites: ReadonlySet<string> = index.favorites,
): PaletteSearchResult {
  // « proche X,Y » : recherche du zaap le plus proche, exclusive des autres résultats.
  const zaapResult = searchNearestZaap(index.zaaps, query);
  if (zaapResult) return { entries: zaapResult.entries.slice(0, Math.max(0, limit)), notice: zaapResult.notice };

  const { routes } = index;
  const isFav = (d: Destination) => favorites.has(d.id);

  // (b) Requête entière prise comme texte.
  const textMatches = searchIndexRank(index.search, query, favorites);
  const hasWords = queryWords(query).length > 0;
  const expand = hasWords && textMatches.filter((d) => d.category === 'farm').length === 1;
  const textEntries: PaletteEntry[] = [];
  for (const d of textMatches) {
    if (d.category !== 'farm') {
      textEntries.push(...cardEntries(d, isFav(d), index.defaultVariant));
      continue;
    }
    const route = routes.get(d.id);
    if (route) textEntries.push(...farmRouteEntries(d, route, isFav(d), expand));
  }

  // (a) Position en fin de requête, précédée d'un texte.
  const { text, position } = parsePaletteQuery(query);
  const positionEntries: PaletteEntry[] = [];
  const restartEntries: PaletteEntry[] = [];
  let notice: string | null = null;
  if (position && queryWords(text).length > 0) {
    // Restreint aux parcours AVANT la seconde passe : une destination d'une autre catégorie qui
    // correspond exactement ne doit pas empêcher de retrouver un parcours à une faute près.
    const farms = searchIndexRank(index.search, text, favorites, (d) => d.category === 'farm');
    for (const d of farms) {
      const route = routes.get(d.id);
      if (!route) continue;
      const lines = farmPositionEntries(d, route, isFav(d), position);
      // Position absente de ce parcours : « parcours complet » reste proposé.
      if (lines.length > 0) positionEntries.push(...lines);
      else restartEntries.push(farmStartEntry(d, route, isFav(d)));
    }
    if (farms.length > 0 && positionEntries.length === 0) {
      const several = farms.length > 1;
      notice =
        position.y === undefined
          ? `Aucune position ${formatPosition(position)},… dans ${several ? 'les parcours' : 'le parcours'}`
          : `Position ${formatPosition(position)} absente ${several ? 'des parcours' : 'du parcours'}`;
    }
  }

  const ordered =
    positionEntries.length > 0
      ? [...positionEntries, ...textEntries, ...restartEntries]
      : [...textEntries, ...restartEntries];
  return { entries: uniqueByKey(ordered).slice(0, Math.max(0, limit)), notice };
}
