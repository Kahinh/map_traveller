/**
 * Pont de la fenêtre palette. Dans Tauri : commande Rust `hide_palette`, événements
 * `palette:shown` et `palette:hidden` émis par Rust à chaque affichage et à chaque masquage.
 * Dans le navigateur (`npm run dev`, page `palette.html`) : l'affichage est simulé une fois au
 * chargement, et les deux événements sont des événements DOM de `window`, que l'on peut émettre
 * à la main pour contrôler la page (`dispatchEvent(new Event('palette:hidden'))`) ; masquer
 * émet `palette:hidden`, comme le ferait Rust. Même principe pour `store:changed` (`onStoreChanged`).
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { IS_TAURI } from './env';
import { STORE_CHANGED_EVENT, type StoreName } from './storeRead';

/** Commande Rust qui masque (sans la détruire) la fenêtre palette. */
const HIDE_PALETTE_COMMAND = 'hide_palette';
/** Commande Rust qui ajuste la hauteur de la fenêtre palette à son contenu. */
const SET_PALETTE_HEIGHT_COMMAND = 'set_palette_height';
/** Événement émis par Rust vers la fenêtre palette juste après son affichage (`palette::SHOWN_EVENT`). */
export const PALETTE_SHOWN_EVENT = 'palette:shown';
/** Événement émis par Rust vers la fenêtre palette après chaque masquage (`palette::HIDDEN_EVENT`). */
export const PALETTE_HIDDEN_EVENT = 'palette:hidden';

/** Masque la palette. Lève si la commande Rust échoue. Navigateur : émet seulement `palette:hidden`. */
export async function hidePalette(): Promise<void> {
  if (IS_TAURI) await invoke(HIDE_PALETTE_COMMAND);
  else window.dispatchEvent(new Event(PALETTE_HIDDEN_EVENT));
}

/**
 * Abonne `callback` à un événement de la palette : événement Tauri émis par Rust, ou événement
 * DOM de `window` dans le navigateur. Renvoie la fonction de désabonnement, sûre même si
 * l'abonnement Tauri n'est pas encore établi.
 */
function subscribe<T = unknown>(event: string, callback: (payload: T) => void): () => void {
  if (!IS_TAURI) {
    const onEvent = (e: Event) => callback((e as CustomEvent<T>).detail);
    window.addEventListener(event, onEvent);
    return () => window.removeEventListener(event, onEvent);
  }
  let disposed = false;
  let unlisten: UnlistenFn | null = null;
  listen<T>(event, (e) => {
    if (!disposed) callback(e.payload);
  })
    .then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    })
    .catch((e: unknown) => console.error(`Écoute de ${event} impossible`, e));
  return () => {
    disposed = true;
    unlisten?.();
    unlisten = null;
  };
}

/**
 * Demande à Rust de donner à la FENÊTRE la hauteur de son contenu (pixels logiques). Rust borne
 * la valeur. Sans effet dans le navigateur. Ne lève jamais : un échec laisse la fenêtre à sa
 * taille précédente et est seulement journalisé.
 */
export function setPaletteHeight(height: number): void {
  if (!IS_TAURI) return;
  invoke(SET_PALETTE_HEIGHT_COMMAND, { height }).catch((e: unknown) =>
    console.error('Redimensionnement de la palette impossible', e),
  );
}

/**
 * Appelle `callback` à chaque affichage de la palette. Renvoie la fonction de désabonnement.
 *
 * Le rappel est AUSSI appelé une fois à l'abonnement : à la première ouverture, la fenêtre peut
 * être affichée et l'événement émis avant que la page ait fini de charger et d'écouter ; sans
 * cet appel, le premier affichage ne chargerait rien. Dans le navigateur, c'est l'affichage
 * simulé au chargement. L'appel initial est différé d'une micro-tâche et annulé si l'on s'est
 * désabonné entre-temps (double montage de `StrictMode` en développement).
 */
export function onPaletteShown(callback: () => void): () => void {
  let disposed = false;
  queueMicrotask(() => {
    if (!disposed) callback();
  });
  const unsubscribe = subscribe(PALETTE_SHOWN_EVENT, () => callback());
  return () => {
    disposed = true;
    unsubscribe();
  };
}

/**
 * Appelle `callback` après chaque masquage effectif de la palette (un seul appel par masquage,
 * quelle qu'en soit la cause). Renvoie la fonction de désabonnement.
 */
export function onPaletteHidden(callback: () => void): () => void {
  return subscribe(PALETTE_HIDDEN_EVENT, () => callback());
}

/**
 * Appelle `callback` avec le nom du stockage chaque fois qu'un fichier de données est écrit
 * (`store:changed`, émis par Rust après `save_store`), y compris palette masquée : elle relit le
 * fichier et reconstruit son index avant la prochaine ouverture. Dans le navigateur : messages du
 * `BroadcastChannel` envoyés par `storage.ts` depuis l'onglet de la fenêtre principale, ou
 * événement DOM émis à la main (`dispatchEvent(new CustomEvent('store:changed', { detail: 'catalog' }))`).
 */
export function onStoreChanged(callback: (name: StoreName) => void): () => void {
  const unsubscribe = subscribe<StoreName>(STORE_CHANGED_EVENT, callback);
  if (IS_TAURI || typeof BroadcastChannel === 'undefined') return unsubscribe;
  const channel = new BroadcastChannel(STORE_CHANGED_EVENT);
  channel.onmessage = (e: MessageEvent<StoreName>) => callback(e.data);
  return () => {
    unsubscribe();
    channel.close();
  };
}
