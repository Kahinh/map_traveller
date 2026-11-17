/**
 * Pont de persistance de la fenêtre principale. Dans Tauri, délègue aux commandes Rust
 * (`src-tauri/src/storage.rs`) qui écrivent de façon atomique dans `%APPDATA%\MapTraveller\`.
 * Dans le navigateur (`npm run dev`), retombe sur localStorage + seed pour itérer sur l'UI.
 * La lecture et l'analyse des fichiers, partagées avec la palette, sont dans `storeRead.ts` ;
 * ici, ce que seule la fenêtre principale lit (catalogue livré, réglages complets) et écrit.
 */
import { invoke } from '@tauri-apps/api/core';
import { aliasesFileProblem, mergeUserAliases, type UserAliases } from '../../features/aliases/aliases';
import { parseOfficialState, type OfficialState, type OfficialStateResult } from '../../features/catalog/official';
import { validateCatalog, type Catalog, type ValidationResult } from '../../features/catalog/schema';
import { mergeSettings, parseSettings, type Settings } from '../../features/settings/settings';
import { isRecord } from '../../features/shared/json';
import { IS_TAURI } from './env';
import {
  LS_PREFIX,
  parseAliasesText,
  parseCatalogText,
  parseFavoritesText,
  readStoreText as readRaw,
  STORE_CHANGED_EVENT,
  type LoadedAliases,
  type StoreName,
  type StoreRead,
} from './storeRead';

export { DEFAULT_ALIASES, parseFavoritesText, type StoreRead } from './storeRead';

/** Mode navigateur : prévient la palette ouverte dans un autre onglet, comme le fait Rust dans l'application. */
function announceChange(name: StoreName): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(STORE_CHANGED_EVENT);
  channel.postMessage(name);
  channel.close();
}

async function writeRaw(name: StoreName, json: string): Promise<void> {
  // Dans l'application, Rust prévient la palette (`store:changed`) après l'écriture.
  if (IS_TAURI) return invoke('save_store', { name, json });
  try {
    localStorage.setItem(LS_PREFIX + name, json);
  } catch {
    /* stockage navigateur indisponible : mode démo non persistant */
    return;
  }
  announceChange(name);
}

/** Contenu JSON d'un stockage ; `undefined` s'il n'existe pas encore. Lève si le JSON est invalide. */
async function readJson(name: StoreName): Promise<unknown> {
  const raw = await readRaw(name);
  return raw == null ? undefined : JSON.parse(raw);
}

const writeJson = (name: StoreName, data: unknown) => writeRaw(name, JSON.stringify(data, null, 2));

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

/** Favoris de la fenêtre principale. Rejette si la lecture elle-même échoue. */
export async function readFavorites(): Promise<StoreRead<ReadonlySet<string>>> {
  return parseFavoritesText(await readRaw('favorites'));
}

export function saveFavorites(ids: ReadonlySet<string>): Promise<void> {
  return writeJson('favorites', { ids: [...ids].sort() });
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
