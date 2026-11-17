/**
 * Texte de la recherche : normalisation, découpe en mots, mots de liaison, distance d'édition
 * bornée. Fonctions pures, sans état.
 *
 * Seule la RECHERCHE est normalisée : les libellés affichés et les commandes ne passent jamais
 * par ces fonctions.
 */

/** Ligatures et lettres barrées que la décomposition Unicode ne déplie pas. */
const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss', ø: 'o', đ: 'd', ł: 'l' };

/** Un caractère hors ASCII (paires de substitution comprises) : sans lui, rien à décomposer ni à déplier. */
const NON_ASCII = /[\u0080-\uffff]/;

/** Minuscules, sans accents, ligatures dépliées ; `ascii` : le texte d'origine est en ASCII. */
function fold(s: string, ascii: boolean): string {
  // Raccourci : la plupart des noms et des requêtes sont en ASCII, la décomposition NFD y est inutile.
  if (ascii) return s.toLowerCase();
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[œæßøđł]/g, (c) => LIGATURES[c] ?? c);
}

/** Minuscules, sans accents, ligatures dépliées, espaces compactés : « Cœur  Mériana » → « coeur meriana ». */
export function normalizeText(s: string): string {
  return fold(s, !NON_ASCII.test(s)).replace(/\s+/g, ' ').trim();
}

/**
 * Mots d'un texte : normalisé, puis découpé sur tout ce qui n'est ni lettre ni chiffre
 * (espaces multiples, tirets, apostrophes droites ou courbes, ponctuation). Lettres et
 * chiffres au sens d'Unicode : un nom écrit dans un autre alphabet reste cherchable.
 */
export function tokenize(s: string): string[] {
  const ascii = !NON_ASCII.test(s);
  // En ASCII, lettres et chiffres Unicode se réduisent à `a-z0-9` : découpe sans le drapeau `u`, plus rapide.
  const words = fold(s, ascii).split(ascii ? /[^a-z0-9]+/ : /[^\p{L}\p{N}]+/u);
  // Seuls le premier et le dernier morceau peuvent être vides : pas de second tableau (`filter`).
  if (words[words.length - 1] === '') words.pop();
  if (words[0] === '') words.shift();
  return words;
}

/** Mots de liaison ignorés dans la REQUÊTE (jamais retirés des textes indexés). */
export const STOP_WORDS: ReadonlySet<string> = new Set([
  'de',
  'des',
  'du',
  'd',
  'l',
  'la',
  'le',
  'les',
  'a',
  'au',
  'aux',
  'en',
  'et',
]);

/** Mots d'un texte sans les mots de liaison (significations d'alias, clés de nom entier). */
export function contentTokens(s: string): string[] {
  return tokenize(s).filter((w) => !STOP_WORDS.has(w));
}

/**
 * Mots d'une requête : sans doublon, sans mot de liaison. Si la requête ne contient que des
 * mots de liaison, ils sont gardés : chercher « la » doit chercher « la ».
 */
export function queryTokens(query: string): string[] {
  return queryTokensOf(tokenize(query));
}

/** `queryTokens` à partir des mots déjà découpés d'une requête (évite une seconde découpe). */
export function queryTokensOf(tokens: readonly string[]): string[] {
  const unique = [...new Set(tokens)];
  const kept = unique.filter((w) => !STOP_WORDS.has(w));
  return kept.length > 0 ? kept : unique;
}

/**
 * Vrai si la requête contient du texte mais aucun mot (ponctuation seule, « --- ») : elle ne
 * doit alors rien trouver, à la différence d'une requête vide qui montre tout.
 */
export function isWordlessQuery(query: string, tokens: readonly string[] = tokenize(query)): boolean {
  return tokens.length === 0 && query.trim() !== '';
}

/**
 * Fautes tolérées selon la longueur du mot : aucune sous 4 lettres, 1 jusqu'à 7, 2 au-delà.
 * Jamais sur un nombre : « 1236 » ne doit pas trouver « 1234 ».
 */
export function maxTypos(word: string): number {
  if (word.length < 4 || /^\d+$/.test(word)) return 0;
  return word.length < 8 ? 1 : 2;
}

/**
 * Distance d'édition (insertion, suppression, substitution, transposition de deux lettres
 * voisines) entre `word` et le MEILLEUR PRÉFIXE de `target`. Comparer au préfixe évite que les
 * résultats disparaissent pendant la frappe : « melo » est déjà à une faute de « meulou ».
 *
 * Bornée : renvoie `max + 1` dès que la distance dépasse `max`, sans finir le calcul.
 */
export function boundedPrefixDistance(word: string, target: string, max: number): number {
  const n = word.length;
  // Au-delà de n + max lettres, un préfixe de la cible ne peut plus être à distance ≤ max.
  const m = Math.min(target.length, n + max);
  if (n === 0) return 0;

  let beforePrevious: number[] = [];
  let previous: number[] = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const current: number[] = [i];
    let rowMin = i;
    const a = word.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const b = target.charCodeAt(j - 1);
      let best = Math.min(
        (previous[j] ?? Infinity) + 1, // lettre de `word` en trop
        (current[j - 1] ?? Infinity) + 1, // lettre de `target` manquante
        (previous[j - 1] ?? Infinity) + (a === b ? 0 : 1),
      );
      if (i > 1 && j > 1 && a === target.charCodeAt(j - 2) && word.charCodeAt(i - 2) === b) {
        best = Math.min(best, (beforePrevious[j - 2] ?? Infinity) + 1); // deux lettres inversées
      }
      current[j] = best;
      if (best < rowMin) rowMin = best;
    }
    if (rowMin > max) return max + 1;
    beforePrevious = previous;
    previous = current;
  }
  let distance = Infinity;
  for (const d of previous) if (d < distance) distance = d;
  return distance > max ? max + 1 : distance;
}
