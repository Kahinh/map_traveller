/**
 * Rubrique `palette` de `settings.json` (issue n°11). PUR. Module à part : la palette lit ce
 * réglage à chaque affichage sans embarquer le reste du modèle des réglages (raccourcis,
 * mises à jour), que seule la fenêtre principale écrit.
 */
import { VARIANT_KINDS, type VariantKind } from '../commands/cardParts';
import { isRecord } from '../shared/json';

/** Palette de recherche (issue n°11). */
export interface PaletteSettings {
  /** Variante sélectionnée par défaut sur une ligne qui a un `/zaap` initial (première case). */
  defaultVariant: VariantKind;
}

/** Sans Zaap : ce que faisait Entrée avant l'issue n°11, rien ne change pour une installation existante. */
export const DEFAULT_PALETTE_SETTINGS: PaletteSettings = { defaultVariant: 'withoutZaap' };

function isVariantKind(v: unknown): v is VariantKind {
  return VARIANT_KINDS.includes(v as VariantKind);
}

/**
 * Rubrique `palette` lue du contenu JSON COMPLET de `settings.json`. Ne lève jamais : racine ou
 * rubrique d'une autre forme, valeur absente ou invalide → valeur par défaut.
 */
export function parsePaletteSettings(input: unknown): PaletteSettings {
  const palette = isRecord(input) && isRecord(input.palette) ? input.palette : {};
  return {
    defaultVariant: isVariantKind(palette.defaultVariant)
      ? palette.defaultVariant
      : DEFAULT_PALETTE_SETTINGS.defaultVariant,
  };
}
