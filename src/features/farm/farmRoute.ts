/**
 * Parcours Farm : analyse d'une commande brute en étapes et texte copié par chaque case.
 * Invariant 3 de `CLAUDE.md`. Fonctions pures.
 *
 * Le jeu n'enchaîne pas plusieurs `/travel` dans une même commande : un clic sur l'étape i
 * copie son seul segment, tel que saisi. Les étapes sont repérées par INDICE, jamais par
 * coordonnées (une position peut se répéter).
 */
import { isEmptyCommand, splitLeadingZaap } from '../commands/copyRules';

/** `/travel X Y` (entiers relatifs, séparateur espace et/ou virgule). */
const TRAVEL_SEGMENT = /^\s*\/travel\s+(-?\d+)\s*[,\s]\s*(-?\d+)\s*$/i;

export interface FarmStep {
  /** Indice 0-based de l'étape dans le parcours. */
  index: number;
  x: number;
  y: number;
  /** Libellé affiché sur la carte, ex. `3,3`. */
  label: string;
  /** Texte original du segment. */
  segment: string;
  /** Position dans `FarmRoute.command` juste après le segment (son `;` ou la fin du texte). */
  end: number;
}

export interface FarmIssue {
  /** Position du segment dans la commande (0-based, Zaap initial compris). */
  segmentIndex: number;
  segment: string;
  reason: 'not-travel' | 'empty-segment';
}

export interface FarmRoute {
  /** Commande brute complète, inchangée. */
  command: string;
  /** Premier segment `/zaap` éventuel (ne constitue pas une étape). */
  zaapPrefix: string | null;
  steps: FarmStep[];
  /** Segments non reconnus : jamais supprimés en silence, l'éditeur doit les afficher. */
  issues: FarmIssue[];
}

/** Analyse une commande Farm. Ne modifie jamais le texte des segments. */
export function parseFarmRoute(command: string): FarmRoute {
  const route: FarmRoute = { command, zaapPrefix: null, steps: [], issues: [] };
  if (isEmptyCommand(command)) return route;

  const { zaap, rest } = splitLeadingZaap(command);
  route.zaapPrefix = zaap;
  const offset = zaap === null ? 0 : 1;
  if (zaap !== null && rest === '') return route;

  const segments = rest.split(';');
  // Début du segment courant dans `command` : `rest` en est la fin exacte.
  let start = command.length - rest.length;
  segments.forEach((segment, i) => {
    const segmentIndex = i + offset;
    const end = start + segment.length;
    start = end + 1;
    if (segment.trim() === '') {
      // Un `;` final est toléré ; un segment vide au milieu est signalé.
      if (i !== segments.length - 1) route.issues.push({ segmentIndex, segment, reason: 'empty-segment' });
      return;
    }
    const m = TRAVEL_SEGMENT.exec(segment);
    if (!m) {
      route.issues.push({ segmentIndex, segment, reason: 'not-travel' });
      return;
    }
    const x = Number(m[1]);
    const y = Number(m[2]);
    route.steps.push({ index: route.steps.length, x, y, label: `${x},${y}`, segment, end });
  });
  return route;
}

/** Vrai si le parcours est valide pour la V1 : au moins une étape, aucun segment non reconnu. */
export function isValidFarmRoute(route: FarmRoute): boolean {
  return route.steps.length > 0 && route.issues.length === 0;
}

/**
 * Case « Début » de la fenêtre du parcours : le Zaap initial et la première position, tels que
 * saisis (texte brut de la commande jusqu'à la fin du premier segment `/travel`). `null` si le
 * parcours ne commence pas par un `/zaap` ou n'a aucune étape : la case n'apparaît pas, la
 * première position suffit.
 */
export function farmStartCommand(route: FarmRoute): string | null {
  const first = route.steps[0];
  if (route.zaapPrefix === null || !first) return null;
  return route.command.slice(0, first.end).trim();
}

/**
 * Clic sur l'étape `stepIndex` : son segment `/travel` seul, tel que saisi (blancs de bord
 * retirés). Le jeu n'enchaîne pas plusieurs `/travel` : chaque position se copie une à une.
 * `null` pour un indice invalide.
 */
export function farmStepCommand(route: FarmRoute, stepIndex: number): string | null {
  if (!Number.isInteger(stepIndex)) return null;
  const step = route.steps[stepIndex];
  return step ? step.segment.trim() : null;
}
