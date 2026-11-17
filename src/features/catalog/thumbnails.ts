/**
 * Vignettes d'images (issue n°14, A4). Fonctions pures.
 *
 * Une image importée `images/img-….<png|jpg|webp>` a une vignette `images/img-….thumb.webp`,
 * carrée, de `THUMB_SIZE` px de côté : le centre de l'image, comme l'affichent les cartes
 * (`object-fit: cover`). La grille et la palette n'affichent qu'elle ; l'original reste intact.
 *
 * Seuls les noms produits par l'import (`img-<horodatage>-<processus>-<compteur>`, voir
 * `unique_stem` dans `images.rs`) ont une vignette. Les images du catalogue livré
 * (`images/banque.webp`…) sont déjà en 256 px : leur fabriquer une vignette serait inutile, et
 * la palette, qui n'en fabrique pas, demanderait un fichier absent.
 */

/** Côté de la vignette, en pixels (une carte fait 90 px, 180 px à 200 %). */
export const THUMB_SIZE = 256;

/** Nom d'import, borné comme dans `imported_name` (`images.rs`) : 128 caractères au plus. */
const IMPORTED = /^images\/(img-[a-z0-9-]{1,124})\.(?:png|jpg|webp)$/;

/** Chemin relatif de la vignette d'une image importée, ou `null`. */
export function thumbPath(relative: string | null): string | null {
  if (!relative) return null;
  const m = IMPORTED.exec(relative);
  return m ? `images/${m[1]}.thumb.webp` : null;
}

export interface CropRect {
  sx: number;
  sy: number;
  side: number;
  /** Côté de la vignette produite : `THUMB_SIZE`, ou moins pour une petite image. */
  size: number;
}

/** Carré central d'une image de `width` × `height`, et la taille de la vignette produite. */
export function centerCrop(width: number, height: number, max: number = THUMB_SIZE): CropRect {
  const side = Math.max(1, Math.min(width, height));
  return {
    sx: Math.floor((width - side) / 2),
    sy: Math.floor((height - side) / 2),
    side,
    size: Math.min(side, max),
  };
}
