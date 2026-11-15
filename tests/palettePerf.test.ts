import { describe, expect, it, vi } from 'vitest';
import type { Destination } from '../src/features/catalog/schema';
import { parseFarmRoute } from '../src/features/farm/farmRoute';
import { buildPaletteIndex, PALETTE_LIMIT, searchPalette } from '../src/features/palette/entries';

// Compte les analyses de parcours sans changer leur comportement.
vi.mock('../src/features/farm/farmRoute', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/farm/farmRoute')>();
  return { ...actual, parseFarmRoute: vi.fn(actual.parseFarmRoute) };
});

// Coordonnées fictives uniquement.
function dest(i: number, partial: Partial<Destination>): Destination {
  return {
    id: `d${i}`,
    name: `Destination ${i}`,
    category: 'place',
    zone: `Zone fictive ${i % 40}`,
    aliases: [],
    tags: [],
    image: null,
    command: `/zaap 1 1;/travel ${i % 30} ${i % 17}`,
    sortOrder: 0,
    enabled: true,
    twoStep: false,
    command2: '',
    ...partial,
  };
}

describe('performance de la palette', () => {
  it('5 000 destinations dont 200 parcours de 50 étapes : recherche rapide, aucune analyse pendant la frappe', () => {
    const route = Array.from({ length: 50 }, (_, s) => `/travel ${s} ${-s}`).join(';');
    const list = Array.from({ length: 5000 }, (_, i) =>
      i < 200 ? dest(i, { name: `Parcours ${i}`, category: 'farm', command: route }) : dest(i, {}),
    );
    const parse = vi.mocked(parseFarmRoute);
    parse.mockClear();
    const index = buildPaletteIndex(list, new Set(['d3']));
    expect(parse).toHaveBeenCalledTimes(200);
    parse.mockClear();

    // Première passe : remplit le cache du texte normalisé (fait une fois par ouverture).
    searchPalette(index, 'x', PALETTE_LIMIT);

    const queries = ['', 'd', 'des', 'destination 4', 'parcours 12', 'parcours 12 7 -7', 'farm 3', 'zone fictive 1'];
    for (const q of queries) {
      const t = performance.now();
      const { entries } = searchPalette(index, q, PALETTE_LIMIT);
      const elapsed = performance.now() - t;
      expect(entries.length).toBeLessThanOrEqual(PALETTE_LIMIT);
      expect(elapsed, `requête « ${q} »`).toBeLessThan(50);
    }
    expect(parse).not.toHaveBeenCalled();
  });
});
