/** Vrai quand l'interface tourne dans la WebView Tauri (et non dans un navigateur via `npm run dev`). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
