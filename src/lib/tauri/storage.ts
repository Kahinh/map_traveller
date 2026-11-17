/**
 * Pont de persistance. Dans Tauri, délègue aux commandes Rust (`src-tauri/src/storage.rs`)
 * qui écrivent de façon atomique dans `%APPDATA%\MapTraveller\`. Dans le navigateur
 * (`npm run dev`), retombe sur localStorage + seed pour itérer sur l'UI.
 */
import { invoke } from '@tauri-apps/api/core';
import defaultAliases from '../../../resources/aliases.default.json';
import {
  aliasesFileProblem,
  EMPTY_USER_ALIASES,
  mergeUserAliases,
  parseDefaultAliases,
  parseUserAliases,
  type UserAliases,
} from '../../features/aliases/aliases';
import { parseOfficialState, type OfficialState, type OfficialStateResult } from '../../features/catalog/official';
import { SCHEMA_VERSION, validateCatalog, type Catalog, type ValidationResult } from '../../features/catalog/schema';
import { mergeSettings, parseSettings, type Settings } from '../../features/settings/settings';
import { IS_TAURI } from './env';

type StoreName = 'catalog' | 'favorites' | 'settings' | 'aliases' | 'official';

const LS_PREFIX = 'map-traveller:';

async function readRaw(name: StoreName): Promise<string | null> {
  if (IS_TAURI) return invoke<string | null>('load_store', { name });
  try {
    return localStorage.getItem(LS_PREFIX + name);
  } catch {
    return null;
  }
}

async function writeRaw(name: StoreName, json: string): Promise<void> {
  if (IS_TAURI) return invoke('save_store', { name, json });
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

const EMPTY_CATALOG: Catalog = { schemaVersion: SCHEMA_VERSION, destinations: [] };

/**
 * Valide le texte de `catalog.json`. Ne lève jamais. Fichier absent (`null`) : `fallback`. Dans
 * l'application, Rust copie le seed avant l'ouverture des fenêtres : le fichier existe toujours.
 * La palette garde le catalogue vide par défaut, pour ne pas embarquer le catalogue livré.
 */
export function parseCatalogText(raw: string | null, fallback: unknown = EMPTY_CATALOG): ValidationResult {
  let data: unknown;
  try {
    data = raw == null ? undefined : JSON.parse(raw);
  } catch {
    return { ok: false, errors: [{ path: '', message: 'catalog.json illisible (JSON invalide).' }] };
  }
  return validateCatalog(data ?? fallback);
}

/**
 * Charge et valide le catalogue utilisateur. `seed` n'est appelé que si le fichier n'existe pas
 * encore (mode navigateur) : le catalogue livré reste hors du paquet initial.
 */
export async function loadCatalog(seed: () => Promise<unknown>): Promise<ValidationResult> {
  const raw = await readRaw('catalog');
  return parseCatalogText(raw, raw == null ? await seed() : undefined);
}

/** Entrées du catalogue livré déjà proposées (`official.json`). Ne lève jamais. */
export async function loadOfficialState(): Promise<OfficialStateResult> {
  try {
    return parseOfficialState(await readJson('official'));
  } catch {
    return { ok: false, message: 'official.json illisible (JSON invalide).' };
  }
}

export const saveOfficialState = (state: OfficialState): Promise<void> => writeJson('official', state);

/** Valide puis enregistre. Refuse d'écrire un catalogue invalide. */
export async function saveCatalog(catalog: Catalog): Promise<void> {
  const check = validateCatalog(catalog);
  if (!check.ok) throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
  await writeJson('catalog', check.catalog);
}

/**
 * Lecture d'un fichier que la fenêtre principale réécrit : `error` non nul si le fichier existe
 * mais n'est pas lisible. L'appelant n'écrit alors plus rien par-dessus (`createWriteGate`).
 */
export interface StoreRead<T> {
  value: T;
  error: string | null;
}

/** Favoris lus du texte de `favorites.json` (`null` : fichier absent). Ne lève jamais. */
export function parseFavoritesText(raw: string | null): StoreRead<ReadonlySet<string>> {
  if (raw == null) return { value: new Set(), error: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { value: new Set(), error: 'favorites.json illisible (JSON invalide)' };
  }
  if (!isRecord(data) || !Array.isArray(data.ids)) {
    return { value: new Set(), error: 'favorites.json illisible (forme inattendue)' };
  }
  return { value: new Set(data.ids.filter((x): x is string => typeof x === 'string')), error: null };
}

/** Favoris de la fenêtre principale. Rejette si la lecture elle-même échoue. */
export async function readFavorites(): Promise<StoreRead<ReadonlySet<string>>> {
  return parseFavoritesText(await readRaw('favorites'));
}

/** Favoris pour la palette, qui n'écrit jamais : tout problème donne un ensemble vide. */
export async function loadFavorites(): Promise<ReadonlySet<string>> {
  return (await readFavorites().catch(() => parseFavoritesText(null))).value;
}

export function saveFavorites(ids: ReadonlySet<string>): Promise<void> {
  return writeJson('favorites', { ids: [...ids].sort() });
}

/** Alias de recherche livrés avec l'application (lecture seule, embarqués dans le paquet). */
export const DEFAULT_ALIASES = parseDefaultAliases(defaultAliases);

interface LoadedAliases {
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

/** Réglages lus du texte de `settings.json` (`null` : fichier absent). Ne lève jamais. */
export function parseSettingsText(raw: string | null): StoreRead<Settings> {
  if (raw == null) return { value: parseSettings(undefined), error: null };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { value: parseSettings(undefined), error: 'settings.json illisible (JSON invalide)' };
  }
  // Racine d'une autre forme : `mergeSettings` la remplacerait, et Rust y perdrait `shortcuts`.
  if (!isRecord(data)) return { value: parseSettings(undefined), error: 'settings.json illisible (forme inattendue)' };
  return { value: parseSettings(data), error: null };
}

/** Réglages de la fenêtre principale. Rejette si la lecture elle-même échoue. */
export async function readSettings(): Promise<StoreRead<Settings>> {
  return parseSettingsText(await readRaw('settings'));
}

/** Réglages pour la palette, qui n'écrit jamais : tout problème donne les valeurs par défaut. */
export async function loadSettings(): Promise<Settings> {
  return (await readSettings().catch(() => parseSettingsText(null))).value;
}

/**
 * Enregistre les réglages possédés par l'interface (`alwaysOnTop`, `updates.mode` et les champs
 * définis du moteur de mise à jour : `lastCheckedAt`, `lastSeenVersion`, `lastAutoInstallVersion`). Le fichier
 * est relu juste avant : ses autres clés, dont `shortcuts` (écrit par Rust) et les champs
 * inconnus de `updates`, sont réécrites telles quelles (`mergeSettings`).
 * Dans l'application, Rust reprend de toute façon `shortcuts` du disque sous verrou
 * (`save_store`) : l'interface ne peut jamais remettre un raccourci périmé.
 * Lève, sans rien écrire, si le fichier est devenu illisible.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const raw = await readRaw('settings');
  // Devenu illisible depuis le chargement (modifié à la main) : ne pas l'écraser.
  const { error } = parseSettingsText(raw);
  if (error !== null) throw new Error(error);
  await writeJson('settings', mergeSettings(raw == null ? undefined : JSON.parse(raw), settings));
}
