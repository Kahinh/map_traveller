/**
 * Résolution des images du catalogue (chemins relatifs `images/...`).
 * Dans Tauri, le dossier de données est servi par le protocole `asset:` (scope limité à images/).
 *
 * `initImages()` est appelé une fois au démarrage ; `imageSrc()` est ensuite SYNCHRONE,
 * ce qui évite un effet + un état par carte.
 *
 * Vignettes (issue n°14, A4) : `thumbSrc()` donne l'adresse de la vignette 256 px. Une vignette
 * absente est signalée par `thumbMissing()` : la carte affiche alors l'original, et la fenêtre
 * principale, seule à avoir enregistré un producteur (`setThumbnailMaker`), la fabrique pour les
 * affichages suivants. La palette n'en enregistre pas : elle n'embarque pas ce code.
 *
 * Ce module est partagé avec la palette : rien ici n'importe le dialogue de fichiers
 * (import d'images : `imageImport.ts`, fenêtre principale seulement).
 */
import { convertFileSrc } from '@tauri-apps/api/core';
import { thumbPath } from '../../features/catalog/thumbnails';
import { getDataDir } from './dataDir';
import { IS_TAURI } from './env';

let dataDir: string | null = null;

/** Mémorise le dossier de données. À attendre avant le premier rendu des cartes. */
export async function initImages(): Promise<void> {
  if (IS_TAURI && dataDir === null) dataDir = await getDataDir();
}

/** URL affichable pour une image relative, ou `null` (placeholder). */
export function imageSrc(relative: string | null): string | null {
  if (!relative) return null;
  // Navigateur de développement : seules les images livrées existent, servies depuis le dépôt.
  if (!IS_TAURI) return `/resources/${relative}`;
  if (dataDir === null) return null;
  return convertFileSrc(`${dataDir}\\${relative.replaceAll('/', '\\')}`);
}

/** Images dont la vignette manque (pour cette session) : affichées directement en original. */
const missingThumbs = new Set<string>();
let thumbnailMaker: ((relative: string) => void) | null = null;

/**
 * URL de la vignette d'une image importée, ou `null` : pas de vignette possible, vignette
 * absente, ou navigateur de développement (les images n'y ont pas de vignette).
 */
export function thumbSrc(relative: string | null): string | null {
  if (!relative || !IS_TAURI || missingThumbs.has(relative)) return null;
  return imageSrc(thumbPath(relative));
}

/**
 * La vignette de `relative` n'a pas pu être affichée : original jusqu'à sa fabrication. Sans
 * producteur (palette, qui vit tant que l'application tourne), rien n'est mémorisé : chaque
 * affichage retente la vignette, que la fenêtre principale a pu fabriquer entre-temps.
 */
export function thumbMissing(relative: string): void {
  if (!thumbnailMaker) return;
  missingThumbs.add(relative);
  thumbnailMaker(relative);
}

/** La vignette de `relative` vient d'être enregistrée : les prochains affichages l'utilisent. */
export function thumbReady(relative: string): void {
  missingThumbs.delete(relative);
}

/** Fenêtre principale uniquement : fabrique les vignettes manquantes. */
export function setThumbnailMaker(maker: ((relative: string) => void) | null): void {
  thumbnailMaker = maker;
}
