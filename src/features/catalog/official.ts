/**
 * Catalogue livré (issue n°8) : ajout, dans le catalogue de l'utilisateur, des entrées livrées
 * qu'il n'a encore jamais reçues. Fonctions pures : aucun import React ni Tauri.
 *
 * Règles :
 * - une entrée livrée n'est ajoutée que si son identifiant est absent du catalogue ET n'a jamais
 *   été proposé (`official.json`, liste `known`) : une entrée supprimée par l'utilisateur ne
 *   revient pas, une entrée modifiée n'est jamais remplacée ;
 * - rien n'est jamais modifié ni retiré du catalogue de l'utilisateur ;
 * - idempotent : relancé sur son propre résultat, n'ajoute rien.
 */
import type { Catalog, Destination } from './schema';
import { isRecord, newerSchemaVersion } from '../shared/json';

export const OFFICIAL_STATE_VERSION = 1;

/** Contenu de `official.json`. */
export interface OfficialState {
  schemaVersion: number;
  /** Identifiants livrés déjà proposés, triés. */
  known: string[];
}

export type OfficialStateResult =
  | { ok: true; known: ReadonlySet<string> }
  /** Fichier illisible, d'une version plus récente ou d'une forme inattendue : ne rien ajouter ni écrire. */
  | { ok: false; message: string };

/** Lit `official.json` (`undefined` : fichier absent, rien n'a encore été proposé). */
export function parseOfficialState(raw: unknown): OfficialStateResult {
  if (raw === undefined) return { ok: true, known: new Set() };
  if (!isRecord(raw) || !Array.isArray(raw.known) || typeof raw.schemaVersion !== 'number') {
    return { ok: false, message: 'official.json : forme inattendue.' };
  }
  if (newerSchemaVersion(raw, OFFICIAL_STATE_VERSION) !== null) {
    return { ok: false, message: 'official.json : version plus récente que cette application.' };
  }
  return { ok: true, known: new Set(raw.known.filter((x): x is string => typeof x === 'string')) };
}

export interface OfficialMerge {
  catalog: Catalog;
  /** Entrées ajoutées, dans l'ordre du catalogue livré. */
  added: Destination[];
  /** Nouvel état à enregistrer, ou `null` s'il ne change pas. */
  state: OfficialState | null;
}

/**
 * Ajoute à `user` les entrées de `official` jamais proposées. Ne modifie aucun argument ; le
 * catalogue renvoyé est `user` lui-même quand rien n'est ajouté.
 */
export function mergeOfficial(user: Catalog, official: readonly Destination[], known: ReadonlySet<string>): OfficialMerge {
  const present = new Set(user.destinations.map((d) => d.id));
  const added = official.filter((d) => !present.has(d.id) && !known.has(d.id));
  const nextKnown = new Set(known);
  for (const d of official) nextKnown.add(d.id);
  const stateChanged = nextKnown.size !== known.size;
  return {
    catalog: added.length === 0 ? user : { ...user, destinations: [...user.destinations, ...added] },
    added,
    state: stateChanged ? { schemaVersion: OFFICIAL_STATE_VERSION, known: [...nextKnown].sort() } : null,
  };
}
