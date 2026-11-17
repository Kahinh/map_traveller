/**
 * Index de recherche du catalogue (issue n°10). Fonctions pures.
 *
 * Construit une fois par catalogue et par dictionnaire, puis interrogé à chaque frappe. La
 * recherche d'un mot parcourt le VOCABULAIRE (les mots distincts du catalogue), pas les
 * destinations ; le résultat par mot est mémorisé, si bien qu'en tapant « bijoutier bo » puis
 * « bon », seul le dernier mot est recalculé.
 *
 * Classement : chaque mot de la requête a un coût par destination (tableau ci-dessous), tous
 * les mots doivent correspondre (ET), et le coût d'une destination est la SOMME des coûts :
 * l'ordre des mots tapés ne change donc rien. À coût égal : favori, puis `sortOrder` et nom.
 *
 * Tolérance aux fautes de frappe : en seconde passe seulement, quand la recherche exacte ne
 * renvoie rien. Un résultat approximatif ne peut donc jamais noyer un résultat exact.
 */
import { EMPTY_DICTIONARY, type AliasDictionary } from '../aliases/aliases';
import {
  CATEGORIES,
  CATEGORY_EXACT_KEYWORDS,
  CATEGORY_KEYWORDS,
  type Category,
  type Destination,
} from './schema';
import { boundedPrefixDistance, maxTypos, queryTokensOf, tokenize } from './searchText';

/** Coût d'un mot de la requête pour une destination (plus petit = meilleur). */
export const COST = {
  /** Commence le premier mot du nom, ou égale un alias entier de la fiche. */
  nameStart: 0,
  /** Commence un autre mot du nom. */
  nameWord: 1,
  /** Contenu dans un mot du nom. */
  nameInside: 2,
  /** Commence un mot d'un alias de la fiche. */
  aliasWord: 3,
  /** Contenu dans un alias, trouvé dans un tag ou la zone, ou désigne la catégorie. */
  other: 4,
  /** Ne correspond qu'à une faute de frappe près (nom ou alias). */
  typo: 6,
} as const;

/** Absence de correspondance dans un tableau de coûts. */
const NO_MATCH = 255;
/** Coûts mémorisés par index (un tableau d'octets de la taille du catalogue chacun), les moins récemment lus évincés. */
const CACHE_LIMIT = 64;
/** Un mot désigne une catégorie à partir de deux lettres (« on » ne doit rien ramener). */
const CATEGORY_MIN_LENGTH = 2;

/** Champ d'où vient un mot indexé. */
const Field = {
  /** Premier mot du nom. */
  NameFirst: 0,
  /** Autre mot du nom. */
  NameOther: 1,
  /** Alias de la fiche fait d'un seul mot. */
  AliasWhole: 2,
  /** Mot d'un alias de plusieurs mots. */
  AliasPart: 3,
  /** Tag ou zone. */
  Other: 4,
} as const;
type Field = (typeof Field)[keyof typeof Field];

/** Clé d'un texte entier, indépendante de l'ordre des mots : mots distincts (mots de liaison compris), triés. */
function wholeKey(words: readonly string[]): string {
  if (words.length < 2) return words[0] ?? '';
  // Quelques mots seulement : `includes` coûte moins qu'un `Set` alloué pour chaque nom.
  const distinct: string[] = [];
  for (const w of words) if (!distinct.includes(w)) distinct.push(w);
  return distinct.sort().join(' ');
}

/**
 * Occurrence d'un mot : destination et champ réunis dans un seul entier (`doc << 3 | champ`).
 * Un objet par occurrence chargeait le ramasse-miettes à chaque construction de l'index.
 */
type Posting = number;
const posting = (doc: number, field: Field): Posting => (doc << 3) | field;
const postingDoc = (p: Posting) => p >>> 3;
const postingField = (p: Posting) => (p & 7) as Field;

export interface SearchIndex {
  /** Destinations actives, dans l'ordre du catalogue. */
  readonly docs: readonly Destination[];
  readonly dictionary: AliasDictionary;
  /** Mots distincts du catalogue, alignés sur `postings`. */
  readonly words: readonly string[];
  readonly postings: readonly (readonly Posting[])[];
  /** Destinations par catégorie. */
  readonly byCategory: Readonly<Record<Category, readonly number[]>>;
  /** Rang de chaque destination dans l'ordre du catalogue (entier : tri sans collation). */
  readonly rank: Uint32Array;
  /** Destinations triées par rang. */
  readonly byRank: readonly number[];
  /** Nom ou alias entier (`wholeKey` de ses mots) → destinations. */
  readonly wholeKeys: ReadonlyMap<string, readonly number[]>;
  /** Coûts déjà calculés, par mot et par mode. */
  readonly cache: Map<string, Uint8Array>;
}

/**
 * Ordre du catalogue : `sortOrder`, puis nom insensible à la casse et aux accents (« Zone 2 »
 * avant « Zone 10 »). Un seul collateur pour toute l'application : en créer un coûte cher.
 */
const nameCollator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

const KEYWORDS: Record<Category, { prefix: string[]; exact: string[] }> = Object.fromEntries(
  CATEGORIES.map((c) => [
    c,
    { prefix: CATEGORY_KEYWORDS[c].split(' ').filter(Boolean), exact: CATEGORY_EXACT_KEYWORDS[c].split(' ').filter(Boolean) },
  ]),
) as Record<Category, { prefix: string[]; exact: string[] }>;

/**
 * Catégories désignées par un mot : il doit être le DÉBUT d'un mot-clé, sur deux lettres au
 * moins (une simple inclusion ne suffit pas, sinon « on » trouverait tous les donjons), ou
 * égaler exactement un mot-clé secondaire (« dit »).
 */
export function categoriesForWord(word: string): Category[] {
  if (word.length < CATEGORY_MIN_LENGTH) return [];
  return CATEGORIES.filter(
    (c) => KEYWORDS[c].prefix.some((k) => k.startsWith(word)) || KEYWORDS[c].exact.includes(word),
  );
}

/** Index des destinations ACTIVES. À construire une fois par catalogue et par dictionnaire. */
export function buildSearchIndex(
  destinations: readonly Destination[],
  dictionary: AliasDictionary = EMPTY_DICTIONARY,
): SearchIndex {
  const docs = destinations.filter((d) => d.enabled);
  const vocabulary = new Map<string, Posting[]>();
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, [] as number[]])) as Record<Category, number[]>;
  const wholeKeys = new Map<string, number[]>();

  const add = (word: string, doc: number, field: Field) => {
    const list = vocabulary.get(word);
    if (list) list.push(posting(doc, field));
    else vocabulary.set(word, [posting(doc, field)]);
  };
  const addWhole = (key: string, doc: number) => {
    if (key === '') return;
    const list = wholeKeys.get(key);
    if (!list) wholeKeys.set(key, [doc]);
    else if (list[list.length - 1] !== doc) list.push(doc);
  };

  // Zones et tags se répètent d'une destination à l'autre : chacun n'est découpé qu'une fois.
  const sharedWords = new Map<string, string[]>();
  const tokenizeShared = (text: string) => {
    let words = sharedWords.get(text);
    if (!words) sharedWords.set(text, (words = tokenize(text)));
    return words;
  };

  docs.forEach((d, doc) => {
    byCategory[d.category].push(doc);
    // Une seule découpe par texte : elle sert aux mots indexés et à la clé du texte entier.
    const nameWords = tokenize(d.name);
    nameWords.forEach((word, i) => add(word, doc, i === 0 ? Field.NameFirst : Field.NameOther));
    addWhole(wholeKey(nameWords), doc);
    for (const alias of d.aliases) {
      const words = tokenize(alias);
      const field = words.length === 1 ? Field.AliasWhole : Field.AliasPart;
      for (const word of words) add(word, doc, field);
      addWhole(wholeKey(words), doc);
    }
    for (const word of tokenizeShared(d.zone)) add(word, doc, Field.Other);
    for (const tag of d.tags) for (const word of tokenizeShared(tag)) add(word, doc, Field.Other);
  });

  // `sortOrder` puis nom, clés lues une fois. Le tri étant stable, l'ordre du catalogue départage les égalités.
  const sortOrders = docs.map((d) => d.sortOrder);
  const names = docs.map((d) => d.name);
  const byRank = docs
    .map((_, i) => i)
    .sort(
      (a, b) =>
        (sortOrders[a] as number) - (sortOrders[b] as number) ||
        nameCollator.compare(names[a] as string, names[b] as string),
    );
  const rank = new Uint32Array(docs.length);
  byRank.forEach((doc, position) => {
    rank[doc] = position;
  });

  return {
    docs,
    dictionary,
    words: [...vocabulary.keys()],
    postings: [...vocabulary.values()],
    byCategory,
    rank,
    byRank,
    wholeKeys,
    cache: new Map(),
  };
}

function prefixCost(field: Field, exact: boolean): number {
  switch (field) {
    case Field.NameFirst:
      return COST.nameStart;
    case Field.NameOther:
      return COST.nameWord;
    case Field.AliasWhole:
      return exact ? COST.nameStart : COST.aliasWord;
    case Field.AliasPart:
      return COST.aliasWord;
    default:
      return COST.other;
  }
}

function insideCost(field: Field): number {
  return field === Field.NameFirst || field === Field.NameOther ? COST.nameInside : COST.other;
}

type Mode = 'exact' | 'prefix' | 'typo';

/** Coûts mémorisés sous `key`, marqués comme les plus récemment lus (éviction LRU). */
function recall(index: SearchIndex, key: string): Uint8Array | undefined {
  const costs = index.cache.get(key);
  if (costs) {
    // Une `Map` garde l'ordre d'insertion : réinsérer place la clé en dernier.
    index.cache.delete(key);
    index.cache.set(key, costs);
  }
  return costs;
}

function remember(index: SearchIndex, key: string, costs: Uint8Array): Uint8Array {
  if (index.cache.size >= CACHE_LIMIT) {
    const oldest = index.cache.keys().next();
    if (!oldest.done) index.cache.delete(oldest.value);
  }
  index.cache.set(key, costs);
  return costs;
}

/**
 * Coût d'un mot pour chaque destination, par correspondance avec le vocabulaire.
 * - `exact` : début de mot ou inclusion, plus les catégories ;
 * - `prefix` : début de mot seulement (mots d'une signification d'alias) ;
 * - `typo` : comme `exact`, plus les mots du nom et des alias à une faute près.
 */
function vocabularyCosts(index: SearchIndex, word: string, mode: Mode): Uint8Array {
  const key = `${mode}:${word}`;
  const cached = recall(index, key);
  if (cached) return cached;

  const costs = new Uint8Array(index.docs.length).fill(NO_MATCH);
  const lower = (doc: number, cost: number) => {
    if (cost < (costs[doc] ?? NO_MATCH)) costs[doc] = cost;
  };
  const typos = mode === 'typo' ? maxTypos(word) : 0;

  index.words.forEach((candidate, w) => {
    const postings = index.postings[w] ?? [];
    if (candidate.startsWith(word)) {
      const exact = candidate.length === word.length;
      for (const p of postings) lower(postingDoc(p), prefixCost(postingField(p), exact));
    } else if (mode !== 'prefix' && candidate.includes(word)) {
      for (const p of postings) lower(postingDoc(p), insideCost(postingField(p)));
    } else if (typos > 0 && candidate.charCodeAt(0) === word.charCodeAt(0)) {
      // Calculé seulement s'il existe un mot du nom ou d'un alias à rapprocher.
      if (postings.every((p) => postingField(p) === Field.Other)) return;
      if (boundedPrefixDistance(word, candidate, typos) > typos) return;
      for (const p of postings) if (postingField(p) !== Field.Other) lower(postingDoc(p), COST.typo);
    }
  });

  if (mode !== 'prefix') {
    for (const category of categoriesForWord(word)) for (const doc of index.byCategory[category]) lower(doc, COST.other);
  }
  return remember(index, key, costs);
}

/**
 * Coût d'un mot de la requête : sa correspondance directe, ou, si c'est un terme du
 * dictionnaire, la meilleure de ses significations. Une signification coûte le PIRE coût de
 * ses mots, chacun devant commencer un mot de la destination.
 */
function wordCosts(index: SearchIndex, word: string, typo: boolean): Uint8Array {
  const direct = vocabularyCosts(index, word, typo ? 'typo' : 'exact');
  const expansions = index.dictionary.get(word);
  if (!expansions) return direct;

  const key = `${typo ? 'typo' : 'exact'}+alias:${word}`;
  const cached = recall(index, key);
  if (cached) return cached;

  const costs = Uint8Array.from(direct);
  for (const expansion of expansions) {
    const parts = expansion.map((w) => vocabularyCosts(index, w, 'prefix'));
    if (parts.length === 0) continue;
    for (let doc = 0; doc < costs.length; doc++) {
      let worst = 0;
      for (const part of parts) {
        const c = part[doc] ?? NO_MATCH;
        if (c > worst) worst = c;
      }
      if (worst < (costs[doc] ?? NO_MATCH)) costs[doc] = worst;
    }
  }
  return remember(index, key, costs);
}

interface Scored {
  doc: number;
  cost: number;
}

/** Restreint une recherche à certaines destinations (les parcours Farm, par exemple). */
export type Accept = (d: Destination) => boolean;

/** Destinations acceptées qui portent tous les mots, avec leur coût total. */
function scoreAll(index: SearchIndex, words: readonly string[], typo: boolean, accept?: Accept): Scored[] {
  const perWord = words.map((w) => wordCosts(index, w, typo));
  const scored: Scored[] = [];
  for (let doc = 0; doc < index.docs.length; doc++) {
    if (accept && !accept(index.docs[doc] as Destination)) continue;
    let cost = 0;
    for (const costs of perWord) {
      const c = costs[doc] ?? NO_MATCH;
      if (c === NO_MATCH) {
        cost = -1;
        break;
      }
      cost += c;
    }
    if (cost >= 0) scored.push({ doc, cost });
  }
  return scored;
}

/**
 * Recherche exacte, puis à une faute près seulement si elle ne renvoie rien PARMI les
 * destinations acceptées : un résultat exact écarté par le filtre ne bloque pas la seconde passe.
 */
function score(index: SearchIndex, words: readonly string[], accept?: Accept, typos = true): Scored[] {
  const exact = scoreAll(index, words, false, accept);
  if (exact.length > 0 || !typos || !words.some((w) => maxTypos(w) > 0)) return exact;
  return scoreAll(index, words, true, accept);
}

/** Requête découpée une seule fois, pour toutes les étapes de la recherche. */
interface PreparedQuery {
  /** Mots utiles (`queryTokens`). */
  words: string[];
  /** Du texte, mais aucun mot (ponctuation seule) : rien ne correspond. */
  wordless: boolean;
  /** Clé du texte entier (`wholeKey`), mots de liaison compris. */
  whole: string;
}

function prepareQuery(query: string): PreparedQuery {
  const tokens = tokenize(query);
  return { words: queryTokensOf(tokens), wordless: tokens.length === 0 && query.trim() !== '', whole: wholeKey(tokens) };
}

/**
 * Destinations correspondant à la requête, de la plus pertinente à la moins pertinente.
 * Requête vide : toutes les destinations actives, favoris d'abord. Requête sans aucun mot
 * (ponctuation seule) : rien. `accept` restreint la recherche avant tout classement.
 */
export function searchIndexRank(
  index: SearchIndex,
  query: string,
  favorites: ReadonlySet<string>,
  accept?: Accept,
): Destination[] {
  const { docs, rank } = index;
  const isFavorite = (doc: number) => favorites.has((docs[doc] as Destination).id);
  const { words, wordless, whole } = prepareQuery(query);
  if (wordless) return [];
  if (words.length === 0) {
    const accepted = accept ? index.byRank.filter((doc) => accept(docs[doc] as Destination)) : index.byRank;
    const favs = accepted.filter(isFavorite);
    const others = accepted.filter((doc) => !isFavorite(doc));
    return [...favs, ...others].map((doc) => docs[doc] as Destination);
  }

  const scored = score(index, words, accept);
  // Requête faite exactement des mots du nom entier ou d'un alias entier : en tête.
  const wholeDocs = new Set(index.wholeKeys.get(whole) ?? []);
  const sortable = scored.map((s) => ({
    doc: s.doc,
    cost: wholeDocs.has(s.doc) ? -1 : s.cost,
    fav: isFavorite(s.doc) ? 0 : 1,
  }));
  sortable.sort((a, b) => a.cost - b.cost || a.fav - b.fav || (rank[a.doc] ?? 0) - (rank[b.doc] ?? 0));
  return sortable.map((s) => docs[s.doc] as Destination);
}

/**
 * Destinations correspondant à la requête, sans classement, ou `null` pour une requête vide
 * (tout correspond). Requête sans aucun mot : ensemble vide. `accept` restreint la recherche
 * AVANT la seconde passe tolérante : une correspondance exacte écartée par le filtre ne la
 * bloque pas. `typos: false` s'en tient à la recherche exacte (compteur des alias).
 */
export function searchIndexMatch(
  index: SearchIndex,
  query: string,
  options: { typos?: boolean; accept?: Accept } = {},
): ReadonlySet<Destination> | null {
  const { words, wordless } = prepareQuery(query);
  if (wordless) return new Set();
  if (words.length === 0) return null;
  return new Set(score(index, words, options.accept, options.typos ?? true).map((s) => index.docs[s.doc] as Destination));
}

/** Dernier index construit pour un tableau de destinations (jamais muté : invariant 10). */
const indexCache = new WeakMap<readonly Destination[], { index: SearchIndex; length: number }>();

/**
 * Index d'un tableau de destinations, réutilisé tant que le tableau et le dictionnaire sont
 * les mêmes objets. Toute édition du catalogue produit un nouveau tableau, donc un nouvel index.
 */
export function getSearchIndex(
  destinations: readonly Destination[],
  dictionary: AliasDictionary = EMPTY_DICTIONARY,
): SearchIndex {
  const cached = indexCache.get(destinations);
  // La longueur est recontrôlée : garde-fou si un appelant complétait le tableau sur place.
  if (cached && cached.index.dictionary === dictionary && cached.length === destinations.length) return cached.index;
  const index = buildSearchIndex(destinations, dictionary);
  indexCache.set(destinations, { index, length: destinations.length });
  return index;
}
