/**
 * Lecture tolérante des fichiers JSON (catalogue, alias, réglages, état du catalogue livré,
 * référentiel des zaaps, réponses de Rust). Fonctions pures.
 *
 * Fichier écrit par une version plus récente de l'application : chaque module décide, selon
 * ce qu'il risque d'effacer.
 * - `catalog.json` (`validateCatalog`), `official.json` (`parseOfficialState`) : refusés,
 *   jamais réécrits (`newerSchemaVersion`) ;
 * - `aliases.json` (`aliasesFileProblem`) : lu au mieux pour la recherche, jamais réécrit ;
 * - `settings.json` : sans version ; les clés inconnues sont conservées à chaque écriture ;
 * - `resources/zaaps.json` : embarqué avec l'application, version exacte exigée.
 */

/** Objet JSON (ni `null`, ni tableau). */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** `schemaVersion` de `data` si c'est un nombre plus grand que `current` (version plus récente), sinon `null`. */
export function newerSchemaVersion(data: Record<string, unknown>, current: number): number | null {
  const version = data.schemaVersion;
  return typeof version === 'number' && version > current ? version : null;
}

/** Texte JSON analysé : `data` vaut `undefined` quand le fichier est absent (`raw` nul). */
export type JsonText = { ok: true; data: unknown } | { ok: false };

/**
 * Analyse le texte d'un fichier JSON sans jamais lever : `null` (fichier absent) donne
 * `{ ok: true, data: undefined }`, un texte invalide `{ ok: false }`. Chaque appelant décide
 * ensuite du message et de la valeur de repli.
 */
export function parseJsonText(raw: string | null): JsonText {
  if (raw == null) return { ok: true, data: undefined };
  try {
    return { ok: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}
