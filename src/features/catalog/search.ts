/**
 * Filtre de la grille (cahier des charges §7). Fonctions pures.
 *
 * Façade du moteur : la normalisation est dans `searchText.ts`, l'index et le classement dans
 * `searchIndex.ts`. La grille (filtre) et la palette (classement, `searchIndexRank`) passent
 * par le même index.
 */
import { EMPTY_DICTIONARY, type AliasDictionary } from '../aliases/aliases';
import type { Category, Destination } from './schema';
import { getSearchIndex, searchIndexMatch } from './searchIndex';

export type ViewFilter = 'all' | 'favorites' | Category;

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
  // La vue est passée à la recherche : une correspondance exacte hors de l'onglet courant ne
  // doit pas empêcher la seconde passe, tolérante aux fautes, dans cet onglet.
  const matches = searchIndexMatch(index, query, { accept: view === 'all' ? undefined : inView });

  // `byRank` est déjà trié (`sortOrder` puis nom) : aucun tri par frappe.
  const result: Destination[] = [];
  for (const doc of index.byRank) {
    const d = index.docs[doc];
    if (d && inView(d) && (matches === null || matches.has(d))) result.push(d);
  }
  return result;
}
