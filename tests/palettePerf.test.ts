import { describe, expect, it, vi } from 'vitest';
import { buildDictionary } from '../src/features/aliases/aliases';
import type { Destination } from '../src/features/catalog/schema';
import { cardParts } from '../src/features/commands/cardParts';
import { parseFarmRoute } from '../src/features/farm/farmRoute';
import { buildPaletteIndex, PALETTE_LIMIT, searchPalette } from '../src/features/palette/entries';

// Compte les analyses de parcours et les découpes de cartes sans changer leur comportement.
// Les compteurs vérifient le travail fait ; les temps ne servent que de filet très large (une
// machine chargée, en CI, peut être dix fois plus lente sans que rien ne soit faux).
vi.mock('../src/features/farm/farmRoute', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/farm/farmRoute')>();
  return { ...actual, parseFarmRoute: vi.fn(actual.parseFarmRoute) };
});
vi.mock('../src/features/commands/cardParts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/commands/cardParts')>();
  return { ...actual, cardParts: vi.fn(actual.cardParts) };
});

/** Filet de sécurité : un ordre de grandeur au-dessus du temps mesuré (quelques ms). */
const SAFETY_NET_MS = 500;

// Coordonnées fictives uniquement.
function dest(i: number, partial: Partial<Destination>): Destination {
  return {
    id: `d${i}`,
    name: `Destination ${i}`,
    category: 'place',
    zone: `Zone fictive ${i % 40}`,
    aliases: [],
    tags: [],
    image: null,
    command: `/zaap 1 1;/travel ${i % 30} ${i % 17}`,
    sortOrder: 0,
    enabled: true,
    twoStep: false,
    command2: '',
    ...partial,
  };
}

function timed<T>(run: () => T): { value: T; elapsed: number } {
  const t = performance.now();
  const value = run();
  return { value, elapsed: performance.now() - t };
}

describe('performance de la palette', () => {
  it('5 000 destinations dont 200 parcours de 50 étapes : parcours analysés une fois, jamais pendant la frappe', () => {
    const route = Array.from({ length: 50 }, (_, s) => `/travel ${s} ${-s}`).join(';');
    const list = Array.from({ length: 5000 }, (_, i) =>
      i < 200 ? dest(i, { name: `Parcours ${i}`, category: 'farm', command: route }) : dest(i, {}),
    );
    const parse = vi.mocked(parseFarmRoute);
    parse.mockClear();
    const index = buildPaletteIndex(list);
    expect(parse).toHaveBeenCalledTimes(200);
    parse.mockClear();

    const favorites = new Set(['d3']);
    const queries = ['', 'd', 'des', 'destination 4', 'parcours 12', 'parcours 12 7 -7', 'farm 3', 'zone fictive 1'];
    for (const q of queries) {
      const { value, elapsed } = timed(() => searchPalette(index, q, { limit: PALETTE_LIMIT, favorites }));
      expect(value.entries.length).toBeLessThanOrEqual(PALETTE_LIMIT);
      expect(elapsed, `requête « ${q} »`).toBeLessThan(SAFETY_NET_MS);
    }
    expect(parse).not.toHaveBeenCalled();
  });

  it('lignes fabriquées jusqu\'au plafond seulement, puis réutilisées', () => {
    // Une lettre trouve tout le catalogue : seules les lignes affichées sont fabriquées.
    const list = Array.from({ length: 6000 }, (_, i) =>
      dest(i, { category: i % 3 === 0 ? 'npc' : 'place', twoStep: i % 3 === 0, command2: '/travel 1 1' }),
    );
    const index = buildPaletteIndex(list);
    const parts = vi.mocked(cardParts);
    parts.mockClear();
    const first = searchPalette(index, 'd', { limit: PALETTE_LIMIT });
    expect(first.entries).toHaveLength(PALETTE_LIMIT);
    expect(parts.mock.calls.length).toBeGreaterThan(0);
    expect(parts.mock.calls.length).toBeLessThanOrEqual(PALETTE_LIMIT);

    // Frappe suivante qui retrouve les mêmes destinations : aucune ligne refabriquée.
    parts.mockClear();
    const next = searchPalette(index, 'de', { limit: PALETTE_LIMIT });
    expect(parts).not.toHaveBeenCalled();
    next.entries.forEach((e, i) => expect(e).toBe(first.entries[i]));
  });

  it('un parcours trouvé seul n\'est déplié que jusqu\'au plafond', () => {
    const route = Array.from({ length: 400 }, (_, s) => `/travel ${s % 90} ${-(s % 90)}`).join(';');
    const index = buildPaletteIndex([dest(1, { name: 'Long parcours', category: 'farm', command: route })]);
    const { entries } = searchPalette(index, 'long parcours', { limit: PALETTE_LIMIT });
    expect(entries).toHaveLength(PALETTE_LIMIT);
    expect(index.cache.size).toBe(PALETTE_LIMIT);
  });

  it('6 500 destinations (catalogue visé par l\'issue n°8) : index construit une fois, alias et fautes compris', () => {
    // Vocabulaire varié : chaque destination a un mot propre, comme un vrai catalogue.
    const kinds = ['Hôtel des ventes', 'Atelier des bijoutiers', 'Donjon', 'Zaap', 'Comptoir'];
    const list = Array.from({ length: 6500 }, (_, i) =>
      dest(i, { name: `${kinds[i % kinds.length]} de Ville${i} fictive`, category: i % 5 === 2 ? 'dungeon' : 'place' }),
    );
    const dictionary = buildDictionary([{ term: 'hdv', expansions: ['hôtel des ventes'] }], {
      custom: [],
      disabledDefaults: [],
    });

    const built = timed(() => buildPaletteIndex(list, dictionary));
    expect(built.elapsed, 'construction de l\'index').toBeLessThan(10 * SAFETY_NET_MS);
    const index = built.value;
    const favorites = new Set(['d3']);
    const parts = vi.mocked(cardParts);

    // Frappe progressive, comme au clavier : chaque requête ne recalcule que son dernier mot.
    const typed = ['h', 'hd', 'hdv', 'hdv ', 'hdv v', 'hdv vi', 'hdv ville12', 'bijoutier ville4', 'donjon', 'vilel123', ''];
    for (const q of typed) {
      parts.mockClear();
      const { value, elapsed } = timed(() => searchPalette(index, q, { limit: PALETTE_LIMIT, favorites }));
      expect(value.entries.length).toBeLessThanOrEqual(PALETTE_LIMIT);
      expect(parts.mock.calls.length, `requête « ${q} »`).toBeLessThanOrEqual(PALETTE_LIMIT);
      expect(elapsed, `requête « ${q} »`).toBeLessThan(SAFETY_NET_MS);
    }
    const run = (q: string) => searchPalette(index, q, { limit: PALETTE_LIMIT }).entries;
    expect(run('hdv ville12').map((e) => e.title)).toContain('Hôtel des ventes de Ville120 fictive');
    // Faute de frappe : trouvée en seconde passe.
    expect(run('vilel123').length).toBeGreaterThan(0);
  });
});

describe('alias exact sur un gros catalogue (issue n°24)', () => {
  it('10 000 destinations, deux alias chacune : l\'alias exact est au rang 1, sur toutes les requêtes essayées', () => {
    // Chaque fiche a un alias court propre (« k2s ») qui commence aussi les alias d'autres
    // fiches (« k2s » est le début de « k2s0 »…), et un alias de deux mots partagé en partie.
    const list = Array.from({ length: 10_000 }, (_, i) =>
      dest(i, { name: `Lieu ${i % 7} de Ville${i}`, aliases: [`k${i.toString(36)}`, `porte ville${i}`] }),
    );
    list.push(dest(10_000, { id: 'reine', name: 'Reine des Voleurs', aliases: ['RDV'] }));
    const dictionary = buildDictionary([{ term: 'rdv', expansions: ['reine des voleurs'] }], {
      custom: [],
      disabledDefaults: [],
    });
    const index = buildPaletteIndex(list, dictionary);
    const first = (q: string) => searchPalette(index, q, { limit: PALETTE_LIMIT }).entries[0]?.destinationId;
    expect(first('rdv')).toBe('reine');
    expect(first('RDV')).toBe('reine');
    for (const i of [0, 1, 35, 36, 1295, 1296, 9999]) {
      const { value, elapsed } = timed(() => first(`k${i.toString(36)}`));
      expect(value, `alias k${i.toString(36)}`).toBe(`d${i}`);
      expect(elapsed).toBeLessThan(SAFETY_NET_MS);
    }
    expect(first('porte ville42')).toBe('d42');
  });
});
