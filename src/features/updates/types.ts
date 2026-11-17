/**
 * Interface entre la rubrique « Mises à jour » des Paramètres et le moteur de mise à jour
 * (hook `useUpdater`, issue n°5). PUR : aucune requête, seulement le contrat et sa lecture.
 * Les transitions d'état sont dans `updates.ts`.
 *
 * Le moteur fournit un `UpdaterBinding` disponible dans l'application installée ; ailleurs
 * (navigateur, `npm run dev`), la rubrique reçoit un binding indisponible et désactive son bouton.
 */

/**
 * État du moteur, repris du plan de l'issue n°5. `ready` : la mise à jour est téléchargée et sa
 * signature vérifiée, l'installation attend la fermeture du formulaire de destination.
 */
export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date'; checkedAt: number }
  | { status: 'available'; version: string; notes: string }
  | { status: 'downloading'; version: string; received: number; total: number | null }
  | { status: 'ready'; version: string }
  | { status: 'installing'; version: string }
  | { status: 'error'; message: string; retryable: boolean };

/**
 * Ce que la rubrique reçoit. Indisponible : bouton désactivé et `reason` affichée.
 * Disponible : l'état courant et deux actions, qui ne doivent jamais lever (le moteur
 * convertit ses erreurs en état `error`) ; un appel hors de propos est ignoré par le moteur.
 */
export type UpdaterBinding =
  | { available: false; reason: string }
  | { available: true; state: UpdateState; check: () => void; install: () => void };

/** Vrai si une recherche peut être lancée depuis cet état (aucune opération en cours). */
export function canCheckForUpdate(state: UpdateState): boolean {
  return state.status === 'idle' || state.status === 'up-to-date' || state.status === 'available' || state.status === 'error';
}

/** Vrai si une version trouvée peut être installée. */
export function canInstallUpdate(state: UpdateState): boolean {
  return state.status === 'available';
}

/**
 * Message lisible de l'état, ou `null` au repos. `currentVersion` est la version installée
 * (`null` si inconnue).
 */
export function describeUpdateState(state: UpdateState, currentVersion: string | null): string | null {
  switch (state.status) {
    case 'idle':
      return null;
    case 'checking':
      return 'Recherche en cours…';
    case 'up-to-date':
      return currentVersion ? `Vous utilisez la dernière version (${currentVersion})` : 'Vous utilisez la dernière version';
    case 'available':
      return `Version ${state.version} disponible`;
    case 'downloading': {
      const percent =
        state.total !== null && state.total > 0
          ? Math.min(100, Math.max(0, Math.floor((state.received / state.total) * 100)))
          : null;
      return percent === null
        ? `Téléchargement de la version ${state.version}…`
        : `Téléchargement de la version ${state.version}… ${percent} %`;
    }
    case 'ready':
      return `Version ${state.version} téléchargée : installation dès la fermeture du formulaire`;
    case 'installing':
      return `Installation de la version ${state.version} : l'application va redémarrer`;
    case 'error':
      return state.message;
  }
}
