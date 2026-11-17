/**
 * Palette : position tapée en fin de requête et lignes Farm (parcours complet, reprise).
 * Fonctions pures.
 *
 * Les coordonnées tapées servent UNIQUEMENT à retrouver des étapes existantes, en les
 * comparant aux `x` / `y` déjà extraits par `parseFarmRoute`. Aucune commande n'est fabriquée
 * à partir d'elles : les textes copiés viennent de `farmStartCommand` / `farmResumeCommand`,
 * et la reprise se fait par INDICE d'étape (une ligne par occurrence d'une position répétée).
 */
import type { Destination } from '../catalog/schema';
import { farmResumeCommand, farmStartCommand, type FarmRoute, type FarmStep } from '../farm/farmRoute';
import { isCoordinate } from '../shared/coordinates';
import { paletteKey, subtitleBase, type PaletteEntry, type PaletteVariant } from './types';

/** Ligne Farm : une seule variante (aucune case latérale), ou aucune s'il n'y a rien à copier. */
const single = (command: string | null): PaletteVariant[] =>
  command === null ? [] : [{ kind: 'route', text: command }];

export interface QueryPosition {
  x: number;
  /** Absent quand un seul nombre est tapé (saisie en cours). */
  y?: number;
}

export interface ParsedQuery {
  /** Texte qui précède la position (« farm tremble »), ou la requête entière sans position. */
  text: string;
  position: QueryPosition | null;
}

/** Nombre entier, signé ; ses bornes sont contrôlées après coup (`isCoordinate`). */
const NUM = '-?\\d+';
/**
 * Deux nombres en fin de requête, précédés d'un début ou d'un séparateur. Séparateurs entre
 * les deux : virgule, point-virgule (espaces tolérés autour), espaces, ou tiret collé
 * (`1-1` = `1,1`). Un nombre négatif s'écrit `1 -1` ou `1,-1`.
 */
const TWO_NUMBERS = new RegExp(`(?:^|[\\s,;])(${NUM})(?:\\s*[,;]\\s*|\\s+|-)(${NUM})[\\s,;]*$`);
/** Un seul nombre en fin de requête (saisie en cours : `2`, `2,`, `2-`). */
const ONE_NUMBER = new RegExp(`(?:^|[\\s,;])(${NUM})[\\s,;-]*$`);

/** Texte précédant la position, sans séparateur final. */
const textBefore = (query: string, end: number) => query.slice(0, end).replace(/[\s,;]+$/, '').trim();

/**
 * Sépare la position éventuelle, cherchée en fin de requête uniquement. Les nombres au milieu
 * de la requête restent dans le texte, de même qu'un nombre hors des bornes d'une coordonnée
 * (`MAX_COORDINATE`) : aucune étape ne peut s'y trouver.
 */
export function parsePaletteQuery(query: string): ParsedQuery {
  const noPosition: ParsedQuery = { text: query.trim(), position: null };
  const two = TWO_NUMBERS.exec(query);
  if (two) {
    const x = Number(two[1]);
    const y = Number(two[2]);
    return isCoordinate(x) && isCoordinate(y) ? { text: textBefore(query, two.index), position: { x, y } } : noPosition;
  }
  const one = ONE_NUMBER.exec(query);
  if (one) {
    const x = Number(one[1]);
    return isCoordinate(x) ? { text: textBefore(query, one.index), position: { x } } : noPosition;
  }
  return noPosition;
}

/** Libellé d'une position tapée : `2,2`, ou `2` pour un seul nombre. */
export function formatPosition(p: QueryPosition): string {
  return p.y === undefined ? String(p.x) : `${p.x},${p.y}`;
}

/** Étapes du parcours à cette position, dans l'ordre du parcours (toutes les occurrences). */
export function stepsAtPosition(route: FarmRoute, position: QueryPosition): FarmStep[] {
  return route.steps.filter((s) => s.x === position.x && (position.y === undefined || s.y === position.y));
}

/** Sous-titre complété d'un avertissement si des segments n'ont pas été reconnus. */
function withIssues(subtitle: string, route: FarmRoute): string {
  return route.issues.length > 0 ? `${subtitle} · parcours à vérifier` : subtitle;
}

/** Ligne « parcours complet » : commande complète, Zaap initial compris. */
export function farmStartEntry(d: Destination, route: FarmRoute, favorite: boolean): PaletteEntry {
  const command = farmStartCommand(route);
  return {
    key: paletteKey(d.id, 'farm-start'),
    kind: 'farm-start',
    destinationId: d.id,
    title: d.name,
    step: null,
    subtitle: withIssues(`${subtitleBase(d)} · parcours complet`, route),
    image: d.image,
    favorite,
    variants: single(command),
  };
}

/**
 * Ligne « je suis en X,Y » pour l'étape d'indice `stepIndex` : copie la suite exacte du
 * parcours (`farmResumeCommand`). Dernière étape : rien à copier (`null`).
 */
export function farmStepEntry(d: Destination, route: FarmRoute, stepIndex: number, favorite: boolean): PaletteEntry {
  const step = route.steps[stepIndex];
  const command = farmResumeCommand(route, stepIndex);
  const where = step ? `je suis en ${step.label} (étape ${stepIndex + 1}/${route.steps.length})` : 'étape inconnue';
  const end = command === null ? ' · fin de parcours' : '';
  return {
    key: paletteKey(d.id, 'farm-step', stepIndex),
    kind: 'farm-step',
    destinationId: d.id,
    title: d.name,
    step: null,
    subtitle: withIssues(`${subtitleBase(d)} · ${where}${end}`, route),
    image: d.image,
    favorite,
    variants: single(command),
  };
}
