/**
 * Pont des raccourcis globaux. Dans Tauri : commandes Rust `get_shortcuts`, `set_shortcut` et
 * `reset_shortcuts` (`src-tauri/src/shortcuts.rs`), qui enregistrent les raccourcis et écrivent
 * `settings.json`. L'interface n'a AUCUNE permission de raccourci global.
 * Dans le navigateur (`npm run dev`) : lecture des valeurs par défaut, modification refusée.
 */
import { invoke } from '@tauri-apps/api/core';
import {
  defaultShortcutsState,
  parseShortcutsState,
  type ShortcutAction,
  type ShortcutsState,
} from '../../features/settings/accelerator';
import { isTauri } from './env';

export const BROWSER_SHORTCUTS_MESSAGE = "Réglage disponible uniquement dans l'application installée.";

/** Vrai si les raccourcis peuvent être modifiés (application installée). */
export function canConfigureShortcuts(): boolean {
  return isTauri();
}

function toState(value: unknown): ShortcutsState {
  const state = parseShortcutsState(value);
  if (state === null) throw new Error("Réponse inattendue de l'application pour les raccourcis.");
  return state;
}

/** Raccourcis effectifs et état de leur enregistrement. */
export async function getShortcuts(): Promise<ShortcutsState> {
  if (!isTauri()) return defaultShortcutsState();
  return toState(await invoke<unknown>('get_shortcuts'));
}

/**
 * Change le raccourci d'une action. Rejette avec le message de Rust (en français) si la chaîne
 * est invalide, déjà utilisée par l'autre action ou refusée par le système ; l'ancien raccourci
 * reste alors actif.
 */
export async function setShortcut(action: ShortcutAction, accelerator: string): Promise<ShortcutsState> {
  if (!isTauri()) throw new Error(BROWSER_SHORTCUTS_MESSAGE);
  return toState(await invoke<unknown>('set_shortcut', { action, accelerator }));
}

/** Rétablit les deux raccourcis par défaut. */
export async function resetShortcuts(): Promise<ShortcutsState> {
  if (!isTauri()) throw new Error(BROWSER_SHORTCUTS_MESSAGE);
  return toState(await invoke<unknown>('reset_shortcuts'));
}
