/**
 * Types partagés de la palette de recherche. Fonctions pures uniquement : aucun import
 * React ni Tauri.
 */
import { CATEGORY_LABELS, type Destination } from '../catalog/schema';
import type { FarmRoute } from '../farm/farmRoute';

/** Ce qu'une case (ou la ligne entière) copie. */
export interface PaletteChoice {
  /** « 1 », « 2 » pour une carte à deux étapes ; '' sinon. */
  label: string;
  /** « Étape 1 : accès », « Étape 2 : sur place » ; '' sinon. */
  hint: string;
  /** Copié par Entrée / clic gauche. `null` = rien à copier. */
  primary: string | null;
  /** Copié par Ctrl+Entrée / clic droit. `null` = rien à copier. */
  secondary: string | null;
}

export type PaletteEntryKind = 'card' | 'farm-start' | 'farm-step';

export interface PaletteEntry {
  /** Clé React stable : `[destinationId, kind]` ou `[destinationId, kind, indiceÉtape]` en JSON. */
  key: string;
  kind: PaletteEntryKind;
  destinationId: string;
  /** Nom de la destination. */
  title: string;
  /** « Donjons · Zone », « Farm · parcours complet », « Farm · je suis en 2,2 (étape 2/6) ». */
  subtitle: string;
  /** Chemin relatif, résolu par `imageSrc()`. */
  image: string | null;
  favorite: boolean;
  /** 1 choix pour une ligne normale, 2 pour une carte à deux étapes. Jamais vide. */
  choices: PaletteChoice[];
}

/**
 * Index construit une fois par ouverture de la palette : destinations actives et parcours
 * Farm déjà analysés (aucune analyse pendant la frappe).
 */
export interface PaletteIndex {
  destinations: readonly Destination[];
  favorites: ReadonlySet<string>;
  /** Parcours analysé par identifiant de destination Farm. */
  routes: ReadonlyMap<string, FarmRoute>;
}

/** Début du sous-titre : catégorie, puis zone si renseignée (distingue deux noms identiques). */
export function subtitleBase(d: Destination): string {
  const zone = d.zone.trim();
  return zone ? `${CATEGORY_LABELS[d.category]} · ${zone}` : CATEGORY_LABELS[d.category];
}

/**
 * Clé stable d'une ligne. Tableau sérialisé en JSON plutôt qu'une concaténation : les
 * identifiants importés sont des chaînes libres et pourraient contenir un séparateur.
 */
export function paletteKey(destinationId: string, kind: PaletteEntryKind, stepIndex?: number): string {
  return JSON.stringify(stepIndex === undefined ? [destinationId, kind] : [destinationId, kind, stepIndex]);
}
