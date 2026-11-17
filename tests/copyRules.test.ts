// Coordonnées FICTIVES : elles illustrent les règles, ce ne sont pas des trajets réels.
import { describe, expect, it } from 'vitest';
import { isZaapSegment, leftClickCommand, rightClickCommand, splitLeadingZaap } from '../src/features/commands/copyRules';

const EXAMPLE = '/zaap 5 -18;/travel 1 1;/travel 2 2;/travel 3 3';

describe('clic gauche / clic droit (invariant 2)', () => {
  it('exemple de référence', () => {
    expect(leftClickCommand(EXAMPLE)).toBe('/travel 1 1;/travel 2 2;/travel 3 3');
    expect(rightClickCommand(EXAMPLE)).toBe(EXAMPLE);
  });

  it('test 3/4 : /zaap ...;/travel A;/travel B', () => {
    const cmd = '/zaap 1 2;/travel 10 -4;/travel 11 -4';
    expect(leftClickCommand(cmd)).toBe('/travel 10 -4;/travel 11 -4');
    expect(rightClickCommand(cmd)).toBe(cmd);
  });

  it('test 5 : sans Zaap, clic gauche et droit identiques', () => {
    const cmd = '/travel 1 1;/travel 2 2';
    expect(leftClickCommand(cmd)).toBe(cmd);
    expect(rightClickCommand(cmd)).toBe(cmd);
  });

  it('test 6 : aucun segment perdu sur une longue commande', () => {
    const travels = Array.from({ length: 40 }, (_, i) => `/travel ${i} ${-i}`).join(';');
    const cmd = `/zaap 0 0;${travels}`;
    expect(leftClickCommand(cmd)).toBe(travels);
    expect(leftClickCommand(cmd)!.split(';')).toHaveLength(40);
  });

  it('conserve exactement espaces et format de la suite', () => {
    const cmd = '/zaap 5 -18; /travel  1 1 ;/travel 2,2';
    expect(leftClickCommand(cmd)).toBe(' /travel  1 1 ;/travel 2,2');
  });

  it('ne retire que le PREMIER segment /zaap', () => {
    const cmd = '/zaap 1 1;/travel 2 2;/zaap 3 3;/travel 4 4';
    expect(leftClickCommand(cmd)).toBe('/travel 2 2;/zaap 3 3;/travel 4 4');
  });

  it('un /zaap qui n\'est pas en tête reste intact', () => {
    const cmd = '/travel 1 1;/zaap 2 2';
    expect(leftClickCommand(cmd)).toBe(cmd);
  });

  it('frontière de commande : /zaapi n\'est pas /zaap', () => {
    const cmd = '/zaapi 1 1;/travel 2 2';
    expect(isZaapSegment('/zaapi 1 1')).toBe(false);
    expect(leftClickCommand(cmd)).toBe(cmd);
  });

  it('insensible à la casse de /zaap', () => {
    expect(leftClickCommand('/ZAAP 1 1;/travel 2 2')).toBe('/travel 2 2');
  });

  it('commande vide ou blanche : rien à copier', () => {
    expect(leftClickCommand('')).toBeNull();
    expect(rightClickCommand('')).toBeNull();
    expect(leftClickCommand('   ')).toBeNull();
    expect(rightClickCommand('  \n ')).toBeNull();
  });

  it('/zaap seul : clic gauche sans rien à copier, clic droit complet', () => {
    expect(leftClickCommand('/zaap 1 1')).toBeNull();
    expect(leftClickCommand('/zaap 1 1;')).toBeNull();
    expect(rightClickCommand('/zaap 1 1')).toBe('/zaap 1 1');
  });

  it('multi-ligne : les retours à la ligne sont conservés', () => {
    const cmd = '/zaap 1 1;\n/travel 2 2;\n/travel 3 3';
    expect(leftClickCommand(cmd)).toBe('\n/travel 2 2;\n/travel 3 3');
    expect(rightClickCommand(cmd)).toBe(cmd);
  });

  it('splitLeadingZaap expose les deux parties sans perte', () => {
    const { zaap, rest } = splitLeadingZaap(EXAMPLE);
    expect(`${zaap};${rest}`).toBe(EXAMPLE);
  });
});
