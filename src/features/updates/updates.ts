/**
 * Moteur de mise à jour, partie PURE (issue n°5) : machine à états, lecture des erreurs et
 * décisions au lancement. Aucune requête ici : le hook `useUpdater` appelle le pont
 * `lib/tauri/updater` et traduit ses résultats en évènements pour `updateReducer`.
 *
 * La comparaison des numéros de version est faite par le plugin de mise à jour (il ne renvoie
 * une mise à jour que si elle est plus récente) : elle n'est pas réécrite ici.
 */
import type { UpdateMode } from '../settings/settings';
import type { UpdateState } from './types';

export type UpdateEvent =
  /** Une recherche commence. */
  | { type: 'check-started' }
  /** La recherche a trouvé une version plus récente. */
  | { type: 'check-found'; version: string; notes: string }
  /** La recherche n'a rien trouvé de nouveau ; `at` = horodatage (ms). */
  | { type: 'check-none'; at: number }
  /** Le téléchargement de la version trouvée commence. */
  | { type: 'download-started'; version: string }
  /** Taille annoncée du fichier (`null` si inconnue). */
  | { type: 'download-length'; total: number | null }
  /** Un morceau de `bytes` octets vient d'être reçu. */
  | { type: 'download-chunk'; bytes: number }
  /** Téléchargement terminé et signature vérifiée par le plugin. */
  | { type: 'downloaded' }
  /** L'installateur va être lancé (l'application se ferme). */
  | { type: 'install-started' }
  /** Échec de l'opération en cours. */
  | { type: 'failed'; message: string; retryable: boolean };

/** Taille plausible : nombre fini, positif ; sinon inconnue. */
function sizeOrNull(n: number | null): number | null {
  return n !== null && Number.isFinite(n) && n > 0 ? n : null;
}

/** Nombre d'octets plausible d'un morceau ; sinon 0. */
function chunkBytes(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * État suivant. Un évènement reçu dans un état où il n'a pas de sens est IGNORÉ (même objet
 * renvoyé) : jamais d'exception, jamais d'état incohérent.
 */
export function updateReducer(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case 'check-started':
      // Une seule opération à la fois : pas de recherche pendant un téléchargement ou une installation.
      return state.status === 'idle' ||
        state.status === 'up-to-date' ||
        state.status === 'available' ||
        state.status === 'error'
        ? { status: 'checking' }
        : state;
    case 'check-found':
      return state.status === 'checking' ? { status: 'available', version: event.version, notes: event.notes } : state;
    case 'check-none':
      return state.status === 'checking' ? { status: 'up-to-date', checkedAt: event.at } : state;
    case 'download-started':
      return state.status === 'available' && state.version === event.version
        ? { status: 'downloading', version: state.version, received: 0, total: null }
        : state;
    case 'download-length':
      return state.status === 'downloading' ? { ...state, total: sizeOrNull(event.total) } : state;
    case 'download-chunk': {
      if (state.status !== 'downloading') return state;
      const bytes = chunkBytes(event.bytes);
      return bytes === 0 ? state : { ...state, received: state.received + bytes };
    }
    case 'downloaded':
      return state.status === 'downloading' ? { status: 'ready', version: state.version } : state;
    case 'install-started':
      return state.status === 'ready' ? { status: 'installing', version: state.version } : state;
    case 'failed':
      return state.status === 'checking' ||
        state.status === 'downloading' ||
        state.status === 'ready' ||
        state.status === 'installing'
        ? { status: 'error', message: event.message, retryable: event.retryable }
        : state;
  }
}

/** Pas d'affichage d'un téléchargement de taille inconnue (octets). */
const UNKNOWN_SIZE_STEP = 256 * 1024;

/**
 * Faut-il afficher le passage de `prev` à `next` ? Faux seulement entre deux états de
 * téléchargement de même taille annoncée qui donnent le même pourcentage entier (ou, taille
 * inconnue, la même tranche de 256 Kio) : évite un rendu par morceau reçu.
 */
export function isVisibleUpdateChange(prev: UpdateState, next: UpdateState): boolean {
  if (prev === next) return false;
  if (prev.status !== 'downloading' || next.status !== 'downloading') return true;
  if (prev.version !== next.version || prev.total !== next.total) return true;
  const step = next.total !== null ? next.total / 100 : UNKNOWN_SIZE_STEP;
  return Math.floor(prev.received / step) !== Math.floor(next.received / step);
}

/** Erreur levée par le moteur quand une opération dépasse son délai maximal. */
export class UpdateTimeoutError extends Error {
  constructor(message = 'Délai dépassé.') {
    super(message);
    this.name = 'UpdateTimeoutError';
  }
}

export interface UpdateErrorInfo {
  message: string;
  /** Vrai si réessayer plus tard a une chance d'aboutir. */
  retryable: boolean;
}

export const UPDATE_ERROR_MESSAGES = {
  timeout: 'La recherche a pris trop de temps. Réessayez plus tard.',
  offline: 'Connexion impossible : vérifiez votre accès à Internet, puis réessayez.',
  unavailable: 'Le serveur des mises à jour (GitHub) ne répond pas correctement. Réessayez plus tard.',
  signature:
    "Mise à jour refusée : sa signature n'est pas valide. Rien n'a été installé ; téléchargez la dernière version depuis la page des Releases.",
} as const;

/** Longueur maximale du détail technique affiché pour une erreur inconnue. */
const MAX_DETAIL = 160;

/** Texte brut d'une erreur quelconque (le plugin rejette avec une chaîne). Ne lève jamais. */
function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  try {
    return String(error);
  } catch {
    return '';
  }
}

const TIMEOUT_PATTERNS = ['timed out', 'timeout', 'délai dépassé', 'os error 10060'];
const OFFLINE_PATTERNS = [
  'dns error',
  'failed to lookup address',
  'no such host',
  'name or service not known',
  'error sending request',
  'tcp connect error',
  'connection refused',
  'connection reset',
  'network is unreachable',
  'os error 11001',
  'os error 10051',
  'os error 10061',
  'os error 10065',
];
const SIGNATURE_PATTERNS = [
  'signature',
  'minisign',
  'different key',
  'signed for version',
  'failed to decode pubkey',
];
const UNAVAILABLE_PATTERNS = [
  'could not fetch a valid release json',
  'download request failed with status',
  'was not found in the response',
  'none of the fallback platforms',
  'error decoding response body',
  'expected value',
  'missing field',
];

/**
 * Message lisible (en français) et caractère réessayable d'une erreur brute du plugin ou du
 * moteur. Ordre : délai dépassé, signature, hors ligne, GitHub indisponible, inconnue.
 * Ne lève jamais.
 */
export function describeUpdateError(error: unknown): UpdateErrorInfo {
  if (error instanceof UpdateTimeoutError) return { message: UPDATE_ERROR_MESSAGES.timeout, retryable: true };
  const raw = errorText(error);
  const text = raw.toLowerCase();
  const has = (patterns: readonly string[]) => patterns.some((p) => text.includes(p));
  if (has(TIMEOUT_PATTERNS)) return { message: UPDATE_ERROR_MESSAGES.timeout, retryable: true };
  // Avant « hors ligne » : une signature refusée ne doit jamais passer pour un souci de réseau.
  if (has(SIGNATURE_PATTERNS)) return { message: UPDATE_ERROR_MESSAGES.signature, retryable: false };
  if (has(OFFLINE_PATTERNS)) return { message: UPDATE_ERROR_MESSAGES.offline, retryable: true };
  if (has(UNAVAILABLE_PATTERNS)) return { message: UPDATE_ERROR_MESSAGES.unavailable, retryable: true };
  const detail = raw.trim().replace(/\s+/g, ' ');
  const shown = detail.length > MAX_DETAIL ? `${detail.slice(0, MAX_DETAIL - 1)}…` : detail;
  return {
    message: shown ? `La mise à jour a échoué : ${shown}` : 'La mise à jour a échoué.',
    retryable: true,
  };
}

/**
 * Intervalle minimal entre deux vérifications automatiques au lancement. Garde-fou contre une
 * boucle de redémarrages : il ne gêne pas l'usage normal (un lancement = une vérification).
 */
export const STARTUP_CHECK_MIN_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Faut-il vérifier au lancement ? Manuel : JAMAIS (aucune requête sans clic). Automatique : oui,
 * sauf si une vérification a eu lieu il y a moins de `STARTUP_CHECK_MIN_INTERVAL_MS`.
 * Une date dans le futur (horloge reculée) n'empêche pas la vérification.
 */
export function shouldCheckOnStartup(mode: UpdateMode, lastCheckedAt: number | undefined, now: number): boolean {
  if (mode !== 'auto') return false;
  if (lastCheckedAt === undefined || !Number.isFinite(lastCheckedAt)) return true;
  const elapsed = now - lastCheckedAt;
  return elapsed < 0 || elapsed >= STARTUP_CHECK_MIN_INTERVAL_MS;
}

/**
 * En mode automatique, installer sans demander la version trouvée ? Non si une installation
 * automatique de CETTE version a déjà été lancée et que l'on tourne toujours sur une autre
 * version : l'installation a échoué ; la recommencer à chaque lancement ferait une boucle.
 * La version reste alors proposée dans les Paramètres (installation manuelle).
 */
export function shouldAutoInstall(foundVersion: string, lastAutoInstallVersion: string | undefined): boolean {
  return foundVersion !== lastAutoInstallVersion;
}

/**
 * Version à annoncer une fois (« Mise à jour X.Y.Z installée ») au lancement : la version
 * courante si elle diffère de la dernière version vue. `null` si rien à annoncer : version
 * inconnue (navigateur), premier lancement avec ce réglage, ou même version.
 */
export function installedUpdateNotice(currentVersion: string | null, lastSeenVersion: string | undefined): string | null {
  if (currentVersion === null || lastSeenVersion === undefined) return null;
  return currentVersion !== lastSeenVersion ? currentVersion : null;
}

/** Texte de l'annonce après une mise à jour. */
export function installedUpdateMessage(version: string): string {
  return `Mise à jour ${version} installée.`;
}
