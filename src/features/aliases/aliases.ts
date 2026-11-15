/**
 * Dictionnaire global d'alias de recherche (issue n°10). PUR et testé.
 *
 * Un alias remplace UN mot de la requête par sa ou ses significations, pour toutes les
 * destinations : « hdv » → « hôtel des ventes ». Il se saisit une seule fois, ici, et jamais
 * carte par carte.
 *
 * Deux sources :
 * - les alias LIVRÉS avec l'application (`resources/aliases.default.json`, lecture seule) ;
 * - les personnalisations de l'utilisateur (`aliases.json` dans le dossier de données) : ses
 *   propres alias (`custom`) et les alias livrés qu'il a désactivés (`disabledDefaults`).
 * Une mise à jour ne change que le fichier livré : les personnalisations survivent.
 *
 * Lecture tolérante (jamais d'erreur), édition sans mutation (nouveaux objets). L'écriture ne
 * perd rien de ce que cette version ne comprend pas : clés inconnues du fichier et d'une entrée,
 * entrées illisibles (conservées telles quelles). Un fichier d'une version plus récente, ou qui
 * n'est pas un objet, n'est jamais réécrit (`aliasesFileProblem`).
 */
import { contentTokens, STOP_WORDS, tokenize } from '../catalog/searchText';

export const ALIASES_SCHEMA_VERSION = 1;

export const ALIAS_TERM_MAX = 20;
export const ALIAS_EXPANSIONS_MAX = 8;
export const ALIAS_EXPANSION_MAX = 60;

export interface AliasEntry {
  /** Mot tapé dans la recherche, tel que saisi (« HDV »). Comparé une fois normalisé. */
  term: string;
  /** Significations, telles que saisies (« hôtel des ventes »). */
  expansions: string[];
}

export interface UserAliases {
  custom: AliasEntry[];
  /** Termes normalisés des alias livrés que l'utilisateur a désactivés. */
  disabledDefaults: string[];
}

export const EMPTY_USER_ALIASES: UserAliases = { custom: [], disabledDefaults: [] };

/**
 * Dictionnaire prêt pour la recherche : terme normalisé → significations, chacune découpée en
 * mots utiles (sans mot de liaison).
 */
export type AliasDictionary = ReadonlyMap<string, readonly (readonly string[])[]>;

export const EMPTY_DICTIONARY: AliasDictionary = new Map();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Terme normalisé (« HDV » → « hdv »), ou `null` s'il ne fait pas exactement un mot. */
export function normalizeTerm(term: string): string | null {
  const words = tokenize(term);
  return words.length === 1 ? (words[0] ?? null) : null;
}

/** Significations nettoyées : espaces retirés, vides et doublons (après normalisation) écartés. */
function cleanExpansions(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = contentTokens(text).join(' ');
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

/** Entrée lue d'un contenu quelconque, ou `null` si elle est inutilisable. */
function readEntry(raw: unknown): AliasEntry | null {
  if (!isRecord(raw) || typeof raw.term !== 'string' || !Array.isArray(raw.expansions)) return null;
  const key = normalizeTerm(raw.term);
  // Même règle qu'à la saisie : un mot de liaison n'est jamais un terme.
  if (key === null || STOP_WORDS.has(key)) return null;
  const expansions = cleanExpansions(raw.expansions.filter((e): e is string => typeof e === 'string'));
  return expansions.length > 0 ? { term: raw.term.trim(), expansions } : null;
}

/** Entrées valides d'une liste quelconque ; un terme en double ne garde que sa première entrée. */
function readEntries(raw: unknown): AliasEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: AliasEntry[] = [];
  for (const item of raw) {
    const entry = readEntry(item);
    const key = entry ? normalizeTerm(entry.term) : null;
    if (!entry || key === null || seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

/** Alias livrés, lus du fichier embarqué. Ne lève jamais. */
export function parseDefaultAliases(input: unknown): AliasEntry[] {
  return isRecord(input) ? readEntries(input.aliases) : [];
}

/** Personnalisations lues d'un contenu JSON quelconque. Ne lève jamais. */
export function parseUserAliases(input: unknown): UserAliases {
  if (!isRecord(input)) return { custom: [], disabledDefaults: [] };
  const disabled = Array.isArray(input.disabledDefaults) ? input.disabledDefaults : [];
  const terms = disabled
    .map((t) => (typeof t === 'string' ? normalizeTerm(t) : null))
    .filter((t): t is string => t !== null);
  return { custom: readEntries(input.custom), disabledDefaults: [...new Set(terms)] };
}

/**
 * Raison pour laquelle un contenu de `aliases.json` ne doit JAMAIS être réécrit, ou `null` s'il
 * peut l'être : racine qui n'est pas un objet, ou version plus récente que l'application (elle
 * peut contenir des données que cette version effacerait). `undefined` = fichier absent.
 */
export function aliasesFileProblem(input: unknown): string | null {
  if (input === undefined) return null;
  if (!isRecord(input)) return 'aliases.json ne contient pas un objet JSON.';
  const version = input.schemaVersion;
  if (typeof version === 'number' && version > ALIASES_SCHEMA_VERSION) {
    return `aliases.json est d'une version plus récente (${version}) que l'application (${ALIASES_SCHEMA_VERSION}).`;
  }
  return null;
}

/**
 * Objet à écrire : le contenu actuel du fichier (`raw`) avec les seules clés possédées par
 * l'application remplacées. Rien de ce que cette version ne comprend n'est perdu :
 * - les clés inconnues du fichier sont conservées ;
 * - une entrée reprend les clés inconnues de l'entrée du fichier qui porte le même terme ;
 * - les entrées du fichier illisibles par cette version (terme de plusieurs mots, forme
 *   inattendue…) sont réécrites telles quelles, à la suite.
 */
export function mergeUserAliases(raw: unknown, user: UserAliases): Record<string, unknown> {
  const base = isRecord(raw) ? raw : {};
  const rawCustom = Array.isArray(base.custom) ? (base.custom as unknown[]) : [];
  const known = new Map<string, Record<string, unknown>>();
  const unreadable: unknown[] = [];
  for (const item of rawCustom) {
    const entry = readEntry(item);
    const key = entry ? normalizeTerm(entry.term) : null;
    if (entry === null || key === null || !isRecord(item)) unreadable.push(item);
    else if (!known.has(key)) known.set(key, item);
  }
  const custom: unknown[] = user.custom.map((e) => ({
    ...(known.get(normalizeTerm(e.term) ?? '') ?? {}),
    term: e.term,
    expansions: [...e.expansions],
  }));
  return {
    ...base,
    schemaVersion: ALIASES_SCHEMA_VERSION,
    custom: [...custom, ...unreadable],
    disabledDefaults: [...user.disabledDefaults],
  };
}

export type AliasOrigin = 'default' | 'custom';

/** Ligne de la liste affichée dans les Paramètres. */
export interface AliasRow {
  /** Terme normalisé : clé stable de la ligne. */
  key: string;
  term: string;
  expansions: string[];
  origin: AliasOrigin;
  /** Faux pour un alias livré désactivé (un alias personnalisé est toujours actif). */
  enabled: boolean;
  /** Vrai pour un alias personnalisé qui remplace un alias livré du même terme. */
  overridesDefault: boolean;
}

/**
 * Alias à afficher, triés par terme : les alias livrés (actifs ou désactivés) non remplacés,
 * et les alias personnalisés.
 */
export function listAliases(defaults: readonly AliasEntry[], user: UserAliases): AliasRow[] {
  const disabled = new Set(user.disabledDefaults);
  const defaultKeys = new Set(defaults.map((e) => normalizeTerm(e.term)));
  const customKeys = new Set(user.custom.map((e) => normalizeTerm(e.term)));
  const rows: AliasRow[] = [];
  for (const e of defaults) {
    const key = normalizeTerm(e.term);
    if (key === null || customKeys.has(key)) continue;
    rows.push({
      key,
      term: e.term,
      expansions: [...e.expansions],
      origin: 'default',
      enabled: !disabled.has(key),
      overridesDefault: false,
    });
  }
  for (const e of user.custom) {
    const key = normalizeTerm(e.term);
    if (key === null) continue;
    rows.push({
      key,
      term: e.term,
      expansions: [...e.expansions],
      origin: 'custom',
      enabled: true,
      overridesDefault: defaultKeys.has(key),
    });
  }
  return rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * Dictionnaire effectif : alias livrés, moins ceux désactivés, puis alias personnalisés (un
 * terme personnalisé REMPLACE l'alias livré du même terme).
 */
export function buildDictionary(defaults: readonly AliasEntry[], user: UserAliases): AliasDictionary {
  const dictionary = new Map<string, string[][]>();
  for (const row of listAliases(defaults, user)) {
    if (!row.enabled) continue;
    const expansions = row.expansions.map((e) => contentTokens(e)).filter((words) => words.length > 0);
    if (expansions.length > 0) dictionary.set(row.key, expansions);
  }
  return dictionary;
}

/** Erreur d'une saisie : le champ fautif (pour l'accessibilité) et le message à afficher. */
export interface AliasError {
  field: 'term' | 'expansions';
  message: string;
}

/**
 * Erreur d'une saisie, ou `null` si elle est valide. `previousTerm` est le terme de l'alias en
 * cours de modification (il peut garder son propre terme).
 */
export function validateAliasEntry(entry: AliasEntry, user: UserAliases, previousTerm?: string): AliasError | null {
  const onTerm = (message: string): AliasError => ({ field: 'term', message });
  const onExpansions = (message: string): AliasError => ({ field: 'expansions', message });

  const term = entry.term.trim();
  if (term === '') return onTerm('Alias requis.');
  if (term.length > ALIAS_TERM_MAX) return onTerm(`Alias trop long (${ALIAS_TERM_MAX} caractères au plus).`);
  const key = normalizeTerm(term);
  if (key === null) return onTerm('Un alias est un seul mot, sans espace ni ponctuation.');
  if (STOP_WORDS.has(key)) return onTerm(`« ${term} » est un mot de liaison : il est ignoré par la recherche.`);

  const previousKey = previousTerm === undefined ? null : normalizeTerm(previousTerm);
  if (key !== previousKey && user.custom.some((e) => normalizeTerm(e.term) === key)) {
    return onTerm(`L'alias « ${term} » existe déjà : modifiez-le.`);
  }

  if (entry.expansions.some((e) => e.trim().length > ALIAS_EXPANSION_MAX)) {
    return onExpansions(`Signification trop longue (${ALIAS_EXPANSION_MAX} caractères au plus).`);
  }
  const expansions = cleanExpansions(entry.expansions);
  if (expansions.length === 0) {
    return onExpansions('Indiquez au moins une signification (mots de liaison seuls exclus).');
  }
  if (expansions.length > ALIAS_EXPANSIONS_MAX) return onExpansions(`${ALIAS_EXPANSIONS_MAX} significations au plus.`);
  return null;
}

/**
 * Ajoute un alias personnalisé, ou remplace celui de terme `previousTerm` (modification, terme
 * éventuellement changé). L'entrée doit être valide (`validateAliasEntry`).
 */
export function upsertAlias(user: UserAliases, entry: AliasEntry, previousTerm?: string): UserAliases {
  const next: AliasEntry = { term: entry.term.trim(), expansions: cleanExpansions(entry.expansions) };
  const targetKey = normalizeTerm(previousTerm ?? entry.term);
  const index = user.custom.findIndex((e) => normalizeTerm(e.term) === targetKey);
  const custom = index === -1 ? [...user.custom, next] : user.custom.map((e, i) => (i === index ? next : e));
  return { custom, disabledDefaults: [...user.disabledDefaults] };
}

/** Supprime un alias personnalisé. L'alias livré du même terme, s'il existe, redevient visible. */
export function removeAlias(user: UserAliases, term: string): UserAliases {
  const key = normalizeTerm(term);
  return {
    custom: user.custom.filter((e) => normalizeTerm(e.term) !== key),
    disabledDefaults: [...user.disabledDefaults],
  };
}

/** Active ou désactive un alias livré. Sans effet sur un terme invalide. */
export function setDefaultEnabled(user: UserAliases, term: string, enabled: boolean): UserAliases {
  const key = normalizeTerm(term);
  const others = user.disabledDefaults.filter((t) => t !== key);
  return {
    custom: [...user.custom],
    disabledDefaults: enabled || key === null ? others : [...others, key],
  };
}

/** Significations saisies dans un champ : séparées par des virgules ou des points-virgules. */
export function splitExpansions(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
