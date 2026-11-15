/**
 * Résolution des images du catalogue (chemins relatifs `images/...`).
 * Dans Tauri, le dossier de données est servi par le protocole `asset:` (scope limité à images/).
 *
 * `initImages()` est appelé une fois au démarrage ; `imageSrc()` est ensuite SYNCHRONE,
 * ce qui évite un effet + un état par carte.
 */
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { getDataDir } from './dataDir';
import { isTauri } from './env';

/** Extensions proposées par le dialogue ; le format réel est contrôlé par Rust (`images.rs`). */
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

let dataDir: string | null = null;

/** Mémorise le dossier de données. À attendre avant le premier rendu des cartes. */
export async function initImages(): Promise<void> {
  if (isTauri() && dataDir === null) dataDir = await getDataDir();
}

/** URL affichable pour une image relative, ou `null` (placeholder). */
export function imageSrc(relative: string | null): string | null {
  if (!relative) return null;
  if (!isTauri()) return `/${relative}`;
  if (dataDir === null) return null;
  return convertFileSrc(`${dataDir}\\${relative.replaceAll('/', '\\')}`);
}

/** L'import d'images demande l'application installée (dialogue natif + copie par Rust). */
export function canImportImages(): boolean {
  return isTauri();
}

/**
 * Ouvre le dialogue de fichier natif puis copie l'image choisie dans le dossier de données.
 * Renvoie le chemin relatif `images/<nom>` à enregistrer, ou `null` si le dialogue est annulé.
 * Lève une erreur (message en français renvoyé par Rust) si le fichier est refusé.
 */
export async function pickAndImportImage(): Promise<string | null> {
  if (!canImportImages()) throw new Error('Import d\'images disponible uniquement dans l\'application installée.');
  const selected = await open({
    title: 'Choisir une image',
    multiple: false,
    directory: false,
    filters: [{ name: 'Images (PNG, JPEG, WebP)', extensions: IMAGE_EXTENSIONS }],
  });
  if (selected === null) return null;
  return invoke<string>('import_image', { sourcePath: selected });
}
