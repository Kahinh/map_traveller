/**
 * Vignette partagée : image importée, ou icône de catégorie sur la surface de carte. Utilisée par
 * les cartes de la grille, l'aperçu du formulaire et les lignes de la palette (qui ne doit pas
 * embarquer le code des cartes). Le conteneur fixe la taille et la forme.
 */
import { useState } from 'react';
import type { Category } from '../features/catalog/schema';
import { imageSrc, thumbMissing, thumbSrc } from '../lib/tauri/images';
import { CategoryIcon } from './icons';

/** Aucune adresse en échec (objet partagé : pas d'allocation par carte). */
const NO_FAILURE: ReadonlySet<string> = new Set();

/**
 * Illustration de la carte : image importée, ou, si elle est absente ou illisible, l'icône de
 * sa catégorie (issue n°13, C-1). Aucune couleur propre : la surface est celle de la carte.
 * `category` à `null` : surface seule.
 *
 * L'image est affichée par sa vignette 256 px (issue n°14, A4) ; vignette absente : l'original,
 * et la fenêtre principale fabrique la vignette pour les affichages suivants.
 */
export function CardVisual({ category, image }: { category: Category | null; image: string | null }) {
  const thumb = thumbSrc(image);
  const full = imageSrc(image);
  const [failed, setFailed] = useState<ReadonlySet<string>>(NO_FAILURE);
  const src = thumb && !failed.has(thumb) ? thumb : full && !failed.has(full) ? full : null;
  const onError = () => {
    if (!src) return;
    if (src === thumb && image) thumbMissing(image);
    setFailed((prev) => new Set(prev).add(src));
  };
  return src ? (
    <img
      className="card__img"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={onError}
    />
  ) : (
    <span className="card__placeholder" aria-hidden>
      {category !== null && <CategoryIcon category={category} />}
    </span>
  );
}
