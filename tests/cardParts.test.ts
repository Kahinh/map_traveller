// Coordonnées FICTIVES : elles illustrent les règles, ce ne sont pas des trajets réels.
import { describe, expect, it } from 'vitest';
import type { Destination } from '../src/features/catalog/schema';
import { cardParts, isTwoStep, partCommand } from '../src/features/commands/cardParts';
import { leftClickCommand, rightClickCommand } from '../src/features/commands/copyRules';

function dest(partial: Partial<Destination>): Destination {
  return {
    id: 'x',
    name: 'X',
    category: 'dungeon',
    zone: '',
    aliases: [],
    tags: [],
    image: null,
    command: '/zaap 5 -18;/travel 1 1',
    sortOrder: 0,
    enabled: true,
    twoStep: false,
    command2: '',
    ...partial,
  };
}

describe('carte classique (non-régression)', () => {
  it('une seule partie, clics identiques aux règles existantes', () => {
    const d = dest({ command: '/zaap 5 -18;/travel 1 1;/travel 2 2' });
    const parts = cardParts(d);
    expect(isTwoStep(d)).toBe(false);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ index: 1, command: d.command });
    expect(partCommand(parts[0]!, 'left')).toBe(leftClickCommand(d.command));
    expect(partCommand(parts[0]!, 'right')).toBe(rightClickCommand(d.command));
  });

  it('command2 renseignée mais case décochée : toujours une seule partie', () => {
    const d = dest({ twoStep: false, command2: '/travel 2 2' });
    expect(cardParts(d)).toHaveLength(1);
  });
});

describe('carte à deux étapes', () => {
  it('deux parties, dans l\'ordre, textes intacts', () => {
    const command = ' /zaap 1 1 ;/travel 2 2\n';
    const command2 = '/travel 3 3;\n/travel 4 4  ';
    const d = dest({ category: 'npc', twoStep: true, command, command2 });
    expect(isTwoStep(d)).toBe(true);
    expect(cardParts(d)).toEqual([
      { index: 1, command },
      { index: 2, command: command2 },
    ]);
  });

  it('zone 1 avec Zaap : gauche sans Zaap, droit intégral ; zone 2 sans Zaap : gauche = droit', () => {
    const d = dest({ twoStep: true, command: '/zaap 5 -18;/travel 1 1', command2: '/travel 2 2;/travel 3 3' });
    const [p1, p2] = cardParts(d);
    expect(partCommand(p1!, 'left')).toBe('/travel 1 1');
    expect(partCommand(p1!, 'right')).toBe('/zaap 5 -18;/travel 1 1');
    expect(partCommand(p2!, 'left')).toBe('/travel 2 2;/travel 3 3');
    expect(partCommand(p2!, 'right')).toBe('/travel 2 2;/travel 3 3');
  });

  it('zone 2 avec Zaap : même règle que la zone 1', () => {
    const d = dest({ twoStep: true, command2: '/zaap 7 7;/travel 8 8' });
    const p2 = cardParts(d)[1]!;
    expect(partCommand(p2, 'left')).toBe('/travel 8 8');
    expect(partCommand(p2, 'right')).toBe('/zaap 7 7;/travel 8 8');
  });

  it('command2 vide ou blanche : rien à copier', () => {
    for (const command2 of ['', '   ', '\n']) {
      const p2 = cardParts(dest({ twoStep: true, command2 }))[1]!;
      expect(partCommand(p2, 'left')).toBeNull();
      expect(partCommand(p2, 'right')).toBeNull();
    }
  });

  it('twoStep ignoré hors PNJ et Donjons (Lieux-dits, Farm)', () => {
    for (const category of ['place', 'farm'] as const) {
      const d = dest({ category, twoStep: true, command2: '/travel 2 2' });
      expect(isTwoStep(d)).toBe(false);
      expect(cardParts(d)).toHaveLength(1);
    }
  });
});
