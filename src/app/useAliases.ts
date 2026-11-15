import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildDictionary,
  EMPTY_USER_ALIASES,
  type AliasDictionary,
  type AliasEntry,
  type UserAliases,
} from '../features/aliases/aliases';
import { DEFAULT_ALIASES, loadAliases, saveAliases } from '../lib/tauri/storage';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Ce que la rubrique « Alias » des Paramètres reçoit. */
export interface AliasesBinding {
  /** Faux tant que `aliases.json` n'a pas été lu : aucune modification possible avant. */
  loaded: boolean;
  /** Alias livrés avec l'application (lecture seule). */
  defaults: readonly AliasEntry[];
  /** Personnalisations de l'utilisateur. */
  user: UserAliases;
  /** Dictionnaire effectif : le MÊME objet que celui de la grille (un seul index de recherche). */
  dictionary: AliasDictionary;
  /** Fichier présent mais illisible : la rubrique l'affiche et n'écrit rien par-dessus. */
  error: string | null;
  /** Écrit les personnalisations sur le disque, PUIS met l'état à jour. Rejette si l'écriture échoue. */
  commit: (next: UserAliases) => Promise<void>;
}

/**
 * Dictionnaire global d'alias de recherche (issue n°10) : chargement au démarrage, puis
 * `commit(next)` pour chaque modification.
 *
 * Même règle que `useCatalog` : le disque d'abord, l'état ensuite. Si l'écriture échoue,
 * l'affichage ne diverge pas du fichier et l'erreur remonte à l'appelant. `commit` est stable.
 */
export function useAliases(): { dictionary: AliasDictionary; binding: AliasesBinding } {
  const [user, setUser] = useState<UserAliases>(EMPTY_USER_ALIASES);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    loadAliases()
      .then((result) => {
        if (!alive) return;
        setUser(result.user);
        setError(result.error);
        loadedRef.current = result.error === null;
        setLoaded(true);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(`Alias non chargés : ${errorText(e)}`);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const commit = useCallback(async (next: UserAliases) => {
    // Écrire avant la fin du chargement, ou par-dessus un fichier illisible, effacerait des alias.
    if (!loadedRef.current) throw new Error('Alias non chargés : aucune modification possible.');
    await saveAliases(next);
    setUser(next);
  }, []);

  const dictionary = useMemo(() => buildDictionary(DEFAULT_ALIASES, user), [user]);
  const binding = useMemo<AliasesBinding>(
    () => ({ loaded, defaults: DEFAULT_ALIASES, user, dictionary, error, commit }),
    [loaded, user, dictionary, error, commit],
  );
  return { dictionary, binding };
}
