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
 * Genre d'une variante copiable. Sur une carte : sans ou avec le `/zaap` initial
 * (`partVariants`). Sur une ligne « zaap le plus proche » (issue n°7) : `trip` = zaap puis
 * `/travel` vers la position tapée, `zaapOnly` = la commande du zaap seule. Sur une ligne Farm :
 * `route` = parcours complet ou suite du parcours, copié tel quel.
 */
export type PaletteVariantKind = VariantKind | 'trip' | 'zaapOnly' | 'route';

/** Libellés d'un genre : `long` pour l'infobulle et le lecteur d'écran, `short` pour le pied d'aide. */
export const VARIANT_LABELS: Readonly<Record<PaletteVariantKind, { long: string; short: string }>> = {
  withoutZaap: { long: 'Sans Zaap : trajet seul', short: 'sans Zaap' },
  withZaap: { long: 'Avec Zaap : commande complète', short: 'avec Zaap' },
  trip: { long: 'Trajet complet : zaap puis déplacement', short: 'trajet complet' },
  zaapOnly: { long: 'Zaap seul', short: 'zaap seul' },
  route: { long: 'Parcours Farm', short: 'parcours' },
};

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

/** Lignes déjà fabriquées pour une destination, avec ce dont elles dépendent hors catalogue. */
interface CachedEntries {
  favorite: boolean;
  /** Variante préférée à la fabrication (cartes) ; `null` pour une ligne Farm, qui n'en dépend pas. */
  variant: VariantKind | null;
  entries: readonly PaletteEntry[];
}

/**
 * Index de la palette, construit une fois par catalogue et dictionnaire chargés : index de
 * recherche (destinations actives, vocabulaire, alias) et parcours Farm déjà analysés. Rien
 * n'est analysé pendant la frappe. Favoris et variante préférée sont donnés à chaque recherche :
 * les changer ne reconstruit rien.
 */
export interface PaletteIndex {
  /** Index de recherche des destinations actives, alias compris. */
  search: SearchIndex;
  /** Parcours analysé par identifiant de destination Farm. */
  routes: ReadonlyMap<string, FarmRoute>;
  /** Référentiel des zaaps livré (recherche « proche X,Y », issue n°7). */
  zaaps: ZaapCatalog;
  /**
   * Lignes déjà fabriquées, par clé de ligne (cartes : clé de la destination, voir
   * `searchPalette`). Une même destination redonne le MÊME objet d'une frappe à l'autre : les
   * lignes mémoïsées de l'interface ne sont pas redessinées. Mémoire bornée par le catalogue.
   */
  cache: Map<string, CachedEntries>;
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
