/**
 * Empreinte d'un texte de fichier : longueur et hachage FNV-1a 32 bits. Fonction pure.
 *
 * La palette relit le catalogue à chaque affichage et ne le réindexe que s'il a changé. Garder
 * le texte précédent pour le comparer coûtait sa taille en mémoire au repos (plusieurs Mo) ;
 * l'empreinte suffit. Une collision (même longueur ET même hachage pour deux contenus
 * différents) laisserait l'ancien index jusqu'au prochain changement : risque accepté, sans
 * conséquence sur les données (la palette n'écrit jamais).
 */

/** Empreinte de `text` ; `null` (fichier absent) a la sienne, distincte de celle du texte vide. */
export function textFingerprint(text: string | null): string {
  if (text === null) return 'absent';
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}
