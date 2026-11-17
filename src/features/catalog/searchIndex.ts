/**
 * Index de recherche du catalogue (issues n°10 et n°24). Fonctions pures.
 *
 * Construit une fois par catalogue et par dictionnaire, puis interrogé à chaque frappe. La
 * recherche d'un mot parcourt le VOCABULAIRE (les mots distincts du catalogue), pas les
 * destinations ; le résultat par mot est mémorisé, si bien qu'en tapant « bijoutier bo » puis
 * « bon », seul le dernier mot est recalculé.
 *
 * Classement par PALIERS déterministes (`TIER`), du meilleur au moins bon :
 *
 * | Palier | Constante    | La destination est retenue parce que…                                          |
 * |-------:|--------------|--------------------------------------------------------------------------------|
 * |      1 | `aliasExact` | la requête entière est un alias entier de la fiche, ou un terme du dictionnaire |
 * |        |              | global dont une signification la désigne (« rdv » → « reine des voleurs »)     |
 * |      2 | `nameExact`  | la requête entière est son nom entier (ordre des mots libre)                   |
 * |      3 | `prefix`     | la requête est le début de son nom ou d'un alias de la fiche (« reine des v »)  |
 * |      4 | `words`      | chaque mot tapé commence un mot du nom, d'un alias, d'un tag, de la zone, ou     |
 * |        |              | désigne la catégorie (ET, ordre libre)                                          |
 * |      5 | `acronym`    | requête d'un seul mot = initiales du nom ou d'un alias (« rdv », « rv ») ;      |
 * |        |              | début d'initiales (2 lettres au moins) ensuite                                 |
 * |      6 | `inside`     | un mot tapé n'est trouvé qu'à l'intérieur d'un mot (« plan » dans « Esplanade ») |
 * |      7 | `typo`       | à une faute de frappe près (seconde passe, seulement si rien d'autre)          |
 *
 * Dans un palier : coût des champs où les mots ont été trouvés (`FIELD_COST`, somme sur les
 * mots : nom avant alias avant tag, zone ou catégorie), puis favori, puis rang du catalogue
 * (`sortOrder`, puis nom). Paliers 1, 3 et 5 : alias de fiche avant terme du dictionnaire,
 * nom avant alias, acronyme exact avant début d'acronyme.
 *
 * Tolérance aux fautes de frappe : en seconde passe seulement, quand la recherche exacte (paliers
 * 1 à 6) ne renvoie rien. Un résultat approximatif ne peut donc jamais noyer un résultat exact.
 */
import { EMPTY_DICTIONARY, type AliasDictionary } from '../aliases/aliases';
import {
  CATEGORIES,
  CATEGORY_EXACT_KEYWORDS,
  CATEGORY_KEYWORDS,
  type Category,
  type Destination,
} from './schema';
import { boundedPrefixDistance, maxTypos, queryTokensOf, STOP_WORDS, tokenize } from './searchText';

/** Paliers de pertinence (plus petit = meilleur). Voir le tableau en tête du fichier. */
export const TIER = {
  aliasExact: 1,
  nameExact: 2,
  prefix: 3,
  words: 4,
  acronym: 5,
  inside: 6,
  typo: 7,
} as const;

/** Coût d'un mot selon le champ où il est trouvé, pour départager un même palier (plus petit = meilleur). */
export const FIELD_COST = {
  /** Premier mot du nom. */
  nameFirst: 0,
  /** Autre mot du nom. */
  nameOther: 1,
  /** Mot d'un alias de la fiche. */
  alias: 2,
  /** Tag, zone ou catégorie. */
  other: 3,
} as const;

/**
 * Coût d'un mot pour une destination, sur un octet : genre de correspondance (`Kind`) × 4 +
 * coût du champ. Le plus petit octet est donc la meilleure correspondance.
 */
const Kind = {
  /** Commence un mot. */
  start: 0,
  /** Contenu dans un mot. */
  inside: 1,
  /** À une faute de frappe près. */
  typo: 2,
} as const;
const code = (kind: number, field: number) => kind * 4 + field;
const codeKind = (c: number) => c >> 2;
const codeField = (c: number) => c & 3;

/** Absence de correspondance dans un tableau de coûts. */
const NO_MATCH = 255;
/** Coûts mémorisés par index (un tableau d'octets de la taille du catalogue chacun), les moins récemment lus évincés. */
const CACHE_LIMIT = 64;
/** Un mot désigne une catégorie à partir de deux lettres (« on » ne doit rien ramener). */
const CATEGORY_MIN_LENGTH = 2;
/** Un acronyme, ou un début d'acronyme tapé, a au moins deux lettres. */
const ACRONYM_MIN_LENGTH = 2;
/** Coût d'un acronyme tapé en entier, puis d'un début d'acronyme. */
const ACRONYM_EXACT = 0;
const ACRONYM_START = 1;


/** Champ d'où vient un mot indexé ; sa valeur est son coût (`FIELD_COST`). */
const Field = {
  NameFirst: FIELD_COST.nameFirst,
  NameOther: FIELD_COST.nameOther,
  Alias: FIELD_COST.alias,
  Other: FIELD_COST.other,
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
 * Clé normalisée d'un texte entier (alias, nom) : deux textes de même clé répondent à la même
 * requête exacte (« Reine des Voleurs » et « voleurs  reine des »).
 */
export function textKey(text: string): string {
  return wholeKey(tokenize(text));
}

/** Première lettre de chaque mot (point de code entier : un nom dans un autre alphabet reste juste). */
function initials(words: readonly string[]): string {
  let result = '';
  for (const w of words) {
    const c = w.charCodeAt(0);
    // Hors des paires de substitution, le premier code suffit : pas d'appel à `codePointAt`.
    result += c >= 0xd800 && c <= 0xdbff ? String.fromCodePoint(w.codePointAt(0) as number) : w.charAt(0);
  }
  return result;
}

/** Mots joints par une espace ; un seul mot est repris tel quel (aucune chaîne de plus en mémoire). */
const joinWords = (words: readonly string[]) => (words.length === 1 ? (words[0] as string) : words.join(' '));

/**
 * Acronymes d'un texte de plusieurs mots : initiales de tous les mots, puis sans les mots de
 * liaison (« Reine des Voleurs » → « rdv », « rv »), chacun de deux lettres au moins. Un texte
 * d'un seul mot n'en a pas : ses initiales ne seraient qu'une lettre, ou le début du mot.
 */
export function acronymsOf(words: readonly string[]): string[] {
  if (words.length < ACRONYM_MIN_LENGTH) return [];
  const all = initials(words);
  const content = words.filter((w) => !STOP_WORDS.has(w));
  if (content.length < ACRONYM_MIN_LENGTH || content.length === words.length) return [all];
  return [all, initials(content)];
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
  /** Alias entier de la fiche (`wholeKey` de ses mots) → destinations (palier 1). */
  readonly aliasKeys: ReadonlyMap<string, readonly number[]>;
  /** Nom entier (`wholeKey` de ses mots) → destinations (palier 2). */
  readonly nameKeys: ReadonlyMap<string, readonly number[]>;
  /** Mots du nom de chaque destination, joints par une espace (palier 3). */
  readonly nameTexts: readonly string[];
  /** Mots de chaque alias de la fiche, joints par une espace (palier 3). */
  readonly aliasTexts: readonly (readonly string[])[];
  /** Acronymes du nom et des alias de la fiche (`acronymsOf`) → destinations (palier 5). */
  readonly acronyms: ReadonlyMap<string, readonly number[]>;
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

/** Destination sans alias : un seul tableau vide partagé. */
const NO_TEXTS: readonly string[] = [];

/** Ajoute `doc` à la liste de `key`, sans doublon consécutif. */
function addKey(map: Map<string, number[]>, key: string, doc: number): void {
  if (key === '') return;
  const list = map.get(key);
  if (!list) map.set(key, [doc]);
  else if (list[list.length - 1] !== doc) list.push(doc);
}

/** Index des destinations ACTIVES. À construire une fois par catalogue et par dictionnaire. */
export function buildSearchIndex(
  destinations: readonly Destination[],
  dictionary: AliasDictionary = EMPTY_DICTIONARY,
): SearchIndex {
  const docs = destinations.filter((d) => d.enabled);
  const vocabulary = new Map<string, Posting[]>();
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, [] as number[]])) as Record<Category, number[]>;
  const aliasKeys = new Map<string, number[]>();
  const nameKeys = new Map<string, number[]>();
  const acronyms = new Map<string, number[]>();
  const nameTexts: string[] = [];
  const aliasTexts: (readonly string[])[] = [];

  const add = (word: string, doc: number, field: Field) => {
    const list = vocabulary.get(word);
    if (list) list.push(posting(doc, field));
    else vocabulary.set(word, [posting(doc, field)]);
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
    // Une seule découpe par texte : elle sert aux mots indexés, à la clé du texte entier, au
    // texte joint et aux acronymes.
    const nameWords = tokenize(d.name);
    nameWords.forEach((word, i) => add(word, doc, i === 0 ? Field.NameFirst : Field.NameOther));
    addKey(nameKeys, wholeKey(nameWords), doc);
    nameTexts.push(joinWords(nameWords));
    for (const acronym of acronymsOf(nameWords)) addKey(acronyms, acronym, doc);

    let texts: string[] | null = null;
    for (const alias of d.aliases) {
      const words = tokenize(alias);
      if (words.length === 0) continue;
      for (const word of words) add(word, doc, Field.Alias);
      addKey(aliasKeys, wholeKey(words), doc);
      (texts ??= []).push(joinWords(words));
      for (const acronym of acronymsOf(words)) addKey(acronyms, acronym, doc);
    }
    aliasTexts.push(texts ?? NO_TEXTS);

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
    aliasKeys,
    nameKeys,
    nameTexts,
    aliasTexts,
    acronyms,
    cache: new Map(),
  };
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
      for (const p of postings) lower(postingDoc(p), code(Kind.start, postingField(p)));
    } else if (mode !== 'prefix' && candidate.includes(word)) {
      for (const p of postings) lower(postingDoc(p), code(Kind.inside, postingField(p)));
    } else if (typos > 0 && candidate.charCodeAt(0) === word.charCodeAt(0)) {
      // Calculé seulement s'il existe un mot du nom ou d'un alias à rapprocher.
      if (postings.every((p) => postingField(p) === Field.Other)) return;
      if (boundedPrefixDistance(word, candidate, typos) > typos) return;
      for (const p of postings) if (postingField(p) !== Field.Other) lower(postingDoc(p), code(Kind.typo, postingField(p)));
    }
  });

  if (mode !== 'prefix') {
    const category = code(Kind.start, Field.Other);
    for (const c of categoriesForWord(word)) for (const doc of index.byCategory[c]) lower(doc, category);
  }
  return remember(index, key, costs);
}

/**
 * Destinations désignées par un terme du dictionnaire, ou `null` si ce n'est pas un terme. Une
 * signification coûte le PIRE coût de ses mots, chacun devant commencer un mot de la
 * destination ; le terme vaut la meilleure de ses significations (union).
 */
function termCosts(index: SearchIndex, word: string): Uint8Array | null {
  const expansions = index.dictionary.get(word);
  if (!expansions) return null;
  const key = `alias:${word}`;
  const cached = recall(index, key);
  if (cached) return cached;

  const costs = new Uint8Array(index.docs.length).fill(NO_MATCH);
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

/** Coût d'un mot de la requête : sa correspondance directe, ou, si c'est un terme du dictionnaire, ce qu'il désigne. */
function wordCosts(index: SearchIndex, word: string, typo: boolean): Uint8Array {
  const mode = typo ? 'typo' : 'exact';
  const direct = vocabularyCosts(index, word, mode);
  if (!index.dictionary.has(word)) return direct;

  const key = `${mode}+alias:${word}`;
  const cached = recall(index, key);
  if (cached) return cached;
  const designated = termCosts(index, word) as Uint8Array;
  const costs = Uint8Array.from(direct);
  for (let doc = 0; doc < costs.length; doc++) {
    const c = designated[doc] ?? NO_MATCH;
    if (c < (costs[doc] ?? NO_MATCH)) costs[doc] = c;
  }
  return remember(index, key, costs);
}

/**
 * Destinations dont un acronyme égale le mot (`ACRONYM_EXACT`) ou commence par lui
 * (`ACRONYM_START`, deux lettres au moins), ou `null` si aucune ne peut correspondre.
 */
function acronymCosts(index: SearchIndex, word: string): Uint8Array | null {
  if (word.length < ACRONYM_MIN_LENGTH || index.acronyms.size === 0) return null;
  const key = `acronym:${word}`;
  const cached = recall(index, key);
  if (cached) return cached;

  const costs = new Uint8Array(index.docs.length).fill(NO_MATCH);
  for (const [acronym, docs] of index.acronyms) {
    if (!acronym.startsWith(word)) continue;
    const cost = acronym.length === word.length ? ACRONYM_EXACT : ACRONYM_START;
    for (const doc of docs) if (cost < (costs[doc] ?? NO_MATCH)) costs[doc] = cost;
  }
  return remember(index, key, costs);
}

interface Scored {
  doc: number;
  /** Palier (`TIER`). */
  tier: number;
  /** Départage dans le palier (plus petit = meilleur). */
  cost: number;
}

/** Restreint une recherche à certaines destinations (les parcours Farm, par exemple). */
export type Accept = (d: Destination) => boolean;

/**
 * Destinations acceptées qui portent tous les mots (paliers 4, 6 ou 7), ou dont un acronyme
 * correspond (palier 5), avec leur palier et leur coût. Les paliers 1 à 3 sont attribués
 * ensuite, au classement (`promote`).
 */
function scoreAll(
  index: SearchIndex,
  words: readonly string[],
  typo: boolean,
  accept: Accept | undefined,
  acronym: Uint8Array | null,
): Scored[] {
  const perWord = words.map((w) => wordCosts(index, w, typo));
  const scored: Scored[] = [];
  for (let doc = 0; doc < index.docs.length; doc++) {
    if (accept && !accept(index.docs[doc] as Destination)) continue;
    let worstKind: number = Kind.start;
    let cost = 0;
    for (const costs of perWord) {
      const c = costs[doc] ?? NO_MATCH;
      if (c === NO_MATCH) {
        cost = -1;
        break;
      }
      if (codeKind(c) > worstKind) worstKind = codeKind(c);
      cost += codeField(c);
    }
    let tier: number = typo ? TIER.typo : worstKind === Kind.inside ? TIER.inside : TIER.words;
    const initialsCost = acronym?.[doc] ?? NO_MATCH;
    if (initialsCost !== NO_MATCH && (cost < 0 || tier > TIER.acronym)) {
      tier = TIER.acronym;
      cost = initialsCost;
    }
    if (cost >= 0) scored.push({ doc, tier, cost });
  }
  return scored;
}

/** Requête découpée une seule fois, pour toutes les étapes de la recherche. */
interface PreparedQuery {
  /** Mots utiles (`queryTokens`). */
  words: string[];
  /** Du texte, mais aucun mot (ponctuation seule) : rien ne correspond. */
  wordless: boolean;
  /** Clé du texte entier (`wholeKey`), mots de liaison compris (paliers 1 et 2). */
  whole: string;
  /** Tous les mots tapés, dans l'ordre, joints par une espace (palier 3). */
  text: string;
  /** Le mot tapé, si la requête n'en compte qu'un (terme du dictionnaire, acronyme). */
  single: string | null;
}

function prepareQuery(query: string): PreparedQuery {
  const tokens = tokenize(query);
  return {
    words: queryTokensOf(tokens),
    wordless: tokens.length === 0 && query.trim() !== '',
    whole: wholeKey(tokens),
    text: tokens.join(' '),
    single: tokens.length === 1 ? (tokens[0] as string) : null,
  };
}

/**
 * Recherche exacte (acronymes compris), puis à une faute près seulement si elle ne renvoie rien
 * PARMI les destinations acceptées : un résultat exact écarté par le filtre ne bloque pas la
 * seconde passe.
 */
function score(index: SearchIndex, query: PreparedQuery, accept?: Accept, typos = true): Scored[] {
  const acronym = query.single === null ? null : acronymCosts(index, query.single);
  const exact = scoreAll(index, query.words, false, accept, acronym);
  if (exact.length > 0 || !typos || !query.words.some((w) => maxTypos(w) > 0)) return exact;
  return scoreAll(index, query.words, true, accept, null);
}

/**
 * Paliers 1 à 3, qui portent sur la requête ENTIÈRE : alias exact (de la fiche, puis terme du
 * dictionnaire qui la désigne), nom exact, début du nom (puis d'un alias). Modifie `scored`.
 */
function promote(index: SearchIndex, query: PreparedQuery, scored: Scored[]): void {
  if (query.text === '') return;
  const aliasDocs = new Set(index.aliasKeys.get(query.whole));
  const nameDocs = new Set(index.nameKeys.get(query.whole));
  const designated = query.single === null ? null : termCosts(index, query.single);
  for (const s of scored) {
    // Seconde passe : une correspondance de la requête entière aurait abouti dès la première.
    if (s.tier === TIER.typo) continue;
    const term = designated?.[s.doc] ?? NO_MATCH;
    if (aliasDocs.has(s.doc)) {
      s.tier = TIER.aliasExact;
      s.cost = 0;
    } else if (term !== NO_MATCH) {
      s.tier = TIER.aliasExact;
      s.cost = 1 + codeField(term);
    } else if (nameDocs.has(s.doc)) {
      s.tier = TIER.nameExact;
      s.cost = 0;
    } else if ((index.nameTexts[s.doc] as string).startsWith(query.text)) {
      s.tier = TIER.prefix;
      s.cost = 0;
    } else if ((index.aliasTexts[s.doc] as readonly string[]).some((t) => t.startsWith(query.text))) {
      s.tier = TIER.prefix;
      s.cost = 1;
    }
  }
}

/**
 * Destinations correspondant à la requête, de la plus pertinente à la moins pertinente (paliers
 * en tête du fichier). Requête vide : toutes les destinations actives, favoris d'abord. Requête
 * sans aucun mot (ponctuation seule) : rien. `accept` restreint la recherche avant tout classement.
 */
export function searchIndexRank(
  index: SearchIndex,
  query: string,
  favorites: ReadonlySet<string>,
  accept?: Accept,
): Destination[] {
  const { docs, rank } = index;
  const isFavorite = (doc: number) => favorites.has((docs[doc] as Destination).id);
  const prepared = prepareQuery(query);
  if (prepared.wordless) return [];
  if (prepared.words.length === 0) {
    const accepted = accept ? index.byRank.filter((doc) => accept(docs[doc] as Destination)) : index.byRank;
    const favs = accepted.filter(isFavorite);
    const others = accepted.filter((doc) => !isFavorite(doc));
    return [...favs, ...others].map((doc) => docs[doc] as Destination);
  }

  const scored = score(index, prepared, accept);
  promote(index, prepared, scored);
  const sortable = scored.map((s) => ({ ...s, fav: isFavorite(s.doc) ? 0 : 1 }));
  sortable.sort(
    (a, b) => a.tier - b.tier || a.cost - b.cost || a.fav - b.fav || (rank[a.doc] ?? 0) - (rank[b.doc] ?? 0),
  );
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
  const prepared = prepareQuery(query);
  if (prepared.wordless) return new Set();
  if (prepared.words.length === 0) return null;
  return new Set(score(index, prepared, options.accept, options.typos ?? true).map((s) => index.docs[s.doc] as Destination));
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
