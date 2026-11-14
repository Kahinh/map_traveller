/**
 * Pont de persistance. Dans Tauri, délègue aux commandes Rust (`src-tauri/src/storage.rs`)
 * qui écrivent de façon atomique dans `%APPDATA%\MapTraveller\`. Dans le navigateur
 * (`npm run dev`), retombe sur localStorage + seed pour itérer sur l'UI.
 */
import seed from '../../../resources/catalog.seed.json';
import { validateCatalog, type Catalog, type ValidationError } from '../../features/catalog/schema';
import { isTauri } from './env';

export type StoreName = 'catalog' | 'favorites' | 'settings';

const LS_PREFIX = 'map-traveller:';

async function readRaw(name: StoreName): Promise<string | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('load_store', { name });
  }
  try {
    return localStorage.getItem(LS_PREFIX + name);
  } catch {
    return null;
  }
}

async function writeRaw(name: StoreName, json: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_store', { name, json });
    return;
  }
  try {
    localStorage.setItem(LS_PREFIX + name, json);
  } catch {
    /* stockage navigateur indisponible : mode démo non persistant */
  }
}

export type LoadCatalogResult =
  | { ok: true; catalog: Catalog }
  | { ok: false; errors: ValidationError[] };

/** Charge et valide le catalogue utilisateur (le seed est copié par Rust au premier lancement). */
export async function loadCatalog(): Promise<LoadCatalogResult> {
  const raw = await readRaw('catalog');
  let data: unknown = seed;
  if (raw != null) {
    try {
      data = JSON.parse(raw);
    } catch {
      return { ok: false, errors: [{ path: '', message: 'catalog.json illisible (JSON invalide).' }] };
    }
  }
  return validateCatalog(data);
}

/** Valide puis enregistre. Refuse d'écrire un catalogue invalide. */
export async function saveCatalog(catalog: Catalog): Promise<void> {
  const check = validateCatalog(catalog);
  if (!check.ok) throw new Error(check.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
  await writeRaw('catalog', JSON.stringify(check.catalog, null, 2));
}

export async function loadFavorites(): Promise<Set<string>> {
  const raw = await readRaw('favorites');
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    const ids = (parsed as { ids?: unknown }).ids;
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export async function saveFavorites(ids: ReadonlySet<string>): Promise<void> {
  await writeRaw('favorites', JSON.stringify({ ids: [...ids].sort() }, null, 2));
}

export interface Settings {
  alwaysOnTop: boolean;
}

export const DEFAULT_SETTINGS: Settings = { alwaysOnTop: true };

export async function loadSettings(): Promise<Settings> {
  const raw = await readRaw('settings');
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, alwaysOnTop: parsed.alwaysOnTop !== false };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeRaw('settings', JSON.stringify(settings, null, 2));
}
