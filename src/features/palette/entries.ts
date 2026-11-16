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
import { cardParts, partCommand, type PartIndex } from '../commands/cardParts';
import { parseFarmRoute, type FarmRoute } from '../farm/farmRoute';
import {
  farmPositionEntries,
  farmRouteEntries,
  farmStartEntry,
  formatPosition,
  parsePaletteQuery,
} from './farmQuery';
import { paletteKey, subtitleBase, type PaletteEntry, type PaletteIndex } from './types';

export type { PaletteChoice, PaletteEntry, PaletteEntryKind, PaletteIndex } from './types';

/** Nombre maximal de lignes affichées (pas de virtualisation). */
export const PALETTE_LIMIT = 50;

/** Libellés des étapes d'une carte à deux étapes : le passage entre les deux reste manuel. */
export const STEP_HINTS: Record<PartIndex, string> = {
  1: 'Étape 1 : accès',
  2: 'Étape 2 : sur place',
};

/**
 * Index de la palette : destinations actives seulement, index de recherche construit avec le
 * dictionnaire d'alias, et chaque parcours Farm analysé une seule fois ici (jamais pendant la
 * frappe).
 */
export function buildPaletteIndex(
  destinations: readonly Destination[],
  favorites: ReadonlySet<string>,
  dictionary: AliasDictionary = EMPTY_DICTIONARY,
): PaletteIndex {
  const search = buildSearchIndex(destinations, dictionary);
  const active = search.docs;
  const routes = new Map<string, FarmRoute>();
  for (const d of active) {
    if (d.category === 'farm') routes.set(d.id, parseFarmRoute(d.command));
  }
  return { destinations: active, favorites, search, routes };
}

/**
 * Ligne d'une carte PNJ / Donjon / Lieu-dit : un choix par zone de copie (`cardParts`),
 * donc une seule ligne et deux choix pour une carte à deux étapes.
 */
export function cardEntry(d: Destination, favorite: boolean): PaletteEntry {
  const parts = cardParts(d);
  const split = parts.length > 1;
  return {
    key: paletteKey(d.id, 'card'),
    kind: 'card',
    destinationId: d.id,
    title: d.name,
    subtitle: subtitleBase(d),
    image: d.image,
    favorite,
    choices: parts.map((part) => ({
      label: split ? String(part.index) : '',
      hint: split ? STEP_HINTS[part.index] : '',
      primary: partCommand(part, 'left'),
      secondary: partCommand(part, 'right'),
    })),
  };
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
  const { routes } = index;
  const isFav = (d: Destination) => favorites.has(d.id);

  // (b) Requête entière prise comme texte.
  const textMatches = searchIndexRank(index.search, query, favorites);
  const hasWords = queryWords(query).length > 0;
  const expand = hasWords && textMatches.filter((d) => d.category === 'farm').length === 1;
  const textEntries: PaletteEntry[] = [];
  for (const d of textMatches) {
    if (d.category !== 'farm') {
      textEntries.push(cardEntry(d, isFav(d)));
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
