import { describe, expect, it } from 'vitest';
import { truncateMiddle } from '../src/features/settings/path';

// Chemin fictif.
const LONG = 'C:\\Users\\utilisateur-fictif-au-nom-long\\AppData\\Roaming\\MapTraveller';

describe('truncateMiddle', () => {
  it('texte assez court : inchangé', () => {
    expect(truncateMiddle('C:\\Données', 48)).toBe('C:\\Données');
    expect(truncateMiddle('abcdef', 6)).toBe('abcdef');
    expect(truncateMiddle('', 4)).toBe('');
  });

  it('texte long : début et fin conservés, longueur exacte', () => {
    const out = truncateMiddle(LONG, 30);
    expect(Array.from(out)).toHaveLength(30);
    expect(out.startsWith('C:\\Users\\')).toBe(true);
    expect(out.endsWith('MapTraveller')).toBe(true);
    expect(out).toContain('…');
  });

  it('découpe équilibrée', () => {
    expect(truncateMiddle('abcdefghij', 5)).toBe('ab…ij');
    expect(truncateMiddle('abcdefghij', 6)).toBe('abc…ij');
  });

  it('ne coupe jamais un caractère hors du plan de base', () => {
    const g = '\u{1D11E}'; // clef de sol, deux unités UTF-16
    expect(truncateMiddle(g.repeat(10), 5)).toBe(`${g}${g}…${g}${g}`);
  });

  it('limites très petites : jamais plus long que max', () => {
    expect(truncateMiddle('abcdef', 2)).toBe('a…');
    expect(truncateMiddle('abcdef', 1)).toBe('a');
    expect(truncateMiddle('abcdef', 0)).toBe('');
  });
});
