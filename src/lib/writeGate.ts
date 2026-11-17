/**
 * Garde commune des fichiers que la fenêtre principale réécrit (favoris, réglages, alias) :
 *
 * - aucune écriture avant la fin de la lecture : écrire à ce moment remplacerait le fichier par
 *   des valeurs par défaut ;
 * - aucune écriture du tout si la lecture a échoué (fichier illisible, échec IPC) : le fichier
 *   reste tel quel, l'interface passe en lecture seule ;
 * - écritures l'une après l'autre, dans l'ordre des demandes : la dernière écrite est la plus
 *   récente, et un échec n'empêche pas les suivantes.
 *
 * Sans React : les hooks n'en gardent qu'une instance (`useRef`).
 */
export interface WriteGate {
  /** Lecture réussie : les écritures sont permises. */
  open(): void;
  /** Lecture échouée : toute écriture est refusée avec ce motif, définitivement. */
  refuse(reason: string): void;
  /** Vrai si une écriture serait acceptée maintenant. */
  readonly writable: boolean;
  /**
   * Met `task` à la file. Rejette sans l'exécuter si la garde n'est pas ouverte au moment de
   * la demande ; sinon, rejette comme `task`.
   */
  run<T>(task: () => Promise<T>): Promise<T>;
}

export function createWriteGate(notLoaded: string): WriteGate {
  let state: { kind: 'pending' } | { kind: 'open' } | { kind: 'refused'; reason: string } = { kind: 'pending' };
  let tail: Promise<unknown> = Promise.resolve();
  return {
    open() {
      if (state.kind === 'pending') state = { kind: 'open' };
    },
    refuse(reason) {
      state = { kind: 'refused', reason };
    },
    get writable() {
      return state.kind === 'open';
    },
    run(task) {
      if (state.kind !== 'open') {
        return Promise.reject(new Error(state.kind === 'refused' ? state.reason : notLoaded));
      }
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
