import { describe, expect, it } from 'vitest';
import { rovingTarget } from '../src/components/useRovingFocus';

describe('rovingTarget', () => {
  it('les flèches bouclent aux extrémités', () => {
    expect(rovingTarget('ArrowRight', 2, 3, 'horizontal')).toBe(0);
    expect(rovingTarget('ArrowLeft', 0, 3, 'horizontal')).toBe(2);
    expect(rovingTarget('ArrowRight', 0, 3, 'horizontal')).toBe(1);
  });

  it('Début et Fin vont aux extrémités', () => {
    expect(rovingTarget('Home', 2, 4, 'both')).toBe(0);
    expect(rovingTarget('End', 0, 4, 'both')).toBe(3);
  });

  it('haut et bas ne servent qu’au groupe de boutons radio', () => {
    expect(rovingTarget('ArrowDown', 0, 3, 'both')).toBe(1);
    expect(rovingTarget('ArrowUp', 0, 3, 'both')).toBe(2);
    expect(rovingTarget('ArrowDown', 0, 3, 'horizontal')).toBeNull();
  });

  it('autre touche ou groupe vide : rien', () => {
    expect(rovingTarget('a', 0, 3, 'both')).toBeNull();
    expect(rovingTarget('Home', 0, 0, 'both')).toBeNull();
  });
});
