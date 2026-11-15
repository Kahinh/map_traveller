/**
 * Recherche, filtrage et tri du catalogue (cahier des charges §7). Fonctions pures.
 *
 * Façade du moteur : la normalisation est dans `searchText.ts`, l'index et le classement dans
 * `searchIndex.ts`. La grille (filtre) et la palette (classement) passent par le même index.
 */
import { EMPTY_DICTIONARY, type AliasDictionary } from '../aliases/aliases';
import type { Category, Destination } from './schema';
import { getSearchIndex, searchIndexMatch, searchIndexRank } from './searchIndex';
import { isWordlessQuery, queryTokens } from './searchText';

export { compareDestinations } from './searchIndex';
export { normalizeText } from './searchText';

export type ViewFilter = 'all' | 'favorites' | Category;

/** Mots utiles d'une requête : normalisés, sans doublon ni mot de liaison (`queryTokens`). */
export const queryWords = queryTokens;

/**
 * Destinations actives correspondant à la requête, classées par pertinence, puis favoris
 * d'abord, puis `compareDestinations`. Requête vide : toutes, favoris d'abord.
 */
export function rankDestinations(
  destinations: readonly Destination[],
  query: string,
  favorites: ReadonlySet<string>,
  dictionary: AliasDictionary = EMPTY_DICTIONARY,
): Destination[] {
  return searchIndexRank(getSearchIndex(destinations, dictionary), query, favorites);
}

/**
 * Filtre et trie les destinations visibles (grille) : mêmes correspondances que la palette,
 * mais dans l'ordre du catalogue (`sortOrder` puis nom).
 */
export function filterDestinations(
  destinations: readonly Destination[],
  view: ViewFilter,
  query: string,
  favorites: ReadonlySet<string>,
  dictionary: AliasDictionary = EMPTY_DICTIONARY,
): Destination[] {
  const inView = (d: Destination) =>
    view === 'all' || (view === 'favorites' ? favorites.has(d.id) : d.category === view);
  const index = getSearchIndex(destinations, dictionary);
  // Requête vide : tout ; ponctuation seule : rien (`searchIndexMatch` renvoie un ensemble vide).
  const matches = queryTokens(query).length === 0 && !isWordlessQuery(query) ? null : searchIndexMatch(index, query);

  // `byRank` est déjà trié (`sortOrder` puis nom) : aucun tri par frappe.
  const result: Destination[] = [];
  for (const doc of index.byRank) {
    const d = index.docs[doc];
    if (d && inView(d) && (matches === null || matches.has(d))) result.push(d);
  }
  return result;
}
