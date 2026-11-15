/**
 * Recherche, filtrage et tri du catalogue (cahier des charges §7). Fonctions pures.
 */
import { CATEGORIES, CATEGORY_KEYWORDS, type Category, type Destination } from './schema';

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

/** Mots normalisés d'une requête, sans mot vide. */
export function queryWords(query: string): string[] {
  return normalizeText(query).split(' ').filter(Boolean);
}

/**
 * Texte indexé par destination. Les destinations sont immuables (toute édition crée un
 * nouvel objet) : le cache évite de re-normaliser tout le catalogue à chaque frappe.
 */
const haystackCache = new WeakMap<Destination, string>();
const nameCache = new WeakMap<Destination, string>();

/** Texte indexé d'une destination : nom, alias, tags, zone. */
export function searchHaystack(d: Destination): string {
  let hay = haystackCache.get(d);
  if (hay === undefined) {
    hay = normalizeText([d.name, ...d.aliases, ...d.tags, d.zone].join(' '));
    haystackCache.set(d, hay);
  }
  return hay;
}

const KEYWORDS_BY_CATEGORY = Object.fromEntries(
  CATEGORIES.map((c) => [c, CATEGORY_KEYWORDS[c].split(' ')]),
) as Record<Category, string[]>;

/**
 * Vrai si `word` désigne la catégorie de la destination : il doit être le DÉBUT d'un mot-clé
 * (« donj » → Donjons), sur 2 lettres au moins. Une simple inclusion ne suffit pas : sinon
 * « on » trouverait tous les donjons.
 */
export function matchesCategory(d: Destination, word: string): boolean {
  return word.length >= 2 && KEYWORDS_BY_CATEGORY[d.category].some((k) => k.startsWith(word));
}

/** Vrai si un mot de la requête est trouvé dans le texte indexé ou désigne la catégorie. */
export function matchesWord(d: Destination, word: string): boolean {
  return searchHaystack(d).includes(word) || matchesCategory(d, word);
}

/** Nom normalisé d'une destination (mis en cache, comme le texte indexé). */
export function normalizedName(d: Destination): string {
  let name = nameCache.get(d);
  if (name === undefined) {
    name = normalizeText(d.name);
    nameCache.set(d, name);
  }
  return name;
}

/**
 * Rang de pertinence (plus petit = meilleur) :
 * 0 le nom commence par le mot ; 1 un mot du nom commence par le mot ;
 * 2 le nom contient le mot ; 3 trouvé seulement dans alias, tags, zone ou mots de catégorie.
 */
export type MatchRank = 0 | 1 | 2 | 3;

const isWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);

function rankInName(name: string, word: string): MatchRank {
  if (name.startsWith(word)) return 0;
  let contains = false;
  for (let i = name.indexOf(word, 1); i !== -1; i = name.indexOf(word, i + 1)) {
    contains = true;
    if (!isWordChar(name.charAt(i - 1))) return 1;
  }
  return contains ? 2 : 3;
}

/**
 * Rang d'une destination pour des mots déjà normalisés (`queryWords`), ou `null` si un mot
 * manque (ET logique). Le rang est celui du premier mot. Aucun mot : rang 0.
 */
export function matchRank(d: Destination, words: readonly string[]): MatchRank | null {
  const first = words[0];
  if (first === undefined) return 0;
  if (!words.every((w) => matchesWord(d, w))) return null;
  return rankInName(normalizedName(d), first);
}

/**
 * Destinations actives correspondant à la requête, classées par pertinence (`matchRank`),
 * puis favoris d'abord, puis `compareDestinations`. Requête vide : toutes, favoris d'abord.
 */
export function rankDestinations(
  destinations: readonly Destination[],
  query: string,
  favorites: ReadonlySet<string>,
): Destination[] {
  const words = queryWords(query);
  const scored: { d: Destination; rank: MatchRank; fav: number }[] = [];
  for (const d of destinations) {
    if (!d.enabled) continue;
    const rank = matchRank(d, words);
    if (rank !== null) scored.push({ d, rank, fav: favorites.has(d.id) ? 0 : 1 });
  }
  scored.sort((a, b) => a.rank - b.rank || a.fav - b.fav || compareDestinations(a.d, b.d));
  return scored.map((s) => s.d);
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
  const words = queryWords(query);
  const inView = (d: Destination) =>
    view === 'all' || (view === 'favorites' ? favorites.has(d.id) : d.category === view);

  return destinations
    .filter((d) => {
      if (!d.enabled || !inView(d)) return false;
      if (words.length === 0) return true;
      return words.every((w) => matchesWord(d, w));
    })
    .sort(compareDestinations);
}
