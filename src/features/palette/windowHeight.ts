/**
 * Hauteur de la FENÊTRE palette (issue n°19) : quand la demander à Rust. Fonctions pures.
 *
 * La page mesure son contenu après chaque rendu et n'envoie une hauteur que si elle diffère de
 * la dernière connue de la fenêtre : un appel par changement de hauteur, jamais par frappe.
 * - Masquage (`palette:hidden`) : la page se remet à zéro (barre seule) et la hauteur connue
 *   devient inconnue : le rendu suivant envoie la hauteur de la barre pendant que la fenêtre
 *   est masquée, hors de la vue de l'utilisateur.
 * - Affichage (`palette:shown`) : Rust vient de rouvrir la fenêtre réduite à la barre ; c'est
 *   la hauteur connue, et la page, déjà remise à zéro, n'a normalement rien à envoyer.
 */

/** Hauteur de la barre seule : `BAR_HEIGHT` de `src-tauri/src/palette.rs` (cadre 2 + barre 46). */
export const PALETTE_BAR_HEIGHT = 48;

/** Lignes de résultats visibles avant défilement : `--pal-max-rows` de `src/styles/palette.css`. */
export const PALETTE_VISIBLE_ROWS = 8;

/**
 * Hauteur à envoyer à la fenêtre après une mesure, ou `null` : rien à envoyer (même hauteur que
 * la fenêtre, ou mesure impossible). `known` = hauteur actuelle de la fenêtre, `null` si inconnue.
 */
export function heightToSend(measured: number | undefined, known: number | null): number | null {
  if (measured === undefined || !Number.isFinite(measured) || measured <= 0) return null;
  return measured === known ? null : measured;
}
