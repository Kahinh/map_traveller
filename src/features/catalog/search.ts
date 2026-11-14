/**
 * Recherche, filtrage et tri du catalogue (cahier des charges §7). Fonctions pures.
 */
import type { Category, Destination } from './schema';

export type ViewFilter = 'all' | 'favorites' | Category;

/** Minuscules, sans accents, espaces compactés : « Mériana » → « meriana ». */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texte indexé d'une destination : nom, alias, tags, zone. */
export function searchHaystack(d: Destination): string {
  return normalizeText([d.name, ...d.aliases, ...d.tags, d.zone].join(' '));
}

/** Comparateur stable : `sortOrder` puis nom (insensible à la casse et aux accents). */
export function compareDestinations(a: Destination, b: Destination): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return normalizeText(a.name).localeCompare(normalizeText(b.name), 'fr');
}

/**
 * Filtre et trie les destinations visibles.
 * Chaque mot de la requête doit apparaître dans le texte indexé (ET logique).
 */
export function filterDestinations(
  destinations: readonly Destination[],
  view: ViewFilter,
  query: string,
  favorites: ReadonlySet<string>,
): Destination[] {
  const words = normalizeText(query).split(' ').filter(Boolean);
  return destinations
    .filter((d) => d.enabled)
    .filter((d) => (view === 'all' ? true : view === 'favorites' ? favorites.has(d.id) : d.category === view))
    .filter((d) => {
      if (words.length === 0) return true;
      const hay = searchHaystack(d);
      return words.every((w) => hay.includes(w));
    })
    .sort(compareDestinations);
}
