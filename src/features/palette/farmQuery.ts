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
import { paletteKey, subtitleBase, type PaletteEntry, type PaletteVariant } from './types';

/** Ligne Farm : une seule variante (aucune case latérale), ou aucune s'il n'y a rien à copier. */
const single = (command: string | null): PaletteVariant[] =>
  command === null ? [] : [{ kind: 'withoutZaap', text: command }];

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

const NUM = '-?\\d{1,7}';
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
 * de la requête restent dans le texte.
 */
export function parsePaletteQuery(query: string): ParsedQuery {
  const two = TWO_NUMBERS.exec(query);
  if (two) return { text: textBefore(query, two.index), position: { x: Number(two[1]), y: Number(two[2]) } };
  const one = ONE_NUMBER.exec(query);
  if (one) return { text: textBefore(query, one.index), position: { x: Number(one[1]) } };
  return { text: query.trim(), position: null };
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

/** « Parcours complet », puis toutes les positions si `expand`. */
export function farmRouteEntries(d: Destination, route: FarmRoute, favorite: boolean, expand: boolean): PaletteEntry[] {
  const start = farmStartEntry(d, route, favorite);
  if (!expand) return [start];
  return [start, ...route.steps.map((s) => farmStepEntry(d, route, s.index, favorite))];
}

/** Lignes de reprise pour chaque occurrence de la position, première occurrence en tête. */
export function farmPositionEntries(
  d: Destination,
  route: FarmRoute,
  favorite: boolean,
  position: QueryPosition,
): PaletteEntry[] {
  return stepsAtPosition(route, position).map((s) => farmStepEntry(d, route, s.index, favorite));
}
