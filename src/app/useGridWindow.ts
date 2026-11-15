import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { computeGridWindow, scrollTopToReveal, type GridWindow } from '../features/catalog/gridWindow';

/** Rangées rendues au-dessus et au-dessous de la zone visible. */
const OVERSCAN_ROWS = 2;

interface Measure {
  /** Largeur de contenu de `.grid` ; 0 tant qu'elle n'est pas mesurée. */
  width: number;
  /** Hauteur visible du conteneur qui défile. */
  viewportHeight: number;
  /** Distance entre le haut du contenu défilable et le haut de `.grid`. */
  offset: number;
  minCardSize: number;
  gap: number;
}

const INITIAL: Measure = { width: 0, viewportHeight: 0, offset: 0, minCardSize: 90, gap: 6 };

function px(value: string, fallback: number): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Grille fenêtrée (issue n°14) : seules les rangées visibles, plus une marge, sont rendues.
 *
 * - Mesures par `ResizeObserver` (largeur de la grille, hauteur du conteneur) : aucun minuteur.
 * - Défilement : l'état n'est mis à jour que si la plage de rangées rendue change, jamais à
 *   chaque pixel.
 * - Le nombre de colonnes est imposé à la grille (`gridTemplateColumns`) pour qu'il soit
 *   toujours celui du calcul ; la taille minimale et l'écart viennent des tokens CSS.
 */
export function useGridWindow(count: number) {
  const scrollRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState<Measure>(INITIAL);
  const [scrollTop, setScrollTop] = useState(0);
  const measureRef = useRef(measure);
  const countRef = useRef(count);
  const rangeRef = useRef({ start: 0, end: 0 });

  const win = useMemo(
    () =>
      computeGridWindow({
        count,
        width: measure.width,
        viewportHeight: measure.viewportHeight,
        scrollTop,
        minCardSize: measure.minCardSize,
        gap: measure.gap,
        overscanRows: OVERSCAN_ROWS,
      }),
    [count, measure, scrollTop],
  );

  // Références lues par les écouteurs, à jour après chaque rendu.
  useLayoutEffect(() => {
    measureRef.current = measure;
    countRef.current = count;
    rangeRef.current = { start: win.start, end: win.end };
  });

  const windowAt = useCallback((top: number): GridWindow => {
    const m = measureRef.current;
    return computeGridWindow({
      count: countRef.current,
      width: m.width,
      viewportHeight: m.viewportHeight,
      scrollTop: top,
      minCardSize: m.minCardSize,
      gap: m.gap,
      overscanRows: OVERSCAN_ROWS,
    });
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const grid = gridRef.current;
    if (!scroller || !grid) return;

    const read = () => {
      const style = getComputedStyle(grid);
      const width = grid.clientWidth - px(style.paddingLeft, 0) - px(style.paddingRight, 0);
      const offset = grid.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const next: Measure = {
        width: Math.max(0, width),
        viewportHeight: scroller.clientHeight,
        offset,
        minCardSize: px(style.getPropertyValue('--mt-card-size'), INITIAL.minCardSize),
        gap: px(style.getPropertyValue('--mt-gap'), INITIAL.gap),
      };
      const prev = measureRef.current;
      if (
        prev.width === next.width &&
        prev.viewportHeight === next.viewportHeight &&
        prev.offset === next.offset &&
        prev.minCardSize === next.minCardSize &&
        prev.gap === next.gap
      ) {
        return;
      }
      measureRef.current = next;
      setMeasure(next);
      setScrollTop(scroller.scrollTop - offset);
    };

    const onScroll = () => {
      const top = scroller.scrollTop - measureRef.current.offset;
      const next = windowAt(top);
      const range = rangeRef.current;
      if (next.start !== range.start || next.end !== range.end) {
        rangeRef.current = { start: next.start, end: next.end };
        setScrollTop(top);
      }
    };

    read();
    const observer = new ResizeObserver(read);
    observer.observe(scroller);
    observer.observe(grid);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [windowAt]);

  // Nombre d'éléments changé (recherche, filtre, enregistrement) : le navigateur a pu ramener le
  // défilement vers le haut sans que la plage rendue change ; relire la position réelle.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const top = scroller.scrollTop - measureRef.current.offset;
    setScrollTop((current) => (current === top ? current : top));
  }, [count]);

  /** Fait défiler jusqu'à l'élément `index` au plus près, même s'il n'est pas dans le DOM. */
  const reveal = useCallback(
    (index: number) => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const m = measureRef.current;
      const top = scroller.scrollTop - m.offset;
      const target = scrollTopToReveal(windowAt(top), index, top, m.viewportHeight);
      if (target !== top) scroller.scrollTop = target + m.offset;
    },
    [windowAt],
  );

  // Avant la première mesure, la grille garde sa règle CSS.
  const style: CSSProperties | undefined =
    measure.width > 0
      ? {
          gridTemplateColumns: `repeat(${win.columns}, minmax(var(--mt-card-size), 1fr))`,
          paddingTop: win.padTop,
          paddingBottom: win.padBottom,
        }
      : undefined;

  return { scrollRef, gridRef, start: win.start, end: win.end, style, reveal };
}
