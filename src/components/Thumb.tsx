/**
 * Vignette partagée : image importée, ou initiales sur un dégradé teinté. Utilisée par les
 * cartes de la grille, l'aperçu du formulaire et les lignes de la palette (qui ne doit pas
 * embarquer le code des cartes). Le conteneur fixe la taille et la forme.
 */
import { useState, type CSSProperties } from 'react';
import { cardHue } from '../features/catalog/cardHue';
import { imageSrc } from '../lib/tauri/images';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Illustration de la carte : image importée, ou initiales sur un dégradé teinté si absente ou
 * illisible. Seule la teinte numérique `--card-hue` est posée ici ; les couleurs sont dans
 * `tokens.css`.
 */
export function CardVisual({ name, image }: { name: string; image: string | null }) {
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
    <span
      className="card__placeholder"
      style={{ '--card-hue': String(cardHue(name)) } as CSSProperties}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
