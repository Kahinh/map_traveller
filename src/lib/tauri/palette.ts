/**
 * Pont de la fenêtre palette. Dans Tauri : commande Rust `hide_palette` et événement
 * `palette:shown` émis par Rust à chaque affichage. Dans le navigateur (`npm run dev`,
 * page `palette.html`) : masquer ne fait rien, et l'affichage est simulé une fois au chargement.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from './env';

/** Commande Rust qui masque (sans la détruire) la fenêtre palette. */
export const HIDE_PALETTE_COMMAND = 'hide_palette';
/** Commande Rust qui ajuste la hauteur de la fenêtre palette à son contenu. */
export const SET_PALETTE_HEIGHT_COMMAND = 'set_palette_height';
/** Événement émis par Rust vers la fenêtre palette juste après son affichage. */
export const PALETTE_SHOWN_EVENT = 'palette:shown';

/** Masque la palette. Sans effet dans le navigateur. Lève si la commande Rust échoue. */
export async function hidePalette(): Promise<void> {
  if (isTauri()) await invoke(HIDE_PALETTE_COMMAND);
}

/**
 * Demande à Rust de donner à la FENÊTRE la hauteur de son contenu (pixels logiques). Rust borne
 * la valeur. Sans effet dans le navigateur. Ne lève jamais : un échec laisse la fenêtre à sa
 * taille précédente et est seulement journalisé.
 */
export function setPaletteHeight(height: number): void {
  if (!isTauri()) return;
  invoke(SET_PALETTE_HEIGHT_COMMAND, { height }).catch((e: unknown) =>
    console.error('Redimensionnement de la palette impossible', e),
  );
}

/**
 * Appelle `callback` à chaque affichage de la palette. Renvoie la fonction de désabonnement.
 *
 * - Tauri : écoute `palette:shown`. Le rappel est AUSSI appelé une fois à l'abonnement : à la
 *   première ouverture, la fenêtre est créée puis l'événement émis, possiblement avant que la
 *   page ait fini de charger et d'écouter ; sans cet appel, le premier affichage serait vide.
 * - Navigateur : appelé une fois au chargement.
 *
 * L'appel initial est différé d'une micro-tâche et annulé si l'on s'est désabonné entre-temps
 * (double montage de `StrictMode` en développement).
 */
export function onPaletteShown(callback: () => void): () => void {
  let disposed = false;
  let unlisten: UnlistenFn | null = null;

  queueMicrotask(() => {
    if (!disposed) callback();
  });

  if (isTauri()) {
    listen(PALETTE_SHOWN_EVENT, () => {
      if (!disposed) callback();
    })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch((e: unknown) => console.error('Écoute de palette:shown impossible', e));
  }

  return () => {
    disposed = true;
    unlisten?.();
    unlisten = null;
  };
}
