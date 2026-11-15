/** Actions de fenêtre ; sans effet dans le navigateur. */
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './env';

const win = () => (isTauri() ? getCurrentWindow() : null);

/** Commande Rust du bouton réduire : zone de notification ou barre des tâches selon le réglage. */
export const MINIMIZE_MAIN_COMMAND = 'minimize_main';
/** Commande Rust qui signale une saisie en cours : la fenêtre n'est alors jamais détruite. */
export const SET_MAIN_BUSY_COMMAND = 'set_main_busy';

export async function setAlwaysOnTop(value: boolean): Promise<void> {
  await win()?.setAlwaysOnTop(value);
}

/**
 * Bouton réduire. Rust décide (`src-tauri/src/main_window.rs`) : réglage « Réduire dans la zone
 * de notification » actif et aucun formulaire ouvert → la fenêtre est fermée, l'application reste
 * dans la zone de notification ; sinon → réduite dans la barre des tâches.
 */
export async function minimizeWindow(): Promise<void> {
  if (isTauri()) await invoke(MINIMIZE_MAIN_COMMAND);
}

/** Signale à Rust qu'une saisie est en cours (formulaire ouvert). Sans effet dans le navigateur. */
export async function setMainBusy(busy: boolean): Promise<void> {
  if (isTauri()) await invoke(SET_MAIN_BUSY_COMMAND, { busy });
}

export async function closeWindow(): Promise<void> {
  await win()?.close();
}
