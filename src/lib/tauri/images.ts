/**
 * Résolution des images du catalogue (chemins relatifs `images/...`).
 * Dans Tauri, le dossier de données est servi par le protocole `asset:` (scope limité à images/).
 *
 * `initImages()` est appelé une fois au démarrage ; `imageSrc()` est ensuite SYNCHRONE,
 * ce qui évite un effet + un état par carte.
 */
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { isTauri } from './env';

let dataDir: string | null = null;

/** Mémorise le dossier de données. À attendre avant le premier rendu des cartes. */
export async function initImages(): Promise<void> {
  if (isTauri() && dataDir === null) dataDir = await invoke<string>('data_dir');
}

/** URL affichable pour une image relative, ou `null` (placeholder). */
export function imageSrc(relative: string | null): string | null {
  if (!relative) return null;
  if (!isTauri()) return `/${relative}`;
  if (dataDir === null) return null;
  return convertFileSrc(`${dataDir}\\${relative.replaceAll('/', '\\')}`);
}
