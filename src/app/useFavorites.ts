import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '../lib/errors';
import { readFavorites, saveFavorites } from '../lib/tauri/storage';
import { createWriteGate } from '../lib/writeGate';

const EMPTY: ReadonlySet<string> = new Set();

/**
 * Favoris (`favorites.json`), sur le modèle de `useAliases` : le disque d'abord, l'état ensuite
 * (invariant 10). Les écritures passent à la file (`createWriteGate`) et chacune part du dernier
 * ensemble ÉCRIT : deux clics rapides ne se marchent pas dessus.
 *
 * Fichier illisible ou lecture échouée : favoris vides affichés, message par `onError`, aucune
 * écriture (le fichier reste tel quel). Tout échec est signalé par `onError`, jamais levé.
 * `toggle` et `forget` sont stables.
 */
export function useFavorites(onError: (message: string) => void) {
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(EMPTY);
  const [gate] = useState(() => createWriteGate('Favoris non chargés'));
  /** Dernier ensemble écrit sur le disque (ou lu au chargement). */
  const savedRef = useRef<ReadonlySet<string>>(EMPTY);
  const onErrorRef = useRef(onError);
  /** Motif de la lecture seule (fichier illisible), ou `null`. */
  const readOnlyRef = useRef<string | null>(null);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let alive = true;
    readFavorites()
      .catch((e: unknown) => ({ value: EMPTY, error: `Favoris non lus : ${errorText(e)}` }))
      .then((result) => {
        if (!alive) return;
        if (result.error === null) gate.open();
        else {
          const message = `${result.error} : favoris en lecture seule`;
          gate.refuse(message);
          readOnlyRef.current = message;
          onErrorRef.current(message);
        }
        savedRef.current = result.value;
        setFavorites(result.value);
      });
    return () => {
      alive = false;
    };
  }, [gate]);

  /** Écrit `change(dernier ensemble écrit)`, puis l'affiche ; rien si l'ensemble ne change pas. */
  const write = useCallback(
    (change: (saved: ReadonlySet<string>) => ReadonlySet<string>) => {
      // Lecture seule : le motif seul, déjà explicite.
      if (readOnlyRef.current !== null) {
        onErrorRef.current(readOnlyRef.current);
        return;
      }
      gate
        .run(async () => {
          const next = change(savedRef.current);
          if (next === savedRef.current) return;
          await saveFavorites(next);
          savedRef.current = next;
          setFavorites(next);
        })
        .catch((e: unknown) => onErrorRef.current(`Favori non enregistré : ${errorText(e)}`));
    },
    [gate],
  );

  const toggle = useCallback(
    (id: string) =>
      write((saved) => {
        const next = new Set(saved);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [write],
  );

  /** Retire un identifiant (destination supprimée) ; silencieux en lecture seule. */
  const forget = useCallback(
    (id: string) => {
      if (!gate.writable) return;
      write((saved) => {
        if (!saved.has(id)) return saved;
        const next = new Set(saved);
        next.delete(id);
        return next;
      });
    },
    [gate, write],
  );

  return { favorites, toggle, forget };
}
