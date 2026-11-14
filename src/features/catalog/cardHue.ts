/**
 * Teinte d'une carte sans image, dérivée du nom. Fonction pure et déterministe : un même
 * nom donne toujours la même teinte, d'une session à l'autre. Seule la teinte (0–359) sort
 * d'ici ; les couleurs sont construites dans `tokens.css` à partir de `--card-hue`.
 */
import { normalizeText } from './search';

/**
 * Hachage FNV-1a 32 bits du nom normalisé (casse, accents et espaces ignorés), ramené à
 * un angle de teinte entier dans [0, 360).
 */
export function cardHue(name: string): number {
  const text = normalizeText(name);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 360;
}
