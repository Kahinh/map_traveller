/**
 * Zaaps : référentiel livré (`resources/zaaps.json`) et recherche du zaap le plus proche d'une
 * position (issue n°7). Fonctions pures : aucun import React ni Tauri.
 *
 * Convention de distance : **distance de Manhattan sur la grille des cartes**,
 * `|x1 - x2| + |y1 - y2|`. Un déplacement se fait carte par carte, vers le nord, le sud, l'est
 * ou l'ouest : c'est le nombre minimal de cartes à traverser sans obstacle. Le zaap
 * géométriquement le plus proche n'est pas forcément le trajet réel le plus court (mer,
 * obstacles, accès) : aucune recherche d'itinéraire n'est faite.
 *
 * Périmètre : seuls les zaaps du même monde que la position sont comparés. Incarnam a ses
 * propres coordonnées, qui recoupent celles du Monde des Douze : ses zaaps ne sont jamais
 * comparés à une position du Monde des Douze, et inversement.
 *
 * Ex aequo : départagés de façon stable par nom (ordre français), puis par identifiant.
 */
import { normalizeText } from '../catalog/searchText';

export interface ZaapWorld {
  id: string;
  name: string;
  /** Mots acceptés dans la requête pour choisir ce monde (« proche incarnam 1,-2 »). */
  aliases: string[];
}

export interface Zaap {
  /** Identifiant stable (`zaap-…`), jamais dérivé du nom à l'exécution. */
  id: string;
  name: string;
  zone: string;
  /** Identifiant d'un monde de `worlds`. */
  world: string;
  x: number;
  y: number;
  /** Commande copiée pour rejoindre ce zaap, texte brut jamais modifié. */
  command: string;
}

export interface ZaapCatalog {
  source: string;
  worlds: ZaapWorld[];
  zaaps: Zaap[];
}

/** Monde par défaut d'une position tapée sans précision. */
export const DEFAULT_WORLD = 'douze';

/** Nombre de zaaps proposés : le plus proche, puis deux alternatives. */
export const NEAREST_LIMIT = 3;

/** Bornes de coordonnées acceptées dans la requête (le monde connu tient dans ±150). */
export const MAX_COORDINATE = 999;

export const EMPTY_ZAAPS: ZaapCatalog = { source: '', worlds: [], zaaps: [] };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isCoord = (v: unknown): v is number => Number.isInteger(v) && Math.abs(v as number) <= MAX_COORDINATE;

export type ZaapCatalogResult = { ok: true; catalog: ZaapCatalog } | { ok: false; errors: string[] };

/** Valide le référentiel. Toute entrée invalide est signalée, aucune n'est corrigée en silence. */
export function parseZaapCatalog(raw: unknown): ZaapCatalogResult {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['référentiel : objet attendu'] };
  if (raw.schemaVersion !== 1) errors.push('schemaVersion : 1 attendu');

  const worlds: ZaapWorld[] = [];
  const worldIds = new Set<string>();
  if (!Array.isArray(raw.worlds)) errors.push('worlds : tableau attendu');
  else
    raw.worlds.forEach((w, i) => {
      if (!isRecord(w) || !isText(w.id) || !isText(w.name) || !Array.isArray(w.aliases)) {
        errors.push(`worlds[${i}] : id, name et aliases attendus`);
        return;
      }
      if (worldIds.has(w.id)) errors.push(`worlds[${i}] : identifiant ${w.id} en double`);
      worldIds.add(w.id);
      worlds.push({ id: w.id, name: w.name, aliases: w.aliases.filter(isText) });
    });

  const zaaps: Zaap[] = [];
  const ids = new Set<string>();
  if (!Array.isArray(raw.zaaps)) errors.push('zaaps : tableau attendu');
  else
    raw.zaaps.forEach((z, i) => {
      const where = `zaaps[${i}]`;
      if (!isRecord(z)) {
        errors.push(`${where} : objet attendu`);
        return;
      }
      if (!isText(z.id) || !isText(z.name) || !isText(z.zone) || !isText(z.command) || !isText(z.world)) {
        errors.push(`${where} : id, name, zone, world et command attendus`);
        return;
      }
      if (!isCoord(z.x) || !isCoord(z.y)) {
        errors.push(`${where} (${z.name}) : coordonnées entières attendues`);
        return;
      }
      if (!worldIds.has(z.world)) errors.push(`${where} (${z.name}) : monde inconnu ${z.world}`);
      if (ids.has(z.id)) errors.push(`${where} : identifiant ${z.id} en double`);
      ids.add(z.id);
      zaaps.push({ id: z.id, name: z.name, zone: z.zone, world: z.world, x: z.x, y: z.y, command: z.command });
    });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, catalog: { source: typeof raw.source === 'string' ? raw.source : '', worlds, zaaps } };
}

export interface MapPosition {
  x: number;
  y: number;
}

/** Distance de Manhattan entre deux cartes (nombre de cartes à traverser sans obstacle). */
export function mapDistance(a: MapPosition, b: MapPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export interface NearestZaap {
  zaap: Zaap;
  distance: number;
}

const byName = new Intl.Collator('fr', { sensitivity: 'base' });

/**
 * Zaaps du monde `world` classés du plus proche au plus lointain, `limit` au plus.
 * Ex aequo : nom (ordre français), puis identifiant. Ne modifie pas `zaaps`.
 */
export function nearestZaaps(
  zaaps: readonly Zaap[],
  position: MapPosition,
  world: string,
  limit: number = NEAREST_LIMIT,
): NearestZaap[] {
  return zaaps
    .filter((z) => z.world === world)
    .map((zaap) => ({ zaap, distance: mapDistance(zaap, position) }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        byName.compare(a.zaap.name, b.zaap.name) ||
        (a.zaap.id < b.zaap.id ? -1 : a.zaap.id > b.zaap.id ? 1 : 0),
    )
    .slice(0, Math.max(0, limit));
}

export type NearQuery =
  /** La requête n'est pas une recherche de zaap. */
  | { kind: 'none' }
  /** « proche » seul ou position en cours de saisie. */
  | { kind: 'incomplete'; world: ZaapWorld | null }
  | { kind: 'invalid'; message: string }
  | { kind: 'ok'; position: MapPosition; world: ZaapWorld | null };

/** Mot-clé qui déclenche la recherche, en tête de requête. */
export const NEAR_KEYWORD = 'proche';

export const NEAR_EXAMPLE = `${NEAR_KEYWORD} -20,-20`;

const NUM = '-?\\d+';
/** Deux nombres : `-20,-20`, `-20 -20`, `-20;-20`, `[-20,-20]`. */
const POSITION = new RegExp(`^\\[?\\s*(${NUM})\\s*(?:[,;]\\s*|\\s+)(${NUM})\\s*\\]?$`);
/** Saisie en cours : rien, `[`, `-`, `-2`, `-20,`, `-20 -`. */
const PARTIAL = /^\[?\s*(?:-?\d*\s*(?:[,;]\s*|\s+)?-?)?$/;

/**
 * Reconnaît `proche -20,-20` (ou `proche -20 -20`, `proche [-20,-20]`), avec un monde facultatif
 * avant la position : `proche incarnam 1,-2`. Insensible à la casse et aux accents. « proche »
 * suivi de mots sans chiffre (« proche du lac ») reste une recherche normale.
 */
export function parseNearQuery(query: string, worlds: readonly ZaapWorld[]): NearQuery {
  const text = query.trim();
  const head = normalizeText(text.slice(0, NEAR_KEYWORD.length));
  if (head !== NEAR_KEYWORD || (text.length > NEAR_KEYWORD.length && !/\s/.test(text[NEAR_KEYWORD.length] ?? ''))) {
    return { kind: 'none' };
  }
  let rest = text.slice(NEAR_KEYWORD.length).trim();

  let world: ZaapWorld | null = null;
  const firstWord = /^[^\s\d[\-,;]+/.exec(rest)?.[0];
  if (firstWord) {
    const key = normalizeText(firstWord);
    world = worlds.find((w) => w.aliases.some((a) => normalizeText(a) === key)) ?? null;
    if (!world) {
      // Des mots sans aucun chiffre (« proche du lac ») : recherche normale d'une destination.
      if (!/\d/.test(rest)) return { kind: 'none' };
      return { kind: 'invalid', message: `Position non reconnue : tapez par exemple ${NEAR_EXAMPLE}` };
    }
    rest = rest.slice(firstWord.length).trim();
  }

  const m = POSITION.exec(rest);
  if (m) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE) {
      return { kind: 'invalid', message: `Coordonnées hors de la carte : ${x},${y}` };
    }
    return { kind: 'ok', position: { x, y }, world };
  }
  if (PARTIAL.test(rest)) return { kind: 'incomplete', world };
  return { kind: 'invalid', message: `Position non reconnue : tapez par exemple ${NEAR_EXAMPLE}` };
}

/**
 * Trajet complet : la commande du zaap, puis `/travel` vers la position tapée, dans la
 * convention des commandes de Map Traveller (`/travel X Y`). Position sur le zaap même :
 * la commande du zaap seule.
 */
export function zaapTripCommand(zaap: Zaap, target: MapPosition): string {
  if (mapDistance(zaap, target) === 0) return zaap.command;
  return `${zaap.command};/travel ${target.x} ${target.y}`;
}

/** « sur place », « 1 carte », « 12 cartes ». */
export function formatDistance(distance: number): string {
  if (distance === 0) return 'sur place';
  return distance === 1 ? 'à 1 carte' : `à ${distance} cartes`;
}
