import { describe, expect, it } from 'vitest';
import { cardHue } from '../src/features/catalog/cardHue';

describe('teinte des cartes sans image', () => {
  it('est déterministe', () => {
    expect(cardHue('Lieu Exemple')).toBe(cardHue('Lieu Exemple'));
  });

  it('renvoie un entier dans [0, 360)', () => {
    for (const name of ['', 'A', 'Lieu Exemple', 'Étape fictive 42', 'x'.repeat(500)]) {
      const h = cardHue(name);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it('ignore casse, accents et espaces superflus', () => {
    expect(cardHue('  Clairière   Fictive ')).toBe(cardHue('clairiere fictive'));
  });

  it('distingue des noms différents', () => {
    const hues = new Set(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'].map(cardHue));
    expect(hues.size).toBeGreaterThan(3);
  });

  it('valeurs de référence stables (FNV-1a 32 bits modulo 360)', () => {
    // Le nom vide donne la base FNV : 2166136261 % 360.
    expect(cardHue('')).toBe(2166136261 % 360);
    expect(cardHue('a')).toBe(0xe40c292c % 360);
  });
});
