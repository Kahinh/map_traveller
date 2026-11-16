/**
 * Vignette partagée : image importée, ou icône de catégorie sur la surface de carte. Utilisée par
 * les cartes de la grille, l'aperçu du formulaire et les lignes de la palette (qui ne doit pas
 * embarquer le code des cartes). Le conteneur fixe la taille et la forme.
 */
import { useState } from 'react';
import type { Category } from '../features/catalog/schema';
import { imageSrc } from '../lib/tauri/images';
import { CategoryIcon } from './icons';

/**
 * Illustration de la carte : image importée, ou, si elle est absente ou illisible, l'icône de
 * sa catégorie (issue n°13, C-1). Aucune couleur propre : la surface est celle de la carte.
 * `category` à `null` : surface seule.
 */
export function CardVisual({ category, image }: { category: Category | null; image: string | null }) {
  const src = imageSrc(image);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  return src && src !== brokenSrc ? (
    <img
      className="card__img"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setBrokenSrc(src)}
    />
  ) : (
    <span className="card__placeholder" aria-hidden>
      {category !== null && <CategoryIcon category={category} />}
    </span>
  );
}
