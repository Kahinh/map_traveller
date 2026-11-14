/**
 * Parcours Farm : analyse d'une commande brute en étapes et calcul de la reprise.
 * Cahier des charges §5. Fonctions pures.
 *
 * Chaque étape représente la DERNIÈRE POSITION ATTEINTE. Un clic sur l'étape i copie
 * les segments originaux des étapes strictement suivantes. La reprise se fait par
 * INDICE d'étape, jamais par recherche de coordonnées (les coordonnées peuvent se répéter).
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
  /** Texte original du segment, copié tel quel. */
  segment: string;
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
  segments.forEach((segment, i) => {
    const segmentIndex = i + offset;
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
    route.steps.push({ index: route.steps.length, x, y, label: `${x},${y}`, segment });
  });
  return route;
}

/** Vrai si le parcours est valide pour la V1 : au moins une étape, aucun segment non reconnu. */
export function isValidFarmRoute(route: FarmRoute): boolean {
  return route.steps.length > 0 && route.issues.length === 0;
}

/** « Démarrer depuis le début » : commande complète, Zaap initial compris. `null` si vide. */
export function farmStartCommand(route: FarmRoute): string | null {
  return isEmptyCommand(route.command) ? null : route.command;
}

/**
 * Clic sur l'étape `stepIndex` (dernière position atteinte) :
 * segments `/travel` originaux des étapes suivantes, joints par `;`.
 * Retourne `null` pour la dernière étape (fin de parcours) ou un indice invalide.
 */
export function farmResumeCommand(route: FarmRoute, stepIndex: number): string | null {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= route.steps.length) return null;
  const next = route.steps.slice(stepIndex + 1);
  if (next.length === 0) return null;
  return next.map((s) => s.segment).join(';');
}
