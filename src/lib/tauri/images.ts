/**
 * Résolution des images du catalogue (chemins relatifs `images/...`).
 * Dans Tauri, le dossier de données est servi par le protocole `asset:` (scope limité à images/).
 *
 * `initImages()` est appelé une fois au démarrage ; `imageSrc()` est ensuite SYNCHRONE,
 * ce qui évite un effet + un état par carte.
 *
 * Vignettes (issue n°14, A4) : `thumbSrc()` donne l'adresse de la vignette 256 px. Une vignette
 * absente est signalée par `thumbMissing()` et mémorisée : les affichages suivants prennent
 * directement l'original. La fenêtre principale, seule à avoir enregistré un producteur
 * (`setThumbnailMaker`), la fabrique. La palette n'en a pas (elle n'embarque pas ce code) : elle
 * oublie ces échecs à chaque ouverture (`forgetMissingThumbs`), pour retrouver une fois par
 * ouverture une vignette fabriquée entre-temps.
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

/** La vignette de `relative` n'a pas pu être affichée : original jusqu'à sa fabrication. */
export function thumbMissing(relative: string): void {
  if (missingThumbs.has(relative)) return;
  missingThumbs.add(relative);
  thumbnailMaker?.(relative);
}

/** Palette, à chaque ouverture : les vignettes manquantes sont retentées une fois. */
export function forgetMissingThumbs(): void {
  missingThumbs.clear();
}

/** La vignette de `relative` vient d'être enregistrée : les prochains affichages l'utilisent. */
export function thumbReady(relative: string): void {
  missingThumbs.delete(relative);
}

/** Fenêtre principale uniquement : fabrique les vignettes manquantes. */
export function setThumbnailMaker(maker: ((relative: string) => void) | null): void {
  thumbnailMaker = maker;
}
