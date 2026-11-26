import { describe, expect, it } from 'vitest';
import raw from '../resources/zaaps.json';
import { buildPaletteIndex, searchPalette, PALETTE_LIMIT } from '../src/features/palette/entries';
import { DEFAULT_ZAAPS } from '../src/features/zaaps/defaultZaaps';
import {
  formatDistance,
  mapDistance,
  nearestZaaps,
  parseNearQuery,
  parseZaapCatalog,
  zaapTripCommand,
  type Zaap,
  type ZaapCatalog,
  type ZaapWorld,
} from '../src/features/zaaps/zaaps';
import { makeDestination } from './helpers/destination';

// Référentiel de test : coordonnées FICTIVES (le référentiel livré est contrôlé à part).
const WORLDS: ZaapWorld[] = [
  { id: 'douze', name: 'Monde des Douze', aliases: ['douze'] },
  { id: 'incarnam', name: 'Incarnam', aliases: ['incarnam'] },
];
const z = (id: string, name: string, x: number, y: number, world = 'douze'): Zaap => ({
  id,
  name,
  zone: 'Zone',
  world,
  x,
  y,
  command: `/zaap ${x} ${y}`,
});
const ZAAPS: Zaap[] = [
  z('z-a', 'Alpha', 0, 0),
  z('z-b', 'Bravo', 10, 0),
  z('z-c', 'Charlie', 0, 10),
  z('z-d', 'Delta', -5, -5),
  z('z-i', 'Inca', 1, 1, 'incarnam'),
];
const CATALOG: ZaapCatalog = { source: 'test', worlds: WORLDS, zaaps: ZAAPS };

describe('référentiel livré resources/zaaps.json', () => {
  it('est valide, sans identifiant en double ni position en double dans un monde', () => {
    const r = parseZaapCatalog(raw);
    expect(r.ok ? [] : r.errors).toEqual([]);
    expect(DEFAULT_ZAAPS.zaaps.length).toBe(48);
    const positions = DEFAULT_ZAAPS.zaaps.map((x) => `${x.world}:${x.x},${x.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('chaque commande rejoint les coordonnées de son zaap', () => {
    for (const zaap of DEFAULT_ZAAPS.zaaps) expect(zaap.command).toBe(`/zaap ${zaap.x} ${zaap.y}`);
  });

  it('les zaaps d’Incarnam ne sont pas dans le Monde des Douze', () => {
    const incarnam = DEFAULT_ZAAPS.zaaps.filter((x) => x.zone === 'Incarnam');
    expect(incarnam.length).toBeGreaterThan(0);
    expect(incarnam.every((x) => x.world === 'incarnam')).toBe(true);
  });

  it('cite sa source', () => {
    expect(DEFAULT_ZAAPS.source).toMatch(/https:\/\//);
  });
});

describe('parseZaapCatalog', () => {
  it('refuse une entrée incomplète, un monde inconnu, un doublon', () => {
    const r = parseZaapCatalog({
      schemaVersion: 1,
      worlds: WORLDS,
      zaaps: [
        { ...ZAAPS[0] },
        { ...ZAAPS[0] },
        { ...ZAAPS[1], world: 'lune' },
        { ...ZAAPS[2], x: 1.5 },
        { id: 'x' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(4);
  });

  it('refuse une version inconnue', () => {
    expect(parseZaapCatalog({ schemaVersion: 2, worlds: [], zaaps: [] }).ok).toBe(false);
  });
});

describe('distance (Manhattan, en cartes)', () => {
  it('somme des écarts horizontal et vertical', () => {
    expect(mapDistance({ x: -20, y: -20 }, { x: -17, y: -24 })).toBe(7);
    expect(mapDistance({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(0);
  });

  it('n’est pas la distance euclidienne : (3,4) est à 7 cartes, pas 5', () => {
    expect(mapDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
  });

  it('libellés', () => {
    expect(formatDistance(0)).toBe('Sur place');
    expect(formatDistance(1)).toBe('À 1 carte');
    expect(formatDistance(12)).toBe('À 12 cartes');
  });
});

describe('nearestZaaps', () => {
  it('classe du plus proche au plus lointain, 3 au plus', () => {
    const r = nearestZaaps(ZAAPS, { x: 8, y: 1 }, 'douze');
    expect(r.map((n) => [n.zaap.id, n.distance])).toEqual([
      ['z-b', 3],
      ['z-a', 9],
      ['z-c', 17],
    ]);
  });

  it('ne compare que les zaaps du monde demandé', () => {
    expect(nearestZaaps(ZAAPS, { x: 1, y: 1 }, 'douze')[0]?.zaap.id).toBe('z-a');
    expect(nearestZaaps(ZAAPS, { x: 1, y: 1 }, 'incarnam').map((n) => n.zaap.id)).toEqual(['z-i']);
    expect(nearestZaaps(ZAAPS, { x: 1, y: 1 }, 'lune')).toEqual([]);
  });

  it('départage les ex aequo par nom puis identifiant, quel que soit l’ordre du référentiel', () => {
    const tie = [z('z-2', 'Bêta', 2, 0), z('z-3', 'beta', -2, 0), z('z-1', 'Alpha', 0, 2)];
    const ids = (list: Zaap[]) => nearestZaaps(list, { x: 0, y: 0 }, 'douze').map((n) => n.zaap.id);
    expect(ids(tie)).toEqual(['z-1', 'z-2', 'z-3']);
    expect(ids([...tie].reverse())).toEqual(['z-1', 'z-2', 'z-3']);
  });

  it('ne modifie pas le référentiel', () => {
    const copy = ZAAPS.map((x) => ({ ...x }));
    nearestZaaps(ZAAPS, { x: 0, y: 0 }, 'douze');
    expect(ZAAPS).toEqual(copy);
  });
});

describe('parseNearQuery', () => {
  const ok = (x: number, y: number, world: string | null = null) => ({
    kind: 'ok',
    position: { x, y },
    world: world === null ? null : WORLDS.find((w) => w.id === world),
  });

  it.each([
    ['proche -20,-20', -20, -20],
    ['proche -20 -20', -20, -20],
    ['proche -20, -20', -20, -20],
    ['proche [-20,-20]', -20, -20],
    ['  Proche   5;-18 ', 5, -18],
    ['PROCHE 0 0', 0, 0],
  ])('%s', (q, x, y) => {
    expect(parseNearQuery(q, WORLDS)).toEqual(ok(x, y));
  });

  it('monde facultatif avant la position, sans accent ni casse', () => {
    expect(parseNearQuery('proche Incarnam 1,-2', WORLDS)).toEqual(ok(1, -2, 'incarnam'));
  });

  it.each(['proche', 'proche ', 'proche -', 'proche -20', 'proche -20,', 'proche -20 -', 'proche incarnam'])(
    'saisie en cours : %s',
    (q) => {
      expect(parseNearQuery(q, WORLDS).kind).toBe('incomplete');
    },
  );

  it.each(['proche -20,-20,3', 'proche lune 1,1', 'proche 1,x', 'proche 1 2 3'])('invalide : %s', (q) => {
    expect(parseNearQuery(q, WORLDS).kind).toBe('invalid');
  });

  it('coordonnées hors de la carte', () => {
    const r = parseNearQuery('proche 5000,1', WORLDS);
    expect(r.kind).toBe('invalid');
  });

  it.each(['prochel', 'bonta', '', 'zaap proche 1,1', 'prochain 1,1', 'proche du lac', 'proche inca'])('pas une recherche de zaap : %s', (q) => {
    expect(parseNearQuery(q, WORLDS).kind).toBe('none');
  });
});

describe('commandes copiées', () => {
  it('trajet complet : zaap puis /travel vers la position', () => {
    expect(zaapTripCommand(ZAAPS[0]!, { x: 2, y: -3 })).toBe('/zaap 0 0;/travel 2 -3');
  });

  it('position sur le zaap : la commande du zaap seule', () => {
    expect(zaapTripCommand(ZAAPS[0]!, { x: 0, y: 0 })).toBe('/zaap 0 0');
  });

  it('la commande du zaap n’est jamais réécrite', () => {
    const odd = { ...ZAAPS[0]!, command: '/zaap  [0,0]' };
    expect(zaapTripCommand(odd, { x: 1, y: 0 })).toBe('/zaap  [0,0];/travel 1 0');
  });
});

describe('palette : « proche X,Y »', () => {
  const dest = makeDestination({ id: 'p', name: 'Proche du lac' });
  const index = buildPaletteIndex([dest], undefined, CATALOG);
  const run = (q: string) => searchPalette(index, q, { limit: PALETTE_LIMIT });

  it('le plus proche en tête, avec ses coordonnées, sa zone et sa distance', () => {
    const { entries, notice } = run('proche 8,1');
    expect(notice).toBeNull();
    expect(entries.map((e) => e.title)).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(entries[0]).toMatchObject({
      kind: 'zaap',
      subtitle: 'À 3 cartes · Zaap 10,0 · Zone',
      // Le zaap seul : aucun /travel vers la position tapée (on ne veut pas y revenir).
      variants: [{ kind: 'zaapOnly', text: '/zaap 10 0' }],
    });
  });

  it('exclusive : aucune destination du catalogue mêlée aux zaaps', () => {
    expect(run('proche 0 0').entries.every((e) => e.kind === 'zaap')).toBe(true);
  });

  it('« proche » suivi de mots : recherche normale (une destination peut s’appeler ainsi)', () => {
    expect(run('proche du lac').entries.map((e) => e.title)).toEqual(['Proche du lac']);
  });

  it('messages : saisie en cours, saisie invalide, monde sans zaap', () => {
    expect(run('proche').notice).toBe('Position attendue : proche -20,-20');
    expect(run('proche 1,x').notice).toMatch(/^Position non reconnue/);
    const noIncarnam = buildPaletteIndex([], undefined, { ...CATALOG, zaaps: ZAAPS.slice(0, 2) });
    expect(searchPalette(noIncarnam, 'proche incarnam 1,1', { limit: PALETTE_LIMIT })).toEqual({
      entries: [],
      notice: 'Aucun zaap répertorié dans Incarnam',
    });
  });

  it('une autre requête reste une recherche normale', () => {
    expect(run('lac').entries.map((e) => e.title)).toEqual(['Proche du lac']);
  });

  it('référentiel livré : proche -20,-20 trouve Routes Rocailleuses sur place', () => {
    const shipped = buildPaletteIndex([], undefined, DEFAULT_ZAAPS);
    const [first] = searchPalette(shipped, 'proche -20,-20', { limit: PALETTE_LIMIT }).entries;
    expect(first?.title).toBe('Routes Rocailleuses');
    expect(first?.variants).toEqual([{ kind: 'zaapOnly', text: '/zaap -20 -20' }]);
  });
});
