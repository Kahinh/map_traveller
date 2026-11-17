import { useCallback, useState } from 'react';

/**
 * Dernière position cliquée de chaque parcours Farm (session uniquement, jamais écrite) ;
 * -1 = début. Reprise par indice d'étape (invariant 3). `setStep` et `forget` sont stables.
 */
export function useFarmProgress() {
  const [progress, setProgress] = useState<Readonly<Record<string, number>>>({});

  const setStep = useCallback((id: string, step: number) => setProgress((p) => ({ ...p, [id]: step })), []);

  /** Oublie un parcours supprimé. */
  const forget = useCallback(
    (id: string) =>
      setProgress((p) => {
        if (!(id in p)) return p;
        const next = { ...p };
        delete next[id];
        return next;
      }),
    [],
  );

  const stepOf = (id: string): number => progress[id] ?? -1;

  return { stepOf, setStep, forget };
}
