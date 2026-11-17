/**
 * Lecture des fichiers de données, partagée avec la palette. Lecture seule : ce module
 * n'importe ni le catalogue livré (`official.ts`), ni le modèle complet des réglages (raccourcis),
 * ni rien de ce que seule la fenêtre principale écrit et fusionne (`storage.ts`). La palette
 * n'embarque ainsi que ce qu'elle lit.
 *
 * Dans Tauri, délègue à la commande Rust `load_store` (`src-tauri/src/storage.rs`). Dans le
 * navigateur (`npm run dev`), lit localStorage.
 */
import { invoke } from '@tauri-apps/api/core';
import defaultAliases from '../../../resources/aliases.default.json';
import {
  aliasesFileProblem,
  EMPTY_USER_ALIASES,
  parseDefaultAliases,
  parseUserAliases,
  type UserAliases,
} from '../../features/aliases/aliases';
import { SCHEMA_VERSION, validateCatalog, type Catalog, type ValidationResult } from '../../features/catalog/schema';
import { parsePaletteSettings, type PaletteSettings } from '../../features/settings/paletteSettings';
import { isRecord } from '../../features/shared/json';
import { IS_TAURI } from './env';

export type StoreName = 'catalog' | 'favorites' | 'settings' | 'aliases' | 'official';

/** Préfixe des clés localStorage du mode navigateur. */
export const LS_PREFIX = 'map-traveller:';

/**
 * Événement « un fichier de données vient d'être écrit », charge utile = nom du stockage
 * (`catalog`, `aliases`…). Dans Tauri, émis par Rust après chaque `save_store` réussi, vers la
 * seule palette (`storage::STORE_CHANGED_EVENT`) ; dans le navigateur, message du canal
 * `BroadcastChannel` du même nom, envoyé par `storage.ts` d'un onglet à l'autre.
 */
export const STORE_CHANGED_EVENT = 'store:changed';

/**
 * Texte brut d'un stockage, ou `null` s'il n'existe pas encore. La palette s'en sert aussi pour
 * ne rien recharger quand le fichier n'a pas changé depuis son dernier affichage.
 */
export async function readStoreText(name: StoreName): Promise<string | null> {
  if (IS_TAURI) return invoke<string | null>('load_store', { name });
  try {
    return localStorage.getItem(LS_PREFIX + name);
  } catch {
    return null;
  }
}

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

/** Favoris pour la palette, qui n'écrit jamais : tout problème donne un ensemble vide. */
export async function loadFavorites(): Promise<ReadonlySet<string>> {
  const raw = await readStoreText('favorites').catch(() => null);
  return parseFavoritesText(raw).value;
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

/**
 * Rubrique `palette` des réglages, pour la palette qui ne les écrit jamais : fichier absent,
 * illisible ou de forme inattendue → valeurs par défaut.
 */
export async function loadPaletteSettings(): Promise<PaletteSettings> {
  const raw = await readStoreText('settings').catch(() => null);
  let data: unknown;
  try {
    data = raw == null ? undefined : JSON.parse(raw);
  } catch {
    data = undefined;
  }
  return parsePaletteSettings(data);
}
