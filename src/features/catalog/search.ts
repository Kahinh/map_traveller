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

/**
 * Texte indexé par destination. Les destinations sont immuables (toute édition crée un
 * nouvel objet) : le cache évite de re-normaliser tout le catalogue à chaque frappe.
 */
const haystackCache = new WeakMap<Destination, string>();

/** Texte indexé d'une destination : nom, alias, tags, zone. */
export function searchHaystack(d: Destination): string {
  let hay = haystackCache.get(d);
  if (hay === undefined) {
    hay = normalizeText([d.name, ...d.aliases, ...d.tags, d.zone].join(' '));
    haystackCache.set(d, hay);
  }
  return hay;
}

/** Insensible à la casse et aux accents ; « Zone 2 » avant « Zone 10 ». */
const nameCollator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Comparateur : `sortOrder` puis nom. Le tri JS étant stable, l'ordre du catalogue départage les égalités. */
export function compareDestinations(a: Destination, b: Destination): number {
  return a.sortOrder - b.sortOrder || nameCollator.compare(a.name, b.name);
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
  const inView = (d: Destination) =>
    view === 'all' || (view === 'favorites' ? favorites.has(d.id) : d.category === view);

  return destinations
    .filter((d) => {
      if (!d.enabled || !inView(d)) return false;
      if (words.length === 0) return true;
      const hay = searchHaystack(d);
      return words.every((w) => hay.includes(w));
    })
    .sort(compareDestinations);
}
