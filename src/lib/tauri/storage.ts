/**
 * Pont de persistance. Dans Tauri, délègue aux commandes Rust (`src-tauri/src/storage.rs`)
 * qui écrivent de façon atomique dans `%APPDATA%\MapTraveller\`. Dans le navigateur
 * (`npm run dev`), retombe sur localStorage + seed pour itérer sur l'UI.
 */
import { invoke } from '@tauri-apps/api/core';
import defaultAliases from '../../../resources/aliases.default.json';
import seed from '../../../resources/catalog.seed.json';
import {
  aliasesFileProblem,
  EMPTY_USER_ALIASES,
  mergeUserAliases,
  parseDefaultAliases,
  parseUserAliases,
  type UserAliases,
} from '../../features/aliases/aliases';
import { validateCatalog, type Catalog, type ValidationResult } from '../../features/catalog/schema';
import { mergeSettings, parseSettings, type Settings } from '../../features/settings/settings';
import { isTauri } from './env';

export type StoreName = 'catalog' | 'favorites' | 'settings' | 'aliases';

const LS_PREFIX = 'map-traveller:';

async function readRaw(name: StoreName): Promise<string | null> {
  if (isTauri()) return invoke<string | null>('load_store', { name });
  try {
    return localStorage.getItem(LS_PREFIX + name);
  } catch {
    return null;
  }
}

async function writeRaw(name: StoreName, json: string): Promise<void> {
  if (isTauri()) return invoke('save_store', { name, json });
  try {
    localStorage.setItem(LS_PREFIX + name, json);
  } catch {
    /* stockage navigateur indisponible : mode démo non persistant */
  }
}

/** Contenu JSON d'un stockage ; `undefined` s'il n'existe pas encore. Lève si le JSON est invalide. */
async function readJson(name: StoreName): Promise<unknown> {
  const raw = await readRaw(name);
  return raw == null ? undefined : JSON.parse(raw);
}

const writeJson = (name: StoreName, data: unknown) => writeRaw(name, JSON.stringify(data, null, 2));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Texte brut d'un stockage, ou `null` s'il n'existe pas encore. La palette s'en sert pour ne
 * rien recharger quand le fichier n'a pas changé depuis son dernier affichage.
 */
export const readStoreText = (name: StoreName): Promise<string | null> => readRaw(name);

/** Valide le texte de `catalog.json` (`null` : fichier absent, le seed le remplace). Ne lève jamais. */
export function parseCatalogText(raw: string | null): ValidationResult {
  let data: unknown;
  try {
    data = raw == null ? undefined : JSON.parse(raw);
  } catch {
    return { ok: false, errors: [{ path: '', message: 'catalog.json illisible (JSON invalide).' }] };
  }
  return validateCatalog(data ?? seed);
}

/** Charge et valide le catalogue utilisateur (le seed est copié par Rust au premier lancement). */
export async function loadCatalog(): Promise<ValidationResult> {
  return parseCatalogText(await readRaw('catalog'));
}

/** Valide puis enregistre. Refuse d'écrire un catalogue invalide. */
export async function saveCatalog(catalog: Catalog): Promise<void> {
  const check = validateCatalog(catalog);
  if (!check.ok) throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
  await writeJson('catalog', check.catalog);
}

/** Favoris par identifiant stable. Un fichier absent ou illisible donne un ensemble vide. */
export async function loadFavorites(): Promise<Set<string>> {
  const data = await readJson('favorites').catch(() => undefined);
  const ids = isRecord(data) && Array.isArray(data.ids) ? data.ids : [];
  return new Set(ids.filter((x): x is string => typeof x === 'string'));
}

export function saveFavorites(ids: ReadonlySet<string>): Promise<void> {
  return writeJson('favorites', { ids: [...ids].sort() });
}

/** Alias de recherche livrés avec l'application (lecture seule, embarqués dans le paquet). */
export const DEFAULT_ALIASES = parseDefaultAliases(defaultAliases);

export interface LoadedAliases {
  user: UserAliases;
  /** Fichier présent mais illisible : rien n'est écrit par-dessus tant qu'il l'est. */
  error: string | null;
}

/** Personnalisations lues du texte de `aliases.json` (`null` : fichier absent). Ne lève jamais. */
export function parseAliasesText(raw: string | null): LoadedAliases {
  if (raw == null) return { user: EMPTY_USER_ALIASES, error: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { user: EMPTY_USER_ALIASES, error: 'aliases.json illisible (JSON invalide) : les alias fournis sont utilisés.' };
  }
  // Version plus récente ou forme inattendue : lu au mieux pour la recherche, jamais réécrit.
  const problem = aliasesFileProblem(data);
  return { user: parseUserAliases(data), error: problem === null ? null : `${problem} Il n'est pas modifiable ici.` };
}

/** Alias personnalisés. Un fichier absent donne une liste vide ; un fichier illisible, une erreur. */
export async function loadAliases(): Promise<LoadedAliases> {
  return parseAliasesText(await readRaw('aliases'));
}

/**
 * Enregistre les alias personnalisés. Le fichier est relu juste avant : ses clés inconnues sont
 * conservées (`mergeUserAliases`). Lève, sans rien écrire, si le fichier existant est illisible,
 * d'une version plus récente ou d'une forme inattendue.
 */
export async function saveAliases(user: UserAliases): Promise<void> {
  let raw: unknown;
  try {
    raw = await readJson('aliases');
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    throw new Error('aliases.json est illisible : corrigez ou supprimez ce fichier avant de modifier les alias.', {
      cause: e,
    });
  }
  const problem = aliasesFileProblem(raw);
  if (problem !== null) throw new Error(`${problem} Rien n'a été écrit.`);
  await writeJson('aliases', mergeUserAliases(raw, user));
}

export { DEFAULT_SETTINGS, type Settings } from '../../features/settings/settings';

/** Réglages ; un fichier absent ou illisible donne les valeurs par défaut. */
export async function loadSettings(): Promise<Settings> {
  return parseSettings(await readJson('settings').catch(() => undefined));
}

/**
 * Enregistre les réglages possédés par l'interface (`alwaysOnTop`, `updates.mode` et les champs
 * définis du moteur de mise à jour : `lastCheckedAt`, `lastSeenVersion`, `lastAutoInstallVersion`). Le fichier
 * est relu juste avant : ses autres clés, dont `shortcuts` (écrit par Rust) et les champs
 * inconnus de `updates`, sont réécrites telles quelles (`mergeSettings`).
 * Dans l'application, Rust reprend de toute façon `shortcuts` du disque sous verrou
 * (`save_store`) : l'interface ne peut jamais remettre un raccourci périmé.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const raw = await readJson('settings').catch(() => undefined);
  await writeJson('settings', mergeSettings(raw, settings));
}
