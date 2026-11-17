/**
 * Types partagés de la palette de recherche. Fonctions pures uniquement : aucun import
 * React ni Tauri.
 */
import { CATEGORY_LABELS, type Destination } from '../catalog/schema';
import type { SearchIndex } from '../catalog/searchIndex';
import type { VariantKind } from '../commands/cardParts';
import type { FarmRoute } from '../farm/farmRoute';
import type { ZaapCatalog } from '../zaaps/zaaps';

/**
 * Variante copiable d'une ligne. Sur une carte : sans ou avec le `/zaap` initial
 * (`partVariants`). Sur une ligne « zaap le plus proche » (issue n°7) : `withZaap` = trajet
 * complet, `zaapOnly` = la commande du zaap seule.
 */
export type PaletteVariantKind = VariantKind | 'zaapOnly';

export interface PaletteVariant {
  kind: PaletteVariantKind;
  /** Texte exact à copier. */
  text: string;
}

/** Étape d'une destination à plusieurs étapes : `index` à partir de 1, `count` = nombre d'étapes. */
export interface PaletteStep {
  index: number;
  count: number;
}

export type PaletteEntryKind = 'card' | 'farm-start' | 'farm-step' | 'zaap';

export interface PaletteEntry {
  /** Clé React stable : `[destinationId, kind]` ou `[destinationId, kind, indiceÉtape]` en JSON. */
  key: string;
  kind: PaletteEntryKind;
  /** Identifiant de la destination, ou du zaap pour une ligne `zaap`. */
  destinationId: string;
  /** Nom de la destination, sans suffixe d'étape. */
  title: string;
  /** Étape d'un trajet à plusieurs étapes (une ligne par étape) ; `null` pour une ligne simple. */
  step: PaletteStep | null;
  /** « Donjons · Zone », « Farm · parcours complet », « Farm · je suis en 2,2 (étape 2/6) ». */
  subtitle: string;
  /** Chemin relatif, résolu par `imageSrc()`. */
  image: string | null;
  favorite: boolean;
  /**
   * 0 (rien à copier), 1 ou 2 variantes. À deux, les cases latérales apparaissent et la
   * première est la variante sélectionnée par défaut (ordre fixé à la construction).
   */
  variants: PaletteVariant[];
}

/**
 * Index de la palette, construit une fois par catalogue chargé : destinations actives, index de
 * recherche (vocabulaire, dictionnaire d'alias) et parcours Farm déjà analysés. Rien n'est
 * analysé pendant la frappe.
 */
export interface PaletteIndex {
  destinations: readonly Destination[];
  favorites: ReadonlySet<string>;
  /** Index de recherche des destinations actives, alias compris. */
  search: SearchIndex;
  /** Parcours analysé par identifiant de destination Farm. */
  routes: ReadonlyMap<string, FarmRoute>;
  /** Référentiel des zaaps livré (recherche « proche X,Y », issue n°7). */
  zaaps: ZaapCatalog;
  /** Réglage « variante sélectionnée par défaut » (issue n°11). */
  defaultVariant: VariantKind;
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
