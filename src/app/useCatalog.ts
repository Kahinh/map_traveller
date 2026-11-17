import { useCallback, useEffect, useRef, useState } from 'react';
import { removeDestination, upsertDestination, type DestinationDraft } from '../features/catalog/editor';
import { mergeOfficial } from '../features/catalog/official';
import { SCHEMA_VERSION, validateCatalog, type Catalog, type Destination } from '../features/catalog/schema';
import { errorText } from '../lib/errors';
import { initImages } from '../lib/tauri/images';
import { loadCatalog, loadOfficialState, saveCatalog, saveOfficialState } from '../lib/tauri/storage';

/**
 * Catalogue livré (seed, ≈ 90 Ko), validé par `tests/officialCatalog.test.ts`. Importé à la
 * demande : la fenêtre principale, recréée à chaque retour de la zone de notification, s'affiche
 * sans l'attendre. Le module est mis en cache par le chargeur : un seul téléchargement.
 */
const loadSeed = async (): Promise<unknown> => (await import('../../resources/catalog.seed.json')).default;

async function officialEntries(): Promise<readonly Destination[]> {
  const shipped = validateCatalog(await loadSeed());
  return shipped.ok ? shipped.catalog.destinations : [];
}

/**
 * Ajoute les entrées livrées jamais proposées (`mergeOfficial`) : catalogue écrit d'abord, puis
 * `official.json`. Un échec n'empêche pas l'ouverture : le catalogue reste celui du disque, et
 * l'ajout est retenté au prochain lancement (idempotent).
 */
async function withOfficialEntries(catalog: Catalog): Promise<Catalog> {
  const state = await loadOfficialState();
  if (!state.ok) return catalog;
  const official = await officialEntries().catch(() => null);
  if (official === null) return catalog;
  const merge = mergeOfficial(catalog, official, state.known);
  try {
    if (merge.added.length > 0) await saveCatalog(merge.catalog);
  } catch {
    return catalog;
  }
  if (merge.state) await saveOfficialState(merge.state).catch(() => undefined);
  return merge.catalog;
}

export type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

/**
 * Catalogue de destinations : chargement, création / modification, suppression.
 *
 * Chaque opération calcule le nouveau catalogue (fonction pure), l'ÉCRIT sur le disque, puis
 * seulement met l'état à jour : si l'écriture échoue, l'affichage ne diverge pas du disque et
 * l'erreur remonte à l'appelant. `save` et `remove` sont stables.
 */
export function useCatalog() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [destinations, setDestinations] = useState<Destination[]>([]);
  /** Dernier catalogue enregistré ; `null` tant qu'il n'est pas chargé (ou s'il est illisible). */
  const catalogRef = useRef<Catalog | null>(null);

  useEffect(() => {
    void (async () => {
      const [cat] = await Promise.all([loadCatalog(loadSeed), initImages()]);
      if (!cat.ok) {
        setLoad({ status: 'error', message: cat.errors.map((e) => `${e.path} ${e.message}`.trim()).join(' · ') });
        return;
      }
      const catalog = await withOfficialEntries(cat.catalog);
      catalogRef.current = catalog;
      setDestinations(catalog.destinations);
      setLoad({ status: 'ready' });
    })().catch((e: unknown) => setLoad({ status: 'error', message: errorText(e) }));
  }, []);

  const commit = useCallback(async (next: Catalog) => {
    await saveCatalog(next);
    catalogRef.current = next;
    setDestinations(next.destinations);
  }, []);

  /** Catalogue courant ; refuse toute écriture si le catalogue n'a pas été chargé correctement. */
  const current = useCallback((): Catalog => {
    // Écrire par-dessus un catalogue illisible l'effacerait : jamais.
    if (catalogRef.current === null) throw new Error('Catalogue non chargé : aucune modification possible');
    return { schemaVersion: SCHEMA_VERSION, destinations: catalogRef.current.destinations };
  }, []);

  /** Crée ou modifie une destination ; renvoie la destination enregistrée une fois l'écriture terminée. */
  const save = useCallback(
    async (draft: DestinationDraft): Promise<Destination> => {
      const { catalog, id } = upsertDestination(current(), draft);
      const saved = catalog.destinations.find((d) => d.id === id);
      if (!saved) throw new Error(`Destination introuvable après enregistrement : ${id}`);
      await commit(catalog);
      return saved;
    },
    [commit, current],
  );

  /** Supprime une destination (les fichiers image ne sont jamais supprimés). */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      await commit(removeDestination(current(), id));
    },
    [commit, current],
  );

  return { load, destinations, save, remove };
}
