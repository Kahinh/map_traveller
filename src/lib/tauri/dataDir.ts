/**
 * Dossier de données de l'application (`%APPDATA%\MapTraveller\`). Le chemin vient TOUJOURS de
 * Rust (`storage::app_data_dir`, commande `data_dir`) : aucune chaîne écrite dans l'interface.
 * Dans le navigateur (`npm run dev`), il n'existe pas : chemin `null`, ouverture refusée.
 */
import { invoke } from '@tauri-apps/api/core';
import { INSTALLED_ONLY, IS_TAURI } from './env';

let cached: Promise<string> | null = null;

/** Chemin absolu du dossier de données, mis en cache après le premier appel ; `null` dans le navigateur. */
export async function getDataDir(): Promise<string | null> {
  if (!IS_TAURI) return null;
  if (cached === null) {
    cached = invoke<string>('data_dir');
    // Un échec n'est pas mis en cache : le prochain appel réessaie.
    cached.catch(() => {
      cached = null;
    });
  }
  return cached;
}

/**
 * Ouvre l'Explorateur Windows sur le dossier de données. Sans paramètre : Rust calcule
 * lui-même le chemin (`open_data_dir`), l'interface ne peut pas faire ouvrir un autre dossier.
 * Rejette avec le message de Rust (en français) si l'Explorateur n'a pas pu être lancé.
 */
export async function openDataDir(): Promise<void> {
  if (!IS_TAURI) throw new Error(INSTALLED_ONLY);
  await invoke('open_data_dir');
}
