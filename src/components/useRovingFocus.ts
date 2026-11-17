import { useRef, type KeyboardEvent } from 'react';

/** `both` : groupe de boutons radio (quatre flèches) ; `horizontal` : rangée d'onglets. */
export type RovingAxis = 'both' | 'horizontal';

/**
 * Indice visé par une touche dans un groupe de `count` éléments, ou `null` si la touche ne
 * déplace rien. Les flèches bouclent ; Début et Fin vont aux extrémités.
 */
export function rovingTarget(key: string, current: number, count: number, axis: RovingAxis): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  const next = key === 'ArrowRight' || (axis === 'both' && key === 'ArrowDown');
  const previous = key === 'ArrowLeft' || (axis === 'both' && key === 'ArrowUp');
  if (next) return current >= last ? 0 : current + 1;
  if (previous) return current <= 0 ? last : current - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
}

/**
 * Focus itinérant (contrôle segmenté, onglets) : une seule tabulation pour le groupe, sur
 * l'élément choisi ; les flèches, Début et Fin choisissent un autre élément ET lui donnent le
 * focus (la sélection suit le focus). `itemProps(i)` se pose sur chaque bouton du groupe.
 */
export function useRovingFocus(count: number, current: number, select: (index: number) => void, axis: RovingAxis) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const target = rovingTarget(e.key, current, count, axis);
    if (target === null) return;
    e.preventDefault();
    select(target);
    refs.current[target]?.focus();
  };

  return (index: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[index] = el;
    },
    tabIndex: index === current ? 0 : -1,
    onKeyDown,
  });
}
