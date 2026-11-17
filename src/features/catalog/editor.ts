/**
 * Éditeur de destinations (invariant 10) : brouillon du formulaire, validation,
 * aperçu des clics et opérations sur le catalogue. Fonctions pures, sans React ni Tauri.
 *
 * Règles :
 * - `command` et `command2` sont du texte brut : jamais nettoyés, normalisés, réordonnés ni
 *   tronqués. La validation « non vide » teste sans modifier la valeur.
 * - Aucune mutation : chaque opération renvoie un nouveau catalogue ; les destinations non
 *   concernées gardent leur identité (cache de recherche et mémoïsation des cartes).
 * - En modification, l'identifiant ne change jamais (les favoris y sont rattachés).
 */
import { cardParts, isTwoStep, partCommand, type PartIndex } from '../commands/cardParts';
import { isValidFarmRoute, parseFarmRoute, type FarmRoute } from '../farm/farmRoute';
import {
  isSafeImagePath,
  makeDestinationId,
  type Catalog,
  type Category,
  type Destination,
} from './schema';
import { textKey } from './searchIndex';

/** État du formulaire : uniquement des chaînes et des booléens, tels que saisis. */
export interface DestinationDraft {
  /** `null` = création. */
  id: string | null;
  name: string;
  category: Category;
  /** Commande (commande de l'étape 1 en mode deux étapes). Texte brut. */
  command: string;
  /** Case « Trajet en deux étapes ». Sans effet hors PNJ et Donjons. */
  twoStep: boolean;
  /** Commande de l'étape 2. Texte brut, conservée même si la case est décochée. */
  command2: string;
  /** Chemin relatif `images/...`, ou `null`. */
  image: string | null;
  zone: string;
  /** Saisie libre, séparée par des virgules. */
  aliases: string;
  /** Saisie libre, séparée par des virgules. */
  tags: string;
  /** Saisie libre ; vide = 0. */
  sortOrder: string;
}

export type DraftField = keyof DestinationDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

/** Libellés au singulier, pour le choix de la catégorie dans le formulaire. */
export const CATEGORY_FORM_LABELS: Record<Category, string> = {
  npc: 'PNJ',
  dungeon: 'Donjon',
  place: 'Lieu-dit',
  farm: 'Farm',
};

const DRAFT_FIELDS: readonly DraftField[] = [
  'id',
  'name',
  'category',
  'command',
  'twoStep',
  'command2',
  'image',
  'zone',
  'aliases',
  'tags',
  'sortOrder',
];

export function emptyDraft(category: Category = 'npc'): DestinationDraft {
  return {
    id: null,
    name: '',
    category,
    command: '',
    twoStep: false,
    command2: '',
    image: null,
    zone: '',
    aliases: '',
    tags: '',
    sortOrder: '',
  };
}

export function draftFromDestination(d: Destination): DestinationDraft {
  return {
    id: d.id,
    name: d.name,
    category: d.category,
    command: d.command,
    twoStep: d.twoStep,
    command2: d.command2,
    image: d.image,
    zone: d.zone,
    aliases: d.aliases.join(', '),
    tags: d.tags.join(', '),
    sortOrder: String(d.sortOrder),
  };
}

/**
 * Copie d'une destination : nouvel identifiant à l'enregistrement, même image, mêmes commandes.
 * Sans les alias : un alias n'appartient qu'à une destination (`aliasOwner`), la copie serait refusée.
 */
export function duplicateDraft(d: Destination): DestinationDraft {
  return { ...draftFromDestination(d), id: null, name: `${d.name} (copie)`, aliases: '' };
}

/** Vrai si la case « deux étapes » s'applique : cochée ET catégorie PNJ ou Donjon. */
export function draftIsTwoStep(draft: DestinationDraft): boolean {
  return isTwoStep(draft);
}

/** Découpe une liste saisie (virgules) : espaces retirés, entrées vides et doublons supprimés. */
export function splitList(value: string): string[] {
  const out: string[] = [];
  for (const raw of value.split(',')) {
    const item = raw.trim();
    if (item !== '' && !out.includes(item)) out.push(item);
  }
  return out;
}

/** Ordre d'affichage : vide → 0, entier (signe facultatif) → sa valeur, sinon `null`. */
export function parseSortOrder(value: string): number | null {
  const v = value.trim();
  if (v === '') return 0;
  if (!/^[+-]?\d+$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}

const isBlank = (s: string) => s.trim() === '';

/** Libellé d'un segment Farm non reconnu, tel que saisi. */
const segmentLabel = (segment: string) => `« ${isBlank(segment) ? '(vide)' : segment.trim()} »`;

/**
 * Destination ACTIVE, autre que celle du brouillon, qui porte déjà l'un des alias saisis (comparés
 * normalisés, ordre des mots compris : ils désigneraient la même requête exacte), ou `null`.
 * Seule la saisie est contrôlée : un catalogue qui contient déjà des doublons reste valide, et la
 * recherche les affiche tous.
 */
export function aliasOwner(draft: DestinationDraft, others: readonly Destination[]): Destination | null {
  const wanted = new Set(splitList(draft.aliases).map(textKey).filter((k) => k !== ''));
  if (wanted.size === 0) return null;
  for (const d of others) {
    if (!d.enabled || d.id === draft.id) continue;
    if (d.aliases.some((a) => wanted.has(textKey(a)))) return d;
  }
  return null;
}

/**
 * Erreurs du brouillon, par champ. Ne modifie jamais le brouillon. `others` : destinations du
 * catalogue, pour refuser un alias déjà porté par une autre destination active.
 */
export function validateDraft(draft: DestinationDraft, others: readonly Destination[] = []): DraftErrors {
  const errors: DraftErrors = {};
  const twoStep = draftIsTwoStep(draft);

  if (isBlank(draft.name)) errors.name = 'Nom requis';

  if (isBlank(draft.command)) {
    errors.command = twoStep ? 'Commande 1 requise' : 'Commande requise';
  } else if (draft.category === 'farm') {
    const route = parseFarmRoute(draft.command);
    if (!isValidFarmRoute(route)) {
      if (route.steps.length === 0) errors.command = 'Aucune étape /travel reconnue dans ce parcours';
      else
        errors.command = `Segment(s) non reconnu(s) : ${route.issues.map((i) => segmentLabel(i.segment)).join(', ')}`;
    }
  }

  if (twoStep && isBlank(draft.command2)) errors.command2 = 'Commande 2 requise';

  if (draft.image !== null && !isSafeImagePath(draft.image)) errors.image = 'Chemin d\'image invalide';

  if (parseSortOrder(draft.sortOrder) === null) errors.sortOrder = 'Nombre entier attendu (vide = 0)';

  const owner = aliasOwner(draft, others);
  if (owner) errors.aliases = `Alias déjà utilisé par « ${owner.name} »`;

  return errors;
}

function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Vrai si le brouillon `b` diffère de `a` (modifications non enregistrées). */
export function isDraftDirty(a: DestinationDraft, b: DestinationDraft): boolean {
  return DRAFT_FIELDS.some((f) => a[f] !== b[f]);
}

/** Champs de la destination produits par le formulaire (les commandes sont copiées telles quelles). */
function fieldsFromDraft(draft: DestinationDraft) {
  return {
    name: draft.name.trim(),
    category: draft.category,
    zone: draft.zone.trim(),
    aliases: splitList(draft.aliases),
    tags: splitList(draft.tags),
    image: draft.image,
    command: draft.command,
    sortOrder: parseSortOrder(draft.sortOrder) ?? 0,
    twoStep: draftIsTwoStep(draft),
    command2: draft.command2,
  };
}

/**
 * Crée ou modifie une destination. Renvoie un NOUVEAU catalogue et l'identifiant concerné.
 * Création : identifiant dérivé du nom, ajout en fin. Modification : identifiant et position
 * conservés, champs inconnus du formulaire (`enabled`, champs futurs) conservés.
 * Lève une erreur si le brouillon est invalide ou si la destination modifiée n'existe plus.
 */
export function upsertDestination(catalog: Catalog, draft: DestinationDraft): { catalog: Catalog; id: string } {
  const errors = validateDraft(draft, catalog.destinations);
  if (hasErrors(errors)) throw new Error(Object.values(errors).join(' '));
  const fields = fieldsFromDraft(draft);

  if (draft.id === null) {
    const id = makeDestinationId(
      fields.name,
      catalog.destinations.map((d) => d.id),
    );
    const created: Destination = { id, enabled: true, ...fields };
    return { catalog: { ...catalog, destinations: [...catalog.destinations, created] }, id };
  }

  const id = draft.id;
  if (!catalog.destinations.some((d) => d.id === id)) throw new Error(`Destination introuvable : ${id}.`);
  const destinations = catalog.destinations.map((d) => (d.id === id ? { ...d, ...fields } : d));
  return { catalog: { ...catalog, destinations }, id };
}

/** Supprime une destination. Renvoie un NOUVEAU catalogue ; les autres objets gardent leur identité. */
export function removeDestination(catalog: Catalog, id: string): Catalog {
  return { ...catalog, destinations: catalog.destinations.filter((d) => d.id !== id) };
}

/** Ce que copieront le clic gauche et le clic droit d'une zone (`null` = rien à copier). */
export interface PreviewPart {
  index: PartIndex;
  left: string | null;
  right: string | null;
}

export type DraftPreview = { kind: 'classic'; parts: PreviewPart[] } | { kind: 'farm'; route: FarmRoute };

/**
 * Aperçu des clics, calculé avec les règles existantes (`cardParts`, `partCommand`,
 * `parseFarmRoute`) : aucune règle de copie n'est réécrite ici.
 */
export function draftPreview(draft: DestinationDraft): DraftPreview {
  if (draft.category === 'farm') return { kind: 'farm', route: parseFarmRoute(draft.command) };
  return {
    kind: 'classic',
    parts: cardParts(draft).map((p) => ({ index: p.index, left: partCommand(p, 'left'), right: partCommand(p, 'right') })),
  };
}
