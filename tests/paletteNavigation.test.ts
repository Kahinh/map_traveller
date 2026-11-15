import { describe, expect, it } from 'vitest';
import { initialNav, navReducer, type NavAction, type NavState } from '../src/features/palette/navigation';

const run = (state: NavState, counts: number[], ...actions: NavAction[]) =>
  actions.reduce((s, a) => navReducer(s, a, counts), state);

describe('navReducer', () => {
  const counts = [1, 2, 1];

  it('results : premier résultat sélectionné, ou -1 si la liste est vide', () => {
    expect(navReducer({ index: 2, choice: 1 }, { type: 'results' }, counts)).toEqual({ index: 0, choice: 0 });
    expect(navReducer({ index: 2, choice: 1 }, { type: 'results' }, [])).toEqual({ index: -1, choice: 0 });
    expect(initialNav(3)).toEqual({ index: 0, choice: 0 });
    expect(initialNav(0)).toEqual({ index: -1, choice: 0 });
  });

  it('next / prev bouclent aux extrémités', () => {
    expect(run({ index: 2, choice: 0 }, counts, { type: 'next' })).toEqual({ index: 0, choice: 0 });
    expect(run({ index: 0, choice: 0 }, counts, { type: 'prev' })).toEqual({ index: 2, choice: 0 });
    expect(run({ index: 0, choice: 0 }, counts, { type: 'next' }, { type: 'next' })).toEqual({ index: 2, choice: 0 });
  });

  it('first / last', () => {
    expect(run({ index: 1, choice: 0 }, counts, { type: 'first' })).toEqual({ index: 0, choice: 0 });
    expect(run({ index: 0, choice: 0 }, counts, { type: 'last' })).toEqual({ index: 2, choice: 0 });
  });

  it('liste vide : toujours -1', () => {
    for (const type of ['next', 'prev', 'first', 'last', 'choice-next'] as const) {
      expect(navReducer({ index: -1, choice: 0 }, { type }, [])).toEqual({ index: -1, choice: 0 });
    }
    expect(navReducer({ index: 3, choice: 1 }, { type: 'next' }, [])).toEqual({ index: -1, choice: 0 });
  });

  it('set : sélectionne une ligne valide, ignore une ligne invalide', () => {
    expect(run({ index: 0, choice: 0 }, counts, { type: 'set', index: 2 })).toEqual({ index: 2, choice: 0 });
    const s = { index: 0, choice: 0 };
    expect(navReducer(s, { type: 'set', index: 7 }, counts)).toBe(s);
    expect(navReducer(s, { type: 'set', index: -1 }, counts)).toBe(s);
  });

  it('choice borné, sans bouclage', () => {
    const start = { index: 1, choice: 0 };
    expect(run(start, counts, { type: 'choice-next' })).toEqual({ index: 1, choice: 1 });
    expect(run(start, counts, { type: 'choice-next' }, { type: 'choice-next' })).toEqual({ index: 1, choice: 1 });
    expect(run(start, counts, { type: 'choice-prev' })).toEqual({ index: 1, choice: 0 });
    expect(run(start, counts, { type: 'set-choice', choice: 1 })).toEqual({ index: 1, choice: 1 });
    expect(run(start, counts, { type: 'set-choice', choice: 5 })).toEqual({ index: 1, choice: 1 });
  });

  it('choice sans effet sur une ligne à un seul choix', () => {
    const s = { index: 0, choice: 0 };
    expect(navReducer(s, { type: 'choice-next' }, counts)).toBe(s);
    expect(navReducer(s, { type: 'set-choice', choice: 1 }, counts)).toBe(s);
  });

  it('tout changement de ligne remet choice à 0 ; la même ligne le conserve', () => {
    const s = { index: 1, choice: 1 };
    expect(navReducer(s, { type: 'next' }, counts)).toEqual({ index: 2, choice: 0 });
    expect(navReducer(s, { type: 'prev' }, counts)).toEqual({ index: 0, choice: 0 });
    expect(navReducer(s, { type: 'set', index: 1 }, counts)).toBe(s); // survol de la même ligne
    expect(run(s, [2, 2], { type: 'next' }, { type: 'prev' })).toEqual({ index: 1, choice: 0 });
  });

  it('état inchangé : même objet renvoyé (aucun rendu inutile)', () => {
    const s = { index: 0, choice: 0 };
    expect(navReducer(s, { type: 'first' }, counts)).toBe(s);
    expect(navReducer(s, { type: 'results' }, counts)).toBe(s);
  });

  it('ligne sélectionnée hors bornes : la navigation repart du début', () => {
    expect(navReducer({ index: 9, choice: 1 }, { type: 'next' }, counts)).toEqual({ index: 0, choice: 0 });
    expect(navReducer({ index: 9, choice: 1 }, { type: 'prev' }, counts)).toEqual({ index: 2, choice: 0 });
  });
});
