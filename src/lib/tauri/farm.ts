/**
 * Pont de la fenêtre d'un parcours Farm (`src-tauri/src/farm_window.rs`).
 *
 * Dans Tauri : `open_farm` (fenêtre principale, palette) ouvre la fenêtre sur un parcours ;
 * la page lit le parcours à afficher par `get_farm_id`, puis le suit par `farm:open`.
 * Dans le navigateur (`npm run dev`, page `farm.html`) : le parcours vient de l'adresse
 * (`farm.html?id=<identifiant>`), et `farm:open` est un événement DOM de `window`
 * (`dispatchEvent(new CustomEvent('farm:open', { detail: 'id' }))`).
 */
import { invoke } from '@tauri-apps/api/core';
import { IS_TAURI } from './env';
import { subscribe } from './events';

const OPEN_FARM_COMMAND = 'open_farm';
const GET_FARM_ID_COMMAND = 'get_farm_id';
const HIDE_FARM_COMMAND = 'hide_farm';
/** Événement émis par Rust vers la fenêtre Farm à chaque ouverture (`farm_window::OPEN_EVENT`). */
export const FARM_OPEN_EVENT = 'farm:open';

/**
 * Ouvre la fenêtre du parcours `id` (toujours au premier plan). Lève si Rust refuse.
 * Navigateur : ouvre `farm.html?id=…` dans un nouvel onglet.
 */
export async function openFarm(id: string): Promise<void> {
  if (IS_TAURI) await invoke(OPEN_FARM_COMMAND, { id });
  else window.open(`/farm.html?id=${encodeURIComponent(id)}`, '_blank');
}

/** Parcours à afficher au chargement de la page, ou `null`. */
export async function getFarmId(): Promise<string | null> {
  if (IS_TAURI) return invoke<string | null>(GET_FARM_ID_COMMAND);
  return new URLSearchParams(window.location.search).get('id');
}

/** Masque la fenêtre Farm (jamais détruite). Lève si Rust échoue. Sans effet dans le navigateur. */
export async function hideFarm(): Promise<void> {
  if (IS_TAURI) await invoke(HIDE_FARM_COMMAND);
}

/** Appelle `callback` avec l'identifiant du parcours à chaque ouverture. Renvoie le désabonnement. */
export function onFarmOpen(callback: (id: string) => void): () => void {
  return subscribe<string>(FARM_OPEN_EVENT, callback);
}
