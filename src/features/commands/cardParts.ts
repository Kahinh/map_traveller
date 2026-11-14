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
