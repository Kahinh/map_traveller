import { describe, expect, it } from 'vitest';
import type { Destination } from '../src/features/catalog/schema';
import { farmResumeCommand, farmStartCommand, parseFarmRoute } from '../src/features/farm/farmRoute';
import type { FarmRoute } from '../src/features/farm/farmRoute';
import { MAX_COORDINATE } from '../src/features/shared/coordinates';
import {
  farmStartEntry,
  farmStepEntry,
  formatPosition,
  parsePaletteQuery,
  stepsAtPosition,
} from '../src/features/palette/farmQuery';

/** « Parcours complet », puis chaque position si `expand` (ordre de la palette). */
const routeEntries = (d: Destination, route: FarmRoute, expand: boolean) => [
  farmStartEntry(d, route, false),
  ...(expand ? route.steps.map((s) => farmStepEntry(d, route, s.index, false)) : []),
];
/** Lignes de reprise de chaque occurrence d'une position. */
const positionEntries = (d: Destination, route: FarmRoute, position: { x: number; y?: number }) =>
  stepsAtPosition(route, position).map((s) => farmStepEntry(d, route, s.index, false));

// Coordonnées fictives uniquement.
function farm(partial: Partial<Destination> & { id: string; name: string; command: string }): Destination {
  return {
    category: 'farm',
    zone: '',
    aliases: [],
    tags: [],
    image: null,
    sortOrder: 0,
    enabled: true,
    twoStep: false,
    command2: '',
    ...partial,
  };
}

describe('parsePaletteQuery : position en fin de requête', () => {
  it.each([
    ['farm tremble 2 2', 'farm tremble', { x: 2, y: 2 }],
    ['farm tremble 2,2', 'farm tremble', { x: 2, y: 2 }],
    ['farm tremble 2, 2', 'farm tremble', { x: 2, y: 2 }],
    ['farm tremble 2;2', 'farm tremble', { x: 2, y: 2 }],
    ['farm tremble 1-1', 'farm tremble', { x: 1, y: 1 }],
    ['farm tremble -3 7', 'farm tremble', { x: -3, y: 7 }],
    ['farm tremble 4,-2', 'farm tremble', { x: 4, y: -2 }],
    ['farm tremble 1 -1', 'farm tremble', { x: 1, y: -1 }],
    ['2 2', '', { x: 2, y: 2 }],
    ['-3 7', '', { x: -3, y: 7 }],
  ])('%s', (query, text, position) => {
    expect(parsePaletteQuery(query)).toEqual({ text, position });
  });

  it('un seul nombre (saisie en cours) : abscisse seule', () => {
    expect(parsePaletteQuery('farm tremble 2')).toEqual({ text: 'farm tremble', position: { x: 2 } });
    expect(parsePaletteQuery('farm tremble 2,')).toEqual({ text: 'farm tremble', position: { x: 2 } });
    expect(parsePaletteQuery('farm tremble 2-')).toEqual({ text: 'farm tremble', position: { x: 2 } });
  });

  it('aucun nombre', () => {
    expect(parsePaletteQuery('  farm tremble ')).toEqual({ text: 'farm tremble', position: null });
    expect(parsePaletteQuery('')).toEqual({ text: '', position: null });
  });

  it('nombres au milieu de la requête : ignorés', () => {
    expect(parsePaletteQuery('zone 2 tremble')).toEqual({ text: 'zone 2 tremble', position: null });
    expect(parsePaletteQuery('3 4 tremble')).toEqual({ text: '3 4 tremble', position: null });
  });

  it('chiffres collés à un mot : pas une position', () => {
    expect(parsePaletteQuery('zone2')).toEqual({ text: 'zone2', position: null });
  });

  it('trois nombres : les deux derniers forment la position', () => {
    expect(parsePaletteQuery('tremble 1 2 3')).toEqual({ text: 'tremble 1', position: { x: 2, y: 3 } });
  });

  it('nombre hors des bornes d\'une coordonnée : pas une position, la requête reste du texte', () => {
    const over = MAX_COORDINATE + 1;
    expect(parsePaletteQuery(`tremble ${MAX_COORDINATE} -${MAX_COORDINATE}`)).toEqual({
      text: 'tremble',
      position: { x: MAX_COORDINATE, y: -MAX_COORDINATE },
    });
    expect(parsePaletteQuery(`tremble 2 ${over}`)).toEqual({ text: `tremble 2 ${over}`, position: null });
    expect(parsePaletteQuery(`tremble -${over} 2`)).toEqual({ text: `tremble -${over} 2`, position: null });
    expect(parsePaletteQuery(`tremble ${over}`)).toEqual({ text: `tremble ${over}`, position: null });
    expect(parsePaletteQuery('tremble 12345678901234567890 1')).toMatchObject({ position: null });
  });

  it('formatPosition', () => {
    expect(formatPosition({ x: 2, y: -2 })).toBe('2,-2');
    expect(formatPosition({ x: 2 })).toBe('2');
  });
});

describe('lignes Farm', () => {
  const tremble = farm({
    id: 'tremble',
    name: 'Tremble',
    command: '/zaap 9 9;/travel 1 1;/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5',
  });
  const route = parseFarmRoute(tremble.command);

  it('parcours complet puis chaque position, dans l\'ordre', () => {
    const lines = routeEntries(tremble, route, true);
    expect(lines.map((l) => l.kind)).toEqual(['farm-start', ...Array(5).fill('farm-step')]);
    expect(lines.map((l) => l.subtitle)).toEqual([
      'Farm · parcours complet',
      'Farm · je suis en 1,1 (étape 1/5)',
      'Farm · je suis en 2,2 (étape 2/5)',
      'Farm · je suis en 3,3 (étape 3/5)',
      'Farm · je suis en 4,4 (étape 4/5)',
      'Farm · je suis en 5,5 (étape 5/5) · fin de parcours',
    ]);
    expect(routeEntries(tremble, route, false)).toHaveLength(1);
  });

  it('parcours complet avec Zaap ; reprises sans Zaap ; textes exacts des fonctions Farm', () => {
    const [start, first] = routeEntries(tremble, route, true);
    expect(start!.variants).toEqual([
      { kind: 'route', text: farmStartCommand(route) },
    ]);
    expect(start!.variants[0]?.text).toBe(tremble.command);
    expect(first!.variants[0]?.text).toBe('/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5');
    expect(first!.variants[0]?.text).not.toContain('/zaap');
  });

  it('dernière étape : rien à copier', () => {
    const last = farmStepEntry(tremble, route, 4, false);
    expect(last.variants).toEqual([]);
  });

  it('position : la commande est exactement farmResumeCommand(route, i)', () => {
    const lines = positionEntries(tremble, route, { x: 2, y: 2 });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.variants[0]?.text).toBe(farmResumeCommand(route, 1));
    expect(lines[0]!.variants[0]?.text).toBe('/travel 3 3;/travel 4 4;/travel 5 5');
  });

  it('position absente : aucune ligne', () => {
    expect(positionEntries(tremble, route, { x: 9, y: 9 })).toEqual([]);
  });

  it('position répétée : une ligne par occurrence, première en tête, commandes différentes', () => {
    const loop = farm({ id: 'boucle', name: 'Boucle', command: '/travel 1 1;/travel 2 2;/travel 1 1;/travel 3 3' });
    const r = parseFarmRoute(loop.command);
    const lines = positionEntries(loop, r, { x: 1, y: 1 });
    expect(lines.map((l) => l.subtitle)).toEqual([
      'Farm · je suis en 1,1 (étape 1/4)',
      'Farm · je suis en 1,1 (étape 3/4)',
    ]);
    expect(lines.map((l) => l.variants[0]?.text)).toEqual(['/travel 2 2;/travel 1 1;/travel 3 3', '/travel 3 3']);
    expect(new Set(lines.map((l) => l.key)).size).toBe(2);
  });

  it('abscisse seule : toutes les étapes de cette abscisse', () => {
    const r = parseFarmRoute('/travel 2 1;/travel 3 3;/travel 2 5');
    expect(stepsAtPosition(r, { x: 2 }).map((s) => s.index)).toEqual([0, 2]);
  });

  it('segments non reconnus : lignes conservées, sous-titre « parcours à vérifier »', () => {
    const bad = farm({ id: 'bad', name: 'Mal formé', command: '/travel 1 1;texte libre;/travel 2 2' });
    const r = parseFarmRoute(bad.command);
    const lines = routeEntries(bad, r, true);
    expect(lines).toHaveLength(3);
    expect(lines.every((l) => l.subtitle.endsWith('parcours à vérifier'))).toBe(true);
    expect(lines[1]!.variants[0]?.text).toBe(farmResumeCommand(r, 0));
  });

  it('zone dans le sous-titre ; clés JSON distinctes', () => {
    const z = farm({ id: 'a"b', name: 'Tremble', zone: 'Bois fictif', command: '/travel 1 1;/travel 2 2' });
    const r = parseFarmRoute(z.command);
    const lines = routeEntries(z, r, true);
    expect(lines[0]!.subtitle).toBe('Farm · Bois fictif · parcours complet');
    expect(lines.map((l) => JSON.parse(l.key))).toEqual([
      ['a"b', 'farm-start'],
      ['a"b', 'farm-step', 0],
      ['a"b', 'farm-step', 1],
    ]);
  });
});
