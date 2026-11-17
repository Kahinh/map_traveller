/**
 * Vrai quand l'interface tourne dans la WebView Tauri (et non dans un navigateur via `npm run dev`).
 * Tauri injecte `__TAURI_INTERNALS__` avant tout script de la page : une constante suffit.
 */
export const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Forme fonction, conservée pour la palette (`palette.ts`). */
export const isTauri = (): boolean => IS_TAURI;

/** Seul message affiché, partout, pour une fonction absente du mode navigateur. */
export const INSTALLED_ONLY = "Disponible dans l'application installée";
