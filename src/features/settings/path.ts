/** Affichage des chemins dans les Paramètres. PUR et testé. */

/**
 * Raccourcit `text` par le milieu (`début…fin`) s'il dépasse `max` caractères, pour garder
 * visibles le lecteur et le nom du dossier. Compte en points de code : un caractère hors du
 * plan de base n'est jamais coupé en deux. Le résultat ne dépasse jamais `max` caractères.
 * Uniquement pour l'affichage : le chemin complet reste celui qu'on copie et qu'on ouvre.
 */
export function truncateMiddle(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  if (max <= 1) return chars.slice(0, Math.max(0, max)).join('');
  const keep = max - 1; // un caractère pour « … »
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${chars.slice(0, head).join('')}…${tail > 0 ? chars.slice(-tail).join('') : ''}`;
}
