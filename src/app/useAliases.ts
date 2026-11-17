import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildDictionary,
  EMPTY_USER_ALIASES,
  type AliasDictionary,
  type AliasEntry,
  type UserAliases,
} from '../features/aliases/aliases';
import { errorText } from '../lib/errors';
import { DEFAULT_ALIASES, loadAliases, saveAliases } from '../lib/tauri/storage';
import { createWriteGate } from '../lib/writeGate';

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
 * l'affichage ne diverge pas du fichier et l'erreur remonte à l'appelant. Garde et file
 * d'écriture communes aux fichiers réécrits (`createWriteGate`). `commit` est stable.
 */
export function useAliases(): { dictionary: AliasDictionary; binding: AliasesBinding } {
  const [user, setUser] = useState<UserAliases>(EMPTY_USER_ALIASES);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate] = useState(() => createWriteGate('Alias non chargés : aucune modification possible'));

  useEffect(() => {
    let alive = true;
    loadAliases()
      .catch((e: unknown) => ({ user: EMPTY_USER_ALIASES, error: `Alias non chargés : ${errorText(e)}` }))
      .then((result) => {
        if (!alive) return;
        // Écrire par-dessus un fichier illisible effacerait des alias.
        if (result.error === null) gate.open();
        else gate.refuse(result.error);
        setUser(result.user);
        setError(result.error);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [gate]);

  const commit = useCallback(
    (next: UserAliases) =>
      gate.run(async () => {
        await saveAliases(next);
        setUser(next);
      }),
    [gate],
  );

  const dictionary = useMemo(() => buildDictionary(DEFAULT_ALIASES, user), [user]);
  const binding = useMemo<AliasesBinding>(
    () => ({ loaded, defaults: DEFAULT_ALIASES, user, dictionary, error, commit }),
    [loaded, user, dictionary, error, commit],
  );
  return { dictionary, binding };
}
