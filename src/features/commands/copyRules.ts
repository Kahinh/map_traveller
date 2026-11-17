/**
 * Règles de copie des destinations classiques (PNJ, Donjons, Lieux-dits).
 * Invariants 1 et 2 de `CLAUDE.md`. Fonctions pures : aucun accès système.
 *
 * Le champ `command` est la source de vérité : texte brut saisi par l'utilisateur,
 * jamais normalisé ni reconstruit.
 */

/** `/zaap` en début de segment, suivi d'une frontière (espace, fin). Insensible à la casse. */
const ZAAP_SEGMENT = /^\s*\/zaap(?=\s|$)/i;

/** Vrai si le segment (texte entre deux `;`) est une commande `/zaap`. */
export function isZaapSegment(segment: string): boolean {
  return ZAAP_SEGMENT.test(segment);
}

/** Commande vide ou uniquement composée d'espaces : rien ne doit être copié. */
export function isEmptyCommand(command: string | null | undefined): boolean {
  return command == null || command.trim() === '';
}

/**
 * Découpe le premier segment `/zaap` éventuel.
 * Retourne `{ zaap, rest }` où `rest` est le texte EXACT qui suit le premier `;`.
 * Si la commande ne commence pas par `/zaap`, `zaap` vaut `null` et `rest` la commande entière.
 */
export function splitLeadingZaap(command: string): { zaap: string | null; rest: string } {
  const sep = command.indexOf(';');
  const first = sep === -1 ? command : command.slice(0, sep);
  if (!isZaapSegment(first)) return { zaap: null, rest: command };
  return { zaap: first, rest: sep === -1 ? '' : command.slice(sep + 1) };
}

/**
 * Clic gauche : commande sans le `/zaap` initial (premier segment uniquement).
 * Retourne `null` s'il n'y a rien à copier (commande vide ou `/zaap` seul).
 */
export function leftClickCommand(command: string): string | null {
  if (isEmptyCommand(command)) return null;
  const { rest } = splitLeadingZaap(command);
  return rest.trim() === '' ? null : rest;
}

/** Clic droit : intégralité du champ `command`. `null` si vide. */
export function rightClickCommand(command: string): string | null {
  return isEmptyCommand(command) ? null : command;
}
