/**
 * Import d'images : dialogue de fichiers natif puis copie par Rust (`images.rs`). Fenêtre
 * principale seulement : la palette n'importe pas ce module, ni donc le plugin de dialogue.
 */
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { isTauri } from './env';
import { makeThumbnail } from './thumbnails';

/** Extensions proposées par le dialogue ; le format réel est contrôlé par Rust (`images.rs`). */
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

/** L'import d'images demande l'application installée (dialogue natif + copie par Rust). */
export function canImportImages(): boolean {
  return isTauri();
}

/**
 * Ouvre le dialogue de fichier natif puis copie l'image choisie dans le dossier de données.
 * Renvoie le chemin relatif `images/<nom>` à enregistrer, ou `null` si le dialogue est annulé.
 * Lève une erreur (message en français renvoyé par Rust) si le fichier est refusé. La vignette
 * est demandée aussitôt, en arrière-plan.
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
  const relative = await invoke<string>('import_image', { sourcePath: selected });
  makeThumbnail(relative);
  return relative;
}
