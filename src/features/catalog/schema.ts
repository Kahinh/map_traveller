/**
 * Schéma du catalogue de destinations (cahier des charges §8).
 * Fonctions pures : validation et normalisation légère des champs facultatifs.
 * Les champs `command` et `command2` ne sont JAMAIS modifiés.
 *
 * Schéma 3 : ajout de `twoStep` et `command2` (trajet en deux étapes). Un catalogue v2
 * est accepté tel quel : les champs absents prennent leur valeur par défaut.
 *
 * Corrections SILENCIEUSES de `validateCatalog` (champs secondaires, jamais une commande) :
 * `zone` absente ou non textuelle → `''` ; `sortOrder` absent ou non fini → `0` ; `enabled`
 * vaut `true` sauf s'il est exactement `false` ; `aliases` / `tags` absents → `[]` ; `image`
 * vide → `null` ; `id` et `name` débarrassés de leurs blancs. Tout le reste est signalé.
 */

import { normalizeText } from './searchText';
import { isRecord, newerSchemaVersion } from '../shared/json';

export const SCHEMA_VERSION = 3;

export const CATEGORIES = ['npc', 'dungeon', 'place', 'farm'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  npc: 'PNJ',
  dungeon: 'Donjons',
  place: 'Lieux-dits',
  farm: 'Farm',
};

/**
 * Mots-clés cherchables par catégorie (« farm tremble », « donjon … ») : un mot de la requête
 * qui COMMENCE l'un d'eux, sur deux lettres au moins, désigne la catégorie (`categoriesForWord`).
 * Ils ne comptent qu'au rang le plus faible du classement.
 * Déjà en minuscules, sans accents ni tiret (la requête est découpée sur les tirets).
 */
export const CATEGORY_KEYWORDS: Record<Category, string> = {
  npc: 'pnj',
  dungeon: 'donjon donjons',
  place: 'lieu lieux',
  farm: 'farm',
};

/**
 * Mots-clés secondaires, reconnus en correspondance EXACTE seulement : « lieu-dit » est découpé
 * en « lieu » et « dit », mais « di » ne doit pas ramener tous les lieux-dits.
 */
export const CATEGORY_EXACT_KEYWORDS: Record<Category, string> = {
  npc: '',
  dungeon: '',
  place: 'dit dits',
  farm: '',
};

/** Catégories qui peuvent porter un trajet en deux étapes. */
const TWO_STEP_CATEGORIES: readonly Category[] = ['npc', 'dungeon'];

/** Vrai si la catégorie peut porter un trajet en deux étapes (PNJ et Donjons). Seul endroit de la règle. */
export function allowsTwoStep(category: Category): boolean {
  return TWO_STEP_CATEGORIES.includes(category);
}

export interface Destination {
  id: string;
  name: string;
  category: Category;
  zone: string;
  aliases: string[];
  tags: string[];
  /** Chemin relatif `images/...` dans le dossier de données, ou `null`. */
  image: string | null;
  /** Commande copiée (commande de l'étape 1 en mode deux étapes). Texte brut. */
  command: string;
  sortOrder: number;
  enabled: boolean;
  /** Trajet en deux étapes (PNJ et Donjons). Décoché par défaut. */
  twoStep: boolean;
  /** Commande de l'étape 2. Texte brut, conservé même si `twoStep` est décoché. */
  command2: string;
}

export interface Catalog {
  schemaVersion: number;
  destinations: Destination[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; catalog: Catalog }
  | { ok: false; errors: ValidationError[] };

/**
 * Erreurs de validation en un seul texte, au même format partout (chargement, enregistrement,
 * palette) : `chemin message`, séparés par `sep`.
 */
export function formatValidationErrors(errors: readonly ValidationError[], sep: string): string {
  return errors.map((e) => `${e.path} ${e.message}`.trim()).join(sep);
}

function stringArray(v: unknown): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string')) return null;
  return v as string[];
}

/** Chemin d'image accepté : relatif, sous `images/`, sans remontée ni schéma d'URL. */
export function isSafeImagePath(p: string): boolean {
  return /^images\/[A-Za-z0-9._-]+$/.test(p) && !p.includes('..');
}

/**
 * Valide un objet inconnu (JSON importé ou lu sur disque).
 * Ne lève jamais : retourne la liste exhaustive des erreurs.
 */
export function validateCatalog(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!isRecord(input)) return { ok: false, errors: [{ path: '', message: 'Le catalogue doit être un objet JSON.' }] };

  const version = input.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    errors.push({ path: 'schemaVersion', message: 'schemaVersion manquant ou invalide.' });
  } else if (newerSchemaVersion(input, SCHEMA_VERSION) !== null) {
    errors.push({ path: 'schemaVersion', message: `Version ${version} plus récente que l'application (${SCHEMA_VERSION}).` });
  }

  if (!Array.isArray(input.destinations)) {
    errors.push({ path: 'destinations', message: 'destinations doit être un tableau.' });
    return { ok: false, errors };
  }

  const seen = new Set<string>();
  const destinations: Destination[] = [];
  input.destinations.forEach((raw, i) => {
    const at = (f: string) => `destinations[${i}].${f}`;
    if (!isRecord(raw)) {
      errors.push({ path: `destinations[${i}]`, message: 'Entrée invalide.' });
      return;
    }
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id) errors.push({ path: at('id'), message: 'Identifiant requis.' });
    else if (seen.has(id)) errors.push({ path: at('id'), message: `Identifiant en double : ${id}.` });
    seen.add(id);

    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) errors.push({ path: at('name'), message: 'Nom requis.' });

    const category = raw.category;
    if (!CATEGORIES.includes(category as Category)) {
      errors.push({ path: at('category'), message: `Catégorie inconnue : ${String(category)}.` });
    }

    if (typeof raw.command !== 'string') errors.push({ path: at('command'), message: 'command doit être du texte.' });

    if (raw.twoStep !== undefined && typeof raw.twoStep !== 'boolean') {
      errors.push({ path: at('twoStep'), message: 'twoStep doit valoir true ou false.' });
    }
    const twoStep = raw.twoStep === true;
    if (twoStep && CATEGORIES.includes(category as Category) && !allowsTwoStep(category as Category)) {
      errors.push({ path: at('twoStep'), message: 'Le trajet en deux étapes est réservé aux PNJ et aux Donjons.' });
    }
    if (raw.command2 !== undefined && typeof raw.command2 !== 'string') {
      errors.push({ path: at('command2'), message: 'command2 doit être du texte.' });
    }

    let image: string | null = null;
    if (raw.image != null && raw.image !== '') {
      if (typeof raw.image !== 'string' || !isSafeImagePath(raw.image)) {
        errors.push({ path: at('image'), message: 'Chemin d\'image invalide (attendu : images/<fichier>).' });
      } else image = raw.image;
    }

    const aliases = stringArray(raw.aliases);
    const tags = stringArray(raw.tags);
    if (aliases === null) errors.push({ path: at('aliases'), message: 'aliases doit être une liste de textes.' });
    if (tags === null) errors.push({ path: at('tags'), message: 'tags doit être une liste de textes.' });

    destinations.push({
      id,
      name,
      category: category as Category,
      zone: typeof raw.zone === 'string' ? raw.zone : '',
      aliases: aliases ?? [],
      tags: tags ?? [],
      image,
      command: typeof raw.command === 'string' ? raw.command : '',
      sortOrder: typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : 0,
      enabled: raw.enabled !== false,
      twoStep,
      command2: typeof raw.command2 === 'string' ? raw.command2 : '',
    });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, catalog: { schemaVersion: SCHEMA_VERSION, destinations } };
}

/**
 * Génère un identifiant stable et lisible à partir d'un nom, unique dans `existing`. Même
 * normalisation que la recherche (ligatures dépliées : « Cœur » → `coeur`). Appelé à la
 * création seulement : un identifiant existant ne change jamais.
 */
export function makeDestinationId(name: string, existing: Iterable<string>): string {
  const base =
    normalizeText(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'destination';
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
