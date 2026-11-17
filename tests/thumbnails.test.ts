import { describe, expect, it } from 'vitest';
import { centerCrop, THUMB_SIZE, thumbPath } from '../src/features/catalog/thumbnails';

describe('thumbPath', () => {
  it('vignette des images importées', () => {
    expect(thumbPath('images/img-1a-2b-0.png')).toBe('images/img-1a-2b-0.thumb.webp');
    expect(thumbPath('images/img-1.jpg')).toBe('images/img-1.thumb.webp');
    expect(thumbPath('images/img-1.webp')).toBe('images/img-1.thumb.webp');
  });

  it.each([
    null,
    '',
    'images/img-1.thumb.webp',
    'images/banque.webp',
    'images/atelier-bijoutiers.png',
    'images/../catalog.json',
    'images/sub/img-1.png',
    'images/IMG-1.png',
    'images/img-1.gif',
    'img-1.png',
    '/images/img-1.png',
    'https://exemple.invalid/a.png',
  ])('aucune vignette pour %s', (p) => {
    expect(thumbPath(p)).toBeNull();
  });
});

describe('centerCrop', () => {
  it('grande image paysage : carré central réduit à 256', () => {
    expect(centerCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, side: 3000, size: THUMB_SIZE });
  });

  it('portrait : carré central', () => {
    expect(centerCrop(300, 900)).toEqual({ sx: 0, sy: 300, side: 300, size: THUMB_SIZE });
  });

  it('petite image : jamais agrandie', () => {
    expect(centerCrop(64, 80)).toEqual({ sx: 0, sy: 8, side: 64, size: 64 });
  });

  it('aucune dimension n’atteint plus de 256 px', () => {
    for (const [w, h] of [[10000, 20], [20, 10000], [257, 257]] as const) {
      expect(centerCrop(w, h).size).toBeLessThanOrEqual(THUMB_SIZE);
    }
  });
});
