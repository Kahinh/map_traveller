/**
 * Abonnement aux événements émis par Rust, partagé par la palette et la fenêtre d'un parcours
 * Farm. Dans le navigateur (`npm run dev`), événements DOM de `window`, que l'on peut émettre à
 * la main pour contrôler une page.
 */
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { IS_TAURI } from './env';

/**
 * Abonne `callback` à un événement émis par Rust (palette, fenêtre Farm) : événement Tauri émis par Rust, ou événement
 * DOM de `window` dans le navigateur. Renvoie la fonction de désabonnement, sûre même si
 * l'abonnement Tauri n'est pas encore établi.
 */
export function subscribe<T = unknown>(event: string, callback: (payload: T) => void): () => void {
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
