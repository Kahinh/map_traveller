/**
 * Grille fenêtrée (issue n°14, A3). PUR et testé.
 *
 * La grille ne crée que les rangées visibles, plus une marge au-dessus et au-dessous ; des
 * espaceurs (`padTop`, `padBottom`) gardent la hauteur totale défilable. Le calcul reproduit
 * celui de CSS pour `repeat(auto-fill, minmax(<taille minimale>, 1fr))` avec un écart `gap` :
 * - colonnes = plus grand n tel que n × taille minimale + (n − 1) × écart ≤ largeur, au moins 1 ;
 * - taille d'une carte (carrée) = part de la largeur après les écarts, jamais sous la minimale ;
 * - pas d'une rangée = taille d'une carte + écart.
 * Aucune donnée de catalogue ici : seulement des nombres et des indices.
 */

export interface GridWindowInput {
  /** Nombre d'éléments de la grille (destinations visibles). */
  count: number;
  /** Largeur de contenu de la grille, en px CSS. */
  width: number;
  /** Hauteur visible du conteneur qui défile, en px CSS. */
  viewportHeight: number;
  /** Défilement mesuré depuis le haut de la grille (peut être négatif ou dépasser le bas). */
  scrollTop: number;
  /** Taille minimale d'une carte (`--mt-card-size`). */
  minCardSize: number;
  /** Écart entre cartes, en ligne comme en colonne (`--mt-gap`). */
  gap: number;
  /** Rangées rendues en plus au-dessus et au-dessous de la zone visible. */
  overscanRows: number;
}

export interface GridWindow {
  columns: number;
  /** Côté d'une carte, en px CSS. */
  cardSize: number;
  /** Hauteur d'une rangée plus l'écart qui la suit. */
  rowStride: number;
  totalRows: number;
  /** Rangées rendues : [firstRow, endRow[. */
  firstRow: number;
  endRow: number;
  /** Indices d'éléments rendus : [start, end[. */
  start: number;
  end: number;
  /** Espaceur au-dessus des rangées rendues. */
  padTop: number;
  /** Espaceur au-dessous des rangées rendues. */
  padBottom: number;
  /** Hauteur totale de la grille, espaceurs compris. */
  totalHeight: number;
}

const finiteOr = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);

/** Nombre de colonnes de `repeat(auto-fill, minmax(minCardSize, 1fr))` pour une largeur donnée. */
export function gridColumns(width: number, minCardSize: number, gap: number): number {
  const w = Math.max(0, finiteOr(width, 0));
  const min = Math.max(1, finiteOr(minCardSize, 1));
  const g = Math.max(0, finiteOr(gap, 0));
  return Math.max(1, Math.floor((w + g) / (min + g)));
}

/** Fenêtre de rendu de la grille. Ne lève jamais ; entrées absurdes ramenées à des bornes sûres. */
export function computeGridWindow(input: GridWindowInput): GridWindow {
  const count = Math.max(0, Math.floor(finiteOr(input.count, 0)));
  const width = Math.max(0, finiteOr(input.width, 0));
  const min = Math.max(1, finiteOr(input.minCardSize, 1));
  const gap = Math.max(0, finiteOr(input.gap, 0));
  const viewport = Math.max(0, finiteOr(input.viewportHeight, 0));
  const overscan = Math.max(0, Math.floor(finiteOr(input.overscanRows, 0)));

  const columns = gridColumns(width, min, gap);
  const cardSize = Math.max(min, (width - (columns - 1) * gap) / columns);
  const rowStride = cardSize + gap;
  const totalRows = Math.ceil(count / columns);
  const totalHeight = totalRows > 0 ? totalRows * rowStride - gap : 0;

  if (totalRows === 0) {
    return { columns, cardSize, rowStride, totalRows, firstRow: 0, endRow: 0, start: 0, end: 0, padTop: 0, padBottom: 0, totalHeight };
  }

  // Défilement ramené dans [0, défilement maximal] : un contenu raccourci (recherche) ne laisse
  // jamais une fenêtre au-delà du bas.
  const maxScroll = Math.max(0, totalHeight - viewport);
  const scrollTop = Math.min(Math.max(0, finiteOr(input.scrollTop, 0)), maxScroll);

  const firstVisible = Math.min(totalRows - 1, Math.floor(scrollTop / rowStride));
  const lastVisible = Math.min(totalRows - 1, Math.floor((scrollTop + viewport) / rowStride));
  const firstRow = Math.max(0, firstVisible - overscan);
  const endRow = Math.min(totalRows, lastVisible + 1 + overscan);

  return {
    columns,
    cardSize,
    rowStride,
    totalRows,
    firstRow,
    endRow,
    start: firstRow * columns,
    end: Math.min(count, endRow * columns),
    padTop: firstRow * rowStride,
    padBottom: (totalRows - endRow) * rowStride,
    totalHeight,
  };
}

/**
 * Défilement (depuis le haut de la grille) qui amène l'élément `index` à l'écran au plus près,
 * comme `scrollIntoView({ block: 'nearest' })` : inchangé s'il est déjà entièrement visible.
 * Index hors limites : défilement inchangé.
 */
export function scrollTopToReveal(win: GridWindow, index: number, scrollTop: number, viewportHeight: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= win.totalRows * win.columns) return scrollTop;
  const top = Math.floor(index / win.columns) * win.rowStride;
  const bottom = top + win.cardSize;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return Math.max(0, bottom - viewportHeight);
  return scrollTop;
}
