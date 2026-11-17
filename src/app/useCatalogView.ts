import { useDeferredValue, useMemo, useState } from 'react';
import { VIEWS } from '../components/CategoryTabs';
import type { AliasDictionary } from '../features/aliases/aliases';
import type { Destination } from '../features/catalog/schema';
import { filterDestinations, type ViewFilter } from '../features/catalog/search';

/**
 * Vue de la grille : onglet, recherche, destinations visibles, nombre par onglet et résultats
 * dans « Tout » quand l'onglet courant n'en a aucun. Un seul moteur de recherche
 * (`filterDestinations`) pour tout.
 */
export function useCatalogView(
  destinations: readonly Destination[],
  favorites: ReadonlySet<string>,
  dictionary: AliasDictionary,
  ready: boolean,
) {
  const [view, setView] = useState<ViewFilter>('all');
  const [query, setQuery] = useState('');
  // La saisie reste fluide sur un gros catalogue : le filtrage suit avec une priorité basse.
  const deferredQuery = useDeferredValue(query);

  const visible = useMemo(
    () => filterDestinations(destinations, view, deferredQuery, favorites, dictionary),
    [destinations, view, deferredQuery, favorites, dictionary],
  );

  // Aucun résultat dans l'onglet courant : combien la même recherche en trouve dans « Tout ».
  // Calculé seulement hors de « Tout » et pour une recherche non vide.
  const allMatches = useMemo(
    () =>
      view !== 'all' && deferredQuery.trim() !== '' && visible.length === 0
        ? filterDestinations(destinations, 'all', deferredQuery, favorites, dictionary).length
        : 0,
    [view, deferredQuery, visible.length, destinations, favorites, dictionary],
  );

  /**
   * Première destination de la vue pour la requête TAPÉE (Entrée dans la recherche) : si le
   * filtrage différé est en retard sur la frappe, la recherche est refaite tout de suite.
   */
  const firstMatch = (): Destination | undefined => {
    if (query.trim() === '') return undefined;
    if (query === deferredQuery) return visible[0];
    return filterDestinations(destinations, view, query, favorites, dictionary)[0];
  };

  // Nombre de destinations par onglet, hors recherche : même filtre que la grille, requête vide.
  const counts = useMemo(
    () =>
      ready
        ? (Object.fromEntries(
            VIEWS.map((v) => [v.id, filterDestinations(destinations, v.id, '', favorites, dictionary).length]),
          ) as Record<ViewFilter, number>)
        : undefined,
    [ready, destinations, favorites, dictionary],
  );

  /**
   * Après un enregistrement : si la vue courante masque la destination, bascule sur sa
   * catégorie et vide la recherche.
   */
  const showDestination = (d: Destination) => {
    if (filterDestinations([d], view, query, favorites, dictionary).length > 0) return;
    setView(d.category);
    setQuery('');
  };

  return { view, setView, query, setQuery, deferredQuery, visible, counts, allMatches, firstMatch, showDestination };
}
