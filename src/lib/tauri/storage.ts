/**
 * Pont de persistance. Dans Tauri, délègue aux commandes Rust (`src-tauri/src/storage.rs`)
 * qui écrivent de façon atomique dans `%APPDATA%\MapTraveller\`. Dans le navigateur
 * (`npm run dev`), retombe sur localStorage + seed pour itérer sur l'UI.
 */
import { invoke } from '@tauri-apps/api/core';
import seed from '../../../resources/catalog.seed.json';
import { validateCatalog, type Catalog, type ValidationResult } from '../../features/catalog/schema';
import { mergeSettings, parseSettings, type Settings } from '../../features/settings/settings';
import { isTauri } from './env';

export type StoreName = 'catalog' | 'favorites' | 'settings';

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

/** Charge et valide le catalogue utilisateur (le seed est copié par Rust au premier lancement). */
export async function loadCatalog(): Promise<ValidationResult> {
  let data: unknown;
  try {
    data = await readJson('catalog');
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    return { ok: false, errors: [{ path: '', message: 'catalog.json illisible (JSON invalide).' }] };
  }
  return validateCatalog(data ?? seed);
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

export { DEFAULT_SETTINGS, type Settings } from '../../features/settings/settings';

/** Réglages ; un fichier absent ou illisible donne les valeurs par défaut. */
export async function loadSettings(): Promise<Settings> {
  return parseSettings(await readJson('settings').catch(() => undefined));
}

/**
 * Enregistre les réglages possédés par l'interface (`alwaysOnTop`, `updates.mode`). Le fichier
 * est relu juste avant : ses autres clés, dont `shortcuts` (écrit par Rust) et les champs
 * inconnus de `updates`, sont réécrites telles quelles (`mergeSettings`).
 * Dans l'application, Rust reprend de toute façon `shortcuts` du disque sous verrou
 * (`save_store`) : l'interface ne peut jamais remettre un raccourci périmé.
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const raw = await readJson('settings').catch(() => undefined);
  await writeJson('settings', mergeSettings(raw, settings));
}
