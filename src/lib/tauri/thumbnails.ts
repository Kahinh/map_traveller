/**
 * Fabrication des vignettes (issue n°14, A4), fenêtre principale seulement.
 *
 * Dans la page, sans bibliothèque d'images : Rust relit l'original (`read_image`), la page
 * en découpe le carré central réduit à 256 px (`centerCrop`), l'encode en WebP et le renvoie
 * (`save_thumbnail`). Une seule vignette à la fois, uniquement à la demande (carte affichée
 * sans vignette, image importée) : aucun travail au repos, aucun minuteur. Un échec n'est
 * jamais bloquant : la carte garde l'original.
 */
import { invoke } from '@tauri-apps/api/core';
import { centerCrop, thumbPath } from '../../features/catalog/thumbnails';
import { IS_TAURI } from './env';
import { setThumbnailMaker, thumbReady } from './images';

/** Qualité WebP : invisible à 90 px, quelques dizaines de Ko. */
const WEBP_QUALITY = 0.82;

const queue: string[] = [];
/** Images déjà demandées dans cette session (une tentative chacune). */
const requested = new Set<string>();
let running = false;

async function build(relative: string): Promise<void> {
  const original = await invoke<ArrayBuffer>('read_image', { relative });
  const bitmap = await createImageBitmap(new Blob([original]));
  try {
    const { sx, sy, side, size } = centerCrop(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
    if (blob.type !== 'image/webp') return; // encodeur WebP absent : on garde l'original
    await invoke('save_thumbnail', new Uint8Array(await blob.arrayBuffer()), { headers: { 'x-image': relative } });
    thumbReady(relative);
  } finally {
    bitmap.close();
  }
}

async function drain(): Promise<void> {
  running = true;
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    try {
      await build(next);
    } catch (e) {
      console.warn(`Vignette de ${next} impossible :`, e);
    }
  }
  running = false;
}

/** Demande la vignette d'une image importée ; sans effet si elle est déjà demandée. */
export function makeThumbnail(relative: string): void {
  if (!IS_TAURI || thumbPath(relative) === null || requested.has(relative)) return;
  requested.add(relative);
  queue.push(relative);
  if (!running) void drain();
}

/** À appeler une fois au démarrage de la fenêtre principale. */
export function enableThumbnails(): void {
  setThumbnailMaker(makeThumbnail);
}
