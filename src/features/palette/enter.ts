/**
 * Palette : ce que copie la touche Entrée (issue n°24). Fonctions pures.
 *
 * Entrée agit sur la DERNIÈRE VALEUR SAISIE, jamais sur des résultats en retard : si le champ
 * contient déjà « rdv » alors que la liste affichée est encore celle de « rd » (frappe plus
 * rapide que le rendu), la recherche est refaite aussitôt sur « rdv » et sa première ligne est
 * copiée, dans sa variante par défaut. Aucune ligne d'une requête plus ancienne n'est copiée.
 */
import type { NavState } from './navigation';
import type { PaletteEntry } from './types';

/** Résultats affichés, avec la requête pour laquelle ils ont été calculés. */
export interface ShownResults {
  query: string;
  entries: readonly PaletteEntry[];
}

/** Ligne à copier et texte de la variante choisie (`null` : rien à copier, avertissement). */
export interface CopyChoice {
  entry: PaletteEntry;
  text: string | null;
}

/**
 * Texte de la variante `choice` de la ligne (bornée à ses variantes), ou de l'autre variante si
 * `alternate` (Ctrl+Entrée, clic droit sur la ligne). `null` : la ligne n'a rien à copier.
 */
export function variantText(entry: PaletteEntry, choice: number, alternate: boolean): string | null {
  const { variants } = entry;
  let idx = Math.min(Math.max(0, choice), Math.max(0, variants.length - 1));
  if (alternate && variants.length === 2) idx = 1 - idx;
  return variants[idx]?.text ?? null;
}

/**
 * Décision de la touche Entrée.
 * - `value` : valeur du champ au moment de la touche (`input.value`) ;
 * - `shown` et `nav` : résultats affichés, leur requête, et la sélection dans ces résultats ;
 * - `alternate` : Ctrl (ou Cmd) enfoncé ;
 * - `search` : recherche synchrone, avec les mêmes options que l'affichage.
 * Renvoie `null` (aucune copie) pour un champ vide ou sans résultat.
 */
export function enterChoice(
  value: string,
  shown: ShownResults,
  nav: NavState,
  alternate: boolean,
  search: (query: string) => readonly PaletteEntry[],
): CopyChoice | null {
  if (value.trim() === '') return null;
  if (value === shown.query) {
    const entry = nav.index >= 0 ? shown.entries[nav.index] : undefined;
    return entry ? { entry, text: variantText(entry, nav.choice, alternate) } : null;
  }
  // Résultats en retard sur le champ : la sélection affichée ne vaut plus rien, première ligne.
  const entry = search(value)[0];
  return entry ? { entry, text: variantText(entry, 0, alternate) } : null;
}

/**
 * Garde anti double copie : une seule copie à la fois, de la prise jusqu'à la libération (copie
 * échouée, ou palette masquée). Une seconde Entrée arrivée entre-temps ne copie rien.
 */
export interface CopyGate {
  /** Vrai si la garde était libre (elle est alors prise). */
  acquire(): boolean;
  release(): void;
}

export function createCopyGate(): CopyGate {
  let busy = false;
  return {
    acquire() {
      if (busy) return false;
      busy = true;
      return true;
    },
    release() {
      busy = false;
    },
  };
}
