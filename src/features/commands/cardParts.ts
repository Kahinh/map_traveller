/**
 * Zones de copie d'une carte : une seule pour une carte classique, deux pour un trajet
 * en deux étapes (PNJ et Donjons). Fonctions pures : aucun accès système.
 *
 * Point d'entrée unique « quelles commandes porte cette carte », indépendant de l'affichage.
 * Chaque zone applique les règles de copie existantes (`copyRules.ts`), sans les dupliquer.
 */
import { TWO_STEP_CATEGORIES, type Destination } from '../catalog/schema';
import { leftClickCommand, rightClickCommand } from './copyRules';

export type PartIndex = 1 | 2;
export type ClickButton = 'left' | 'right';

export interface CardPart {
  index: PartIndex;
  /** Texte brut de la commande de cette étape. */
  command: string;
}

/** Vrai si la carte s'affiche en deux zones. Toujours faux hors PNJ et Donjons. */
export function isTwoStep(d: Destination): boolean {
  return d.twoStep && TWO_STEP_CATEGORIES.includes(d.category);
}

/** 1 partie pour une carte classique, 2 pour une carte à deux étapes. Textes non modifiés. */
export function cardParts(d: Destination): CardPart[] {
  if (!isTwoStep(d)) return [{ index: 1, command: d.command }];
  return [
    { index: 1, command: d.command },
    { index: 2, command: d.command2 },
  ];
}

/** Texte à copier pour une zone et un bouton, ou `null` s'il n'y a rien à copier. */
export function partCommand(part: CardPart, button: ClickButton): string | null {
  return button === 'left' ? leftClickCommand(part.command) : rightClickCommand(part.command);
}

/** Variante de copie d'une zone : sans le `/zaap` initial, ou commande complète. */
export type VariantKind = 'withoutZaap' | 'withZaap';

export const VARIANT_KINDS: readonly VariantKind[] = ['withoutZaap', 'withZaap'];

export interface CopyVariant {
  kind: VariantKind;
  /** Texte exact à copier. */
  text: string;
}

/**
 * Variantes distinctes d'une zone, dans l'ordre canonique (sans Zaap, puis avec Zaap).
 * Déduites des seuls résultats de `partCommand` : aucune règle Zaap n'est réécrite ici.
 * - commande vide : aucune variante ;
 * - pas de `/zaap` initial : une seule, la commande intacte ;
 * - `/zaap` seul : une seule, la commande complète ;
 * - sinon : les deux.
 */
export function partVariants(part: CardPart): CopyVariant[] {
  const full = partCommand(part, 'right');
  if (full === null) return [];
  const short = partCommand(part, 'left');
  if (short === null) return [{ kind: 'withZaap', text: full }];
  if (short === full) return [{ kind: 'withoutZaap', text: full }];
  return [
    { kind: 'withoutZaap', text: short },
    { kind: 'withZaap', text: full },
  ];
}

/** Variantes dans l'ordre d'affichage : la variante préférée d'abord quand il y en a deux. */
export function orderVariants<T extends { kind: string }>(variants: readonly T[], preferred: VariantKind): T[] {
  if (variants.length !== 2 || variants[0]?.kind === preferred) return [...variants];
  return [variants[1]!, variants[0]!];
}
