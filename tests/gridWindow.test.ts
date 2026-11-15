import { describe, expect, it } from 'vitest';
import { computeGridWindow, gridColumns, scrollTopToReveal, type GridWindowInput } from '../src/features/catalog/gridWindow';

const base: GridWindowInput = {
  count: 0,
  width: 494,
  viewportHeight: 200,
  scrollTop: 0,
  minCardSize: 90,
  gap: 6,
  overscanRows: 2,
};

const win = (patch: Partial<GridWindowInput>) => computeGridWindow({ ...base, ...patch });

describe('gridColumns', () => {
  it('reproduit auto-fill : n × 90 + (n − 1) × 6 ≤ largeur', () => {
    expect(gridColumns(90, 90, 6)).toBe(1);
    expect(gridColumns(185, 90, 6)).toBe(1);
    expect(gridColumns(186, 90, 6)).toBe(2);
    expect(gridColumns(494, 90, 6)).toBe(5);
  });

  it('largeur nulle, négative ou plus petite qu’une carte → une colonne', () => {
    expect(gridColumns(0, 90, 6)).toBe(1);
    expect(gridColumns(-20, 90, 6)).toBe(1);
    expect(gridColumns(40, 90, 6)).toBe(1);
    expect(gridColumns(Number.NaN, 90, 6)).toBe(1);
  });
});

describe('computeGridWindow', () => {
  it('0 élément : rien à rendre, aucune hauteur', () => {
    const w = win({ count: 0 });
    expect(w).toMatchObject({ totalRows: 0, start: 0, end: 0, padTop: 0, padBottom: 0, totalHeight: 0 });
  });

  it('une seule rangée : tout est rendu, sans espaceur', () => {
    const w = win({ count: 3 });
    expect(w.columns).toBe(5);
    expect(w).toMatchObject({ totalRows: 1, firstRow: 0, endRow: 1, start: 0, end: 3, padTop: 0, padBottom: 0 });
    expect(w.totalHeight).toBeCloseTo(w.cardSize);
  });

  it('largeur étroite (360) : 3 colonnes, cartes agrandies pour remplir la ligne', () => {
    const w = win({ count: 6500, width: 344 });
    expect(w.columns).toBe(3);
    expect(w.cardSize).toBeCloseTo((344 - 2 * 6) / 3);
    expect(w.cardSize * 3 + 2 * 6).toBeCloseTo(344);
  });

  it('largeur large : plus de colonnes, cartes jamais sous la taille minimale', () => {
    const w = win({ count: 6500, width: 744 });
    expect(w.columns).toBe(7);
    expect(w.cardSize).toBeGreaterThanOrEqual(90);
    expect(w.rowStride).toBeCloseTo(w.cardSize + 6);
  });

  it('en haut : rangées visibles + 2 de marge au-dessous, nombre borné', () => {
    const w = win({ count: 6500 });
    // 5 colonnes, carte de 94 px, pas de 100 : 200 px visibles → rangées 0 à 2, + 2 de marge.
    expect(w.cardSize).toBeCloseTo(94);
    expect(w).toMatchObject({ firstRow: 0, endRow: 5, start: 0, end: 25, padTop: 0 });
    expect(w.totalRows).toBe(1300);
  });

  it('la hauteur totale est conservée : espaceurs + rangées rendues', () => {
    for (const scrollTop of [0, 1234, 50_000, 129_800]) {
      const w = win({ count: 6500, scrollTop });
      const rendered = w.endRow - w.firstRow;
      expect(w.padTop + rendered * w.rowStride - 6 + w.padBottom).toBeCloseTo(w.totalHeight);
    }
  });

  it('au milieu : marge de 2 rangées de chaque côté', () => {
    const w = win({ count: 6500, scrollTop: 1050 });
    // Première rangée visible : 10 ; dernière : floor(1250 / 100) = 12.
    expect(w).toMatchObject({ firstRow: 8, endRow: 15, start: 40, end: 75 });
    expect(w.padTop).toBeCloseTo(800);
  });

  it('défilement en bas : les derniers éléments sont rendus, aucun espaceur au-dessous', () => {
    const w = win({ count: 6501, scrollTop: 1e9 });
    expect(w.end).toBe(6501);
    expect(w.endRow).toBe(w.totalRows);
    expect(w.padBottom).toBe(0);
    // Défilement ramené au maximum : la fenêtre couvre le bas de la zone visible.
    expect(w.padTop + (w.endRow - w.firstRow) * w.rowStride - 6).toBeCloseTo(w.totalHeight);
    expect(w.padTop).toBeLessThanOrEqual(w.totalHeight - 200);
  });

  it('défilement négatif : traité comme 0', () => {
    expect(win({ count: 6500, scrollTop: -500 })).toEqual(win({ count: 6500, scrollTop: 0 }));
  });

  it('changement de colonnes au redimensionnement : la plage suit la nouvelle grille', () => {
    const narrow = win({ count: 6500, width: 344, scrollTop: 5000 });
    const wide = win({ count: 6500, width: 744, scrollTop: 5000 });
    expect(narrow.columns).toBe(3);
    expect(wide.columns).toBe(7);
    expect(narrow.start % 3).toBe(0);
    expect(wide.start % 7).toBe(0);
    expect(wide.totalRows).toBe(Math.ceil(6500 / 7));
    // Le nombre d'éléments rendus reste borné dans les deux cas.
    expect(narrow.end - narrow.start).toBeLessThan(40);
    expect(wide.end - wide.start).toBeLessThan(60);
  });

  it('contenu raccourci (recherche) avec un ancien défilement : fenêtre ramenée en haut', () => {
    const w = win({ count: 4, scrollTop: 80_000 });
    expect(w).toMatchObject({ firstRow: 0, endRow: 1, start: 0, end: 4, padTop: 0, padBottom: 0 });
  });

  it('nombre de cartes rendues indépendant de la taille du catalogue', () => {
    const small = win({ count: 400, scrollTop: 1000 });
    const big = win({ count: 65_000, scrollTop: 1000 });
    expect(small.end - small.start).toBe(big.end - big.start);
  });
});

describe('scrollTopToReveal', () => {
  const w = win({ count: 6500 });

  it('élément déjà visible : défilement inchangé', () => {
    expect(scrollTopToReveal(w, 0, 0, 200)).toBe(0);
    expect(scrollTopToReveal(w, 7, 0, 200)).toBe(0);
  });

  it('élément au-dessous : son bas aligné sur le bas de la zone visible', () => {
    // Index 52 → rangée 10, haut 1000, bas 1094.
    expect(scrollTopToReveal(w, 52, 0, 200)).toBeCloseTo(894);
  });

  it('élément au-dessus : son haut aligné sur le haut de la zone visible', () => {
    expect(scrollTopToReveal(w, 12, 5000, 200)).toBeCloseTo(200);
  });

  it('index hors limites : défilement inchangé', () => {
    expect(scrollTopToReveal(w, -1, 300, 200)).toBe(300);
    expect(scrollTopToReveal(w, 999_999, 300, 200)).toBe(300);
    expect(scrollTopToReveal(w, 1.5, 300, 200)).toBe(300);
  });
});
