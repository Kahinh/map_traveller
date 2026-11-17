import { describe, expect, it } from 'vitest';
import { buildDictionary } from '../src/features/aliases/aliases';
import type { Destination } from '../src/features/catalog/schema';
import { farmResumeCommand, parseFarmRoute } from '../src/features/farm/farmRoute';
import {
  buildPaletteIndex,
  cardEntries,
  PALETTE_LIMIT,
  searchPalette,
  STEP_NAMES,
  type PaletteEntry,
} from '../src/features/palette/entries';

// Coordonnées fictives uniquement.
function dest(partial: Partial<Destination> & { id: string; name: string }): Destination {
  return {
    category: 'place',
    zone: '',
    aliases: [],
    tags: [],
    image: null,
    command: '/travel 0 0',
    sortOrder: 0,
    enabled: true,
    twoStep: false,
    command2: '',
    ...partial,
  };
}

const TREMBLE = '/zaap 9 9;/travel 1 1;/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5';

const search = (list: Destination[], query: string, favorites: string[] = [], limit = PALETTE_LIMIT) =>
  searchPalette(buildPaletteIndex(list, new Set(favorites)), query, limit);
const subtitles = (entries: PaletteEntry[]) => entries.map((e) => `${e.title} | ${e.subtitle}`);

describe('cartes dans la palette', () => {
  it('carte avec Zaap : deux variantes, sans Zaap d\'abord par défaut, textes exacts', () => {
    const [e, ...rest] = cardEntries(dest({ id: 'a', name: 'A', command: '/zaap 1 2;/travel 3 4;/travel 5 6' }), false);
    expect(rest).toEqual([]);
    expect(e!.kind).toBe('card');
    expect(e!.step).toBeNull();
    expect(e!.key).toBe(JSON.stringify(['a', 'card']));
    expect(e!.variants).toEqual([
      { kind: 'withoutZaap', text: '/travel 3 4;/travel 5 6' },
      { kind: 'withZaap', text: '/zaap 1 2;/travel 3 4;/travel 5 6' },
    ]);
  });

  it('préférence « avec Zaap » : ordre inversé, textes inchangés', () => {
    const [e] = cardEntries(dest({ id: 'a', name: 'A', command: '/zaap 1 2;/travel 3 4' }), false, 'withZaap');
    expect(e!.variants.map((v) => v.kind)).toEqual(['withZaap', 'withoutZaap']);
    expect(e!.variants[0]!.text).toBe('/zaap 1 2;/travel 3 4');
  });

  it('carte sans Zaap : une seule variante, texte intact octet pour octet', () => {
    const command = '/travel  3 , 4 ;/travel 5 6';
    for (const pref of ['withoutZaap', 'withZaap'] as const) {
      const [e] = cardEntries(dest({ id: 'a', name: 'A', command }), false, pref);
      expect(e!.variants).toEqual([{ kind: 'withoutZaap', text: command }]);
    }
  });

  it('carte à deux étapes : DEUX lignes, dans l\'ordre, variantes propres à chaque étape', () => {
    const d = dest({
      id: 'dj',
      name: 'Antre fictive',
      category: 'dungeon',
      zone: 'Zone fictive',
      twoStep: true,
      command: '/zaap 5 -18;/travel 1 1',
      command2: '/travel 2 2;/travel 3 3',
    });
    const { entries } = search([d], 'antre');
    expect(entries.map((e) => e.key)).toEqual([
      JSON.stringify(['dj', 'card', 1]),
      JSON.stringify(['dj', 'card', 2]),
    ]);
    expect(entries.map((e) => e.title)).toEqual(['Antre fictive', 'Antre fictive']);
    expect(entries.map((e) => e.step)).toEqual([
      { index: 1, count: 2 },
      { index: 2, count: 2 },
    ]);
    expect(entries.map((e) => e.subtitle)).toEqual(['Donjons · Zone fictive · accès', 'Donjons · Zone fictive · sur place']);
    expect(entries[0]!.variants).toEqual([
      { kind: 'withoutZaap', text: '/travel 1 1' },
      { kind: 'withZaap', text: '/zaap 5 -18;/travel 1 1' },
    ]);
    // Étape 2 sans Zaap : une seule variante, donc aucune case.
    expect(entries[1]!.variants).toEqual([{ kind: 'withoutZaap', text: '/travel 2 2;/travel 3 3' }]);
    expect(STEP_NAMES).toEqual({ 1: 'accès', 2: 'sur place' });
  });

  it('étapes contiguës même entourées d\'autres résultats', () => {
    const list = [
      dest({ id: 'x', name: 'Temple ancien', command: '/travel 1 1' }),
      dest({ id: 't', name: 'Temple en deux temps', category: 'npc', twoStep: true, command: '/travel 2 2', command2: '/travel 3 3' }),
    ];
    const keys = search(list, 'temple').entries.map((e) => e.key);
    const i = keys.indexOf(JSON.stringify(['t', 'card', 1]));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(keys[i + 1]).toBe(JSON.stringify(['t', 'card', 2]));
  });

  it('deux étapes cochées hors PNJ / Donjons : une seule ligne', () => {
    const entries = cardEntries(dest({ id: 'p', name: 'P', twoStep: true, command2: '/travel 8 8' }), false);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.step).toBeNull();
  });

  it('commande vide : aucune variante ; Zaap seul : une variante, la commande complète', () => {
    const [e] = cardEntries(dest({ id: 'v', name: 'Vide', command: '   ' }), false);
    expect(e!.variants).toEqual([]);
    const [zaapOnly] = cardEntries(dest({ id: 'z', name: 'Zaap seul', command: '/zaap 1 1' }), false);
    expect(zaapOnly!.variants).toEqual([{ kind: 'withZaap', text: '/zaap 1 1' }]);
  });

  it('étape 2 vide : ligne présente, rien à copier', () => {
    const d = dest({ id: 'd', name: 'D', category: 'npc', twoStep: true, command: '/travel 1 1', command2: '' });
    const entries = cardEntries(d, false);
    expect(entries).toHaveLength(2);
    expect(entries[1]!.variants).toEqual([]);
  });

  it('préférence de l\'index appliquée à la recherche', () => {
    const list = [dest({ id: 'a', name: 'Alpha', command: '/zaap 1 2;/travel 3 4' })];
    const index = buildPaletteIndex(list, new Set(), undefined, undefined, 'withZaap');
    expect(searchPalette(index, 'alpha', PALETTE_LIMIT).entries[0]!.variants[0]!.kind).toBe('withZaap');
  });

  it('destination désactivée absente', () => {
    const list = [dest({ id: 'on', name: 'Visible' }), dest({ id: 'off', name: 'Visible aussi', enabled: false })];
    expect(search(list, 'visible').entries.map((e) => e.destinationId)).toEqual(['on']);
    expect(search(list, '').entries.map((e) => e.destinationId)).toEqual(['on']);
  });

  it('deux destinations de même nom : deux lignes, clés différentes, zones distinctes', () => {
    const list = [
      dest({ id: 'a', name: 'Pont', zone: 'Nord fictif' }),
      dest({ id: 'b', name: 'Pont', zone: 'Sud fictif' }),
    ];
    const { entries } = search(list, 'pont');
    expect(entries).toHaveLength(2);
    expect(entries[0]!.key).not.toBe(entries[1]!.key);
    expect(entries.map((e) => e.subtitle)).toEqual(['Lieux-dits · Nord fictif', 'Lieux-dits · Sud fictif']);
  });

  it('nom contenant des chiffres (« Zone 2 ») : trouvé par « zone 2 »', () => {
    const list = [dest({ id: 'z2', name: 'Zone 2' }), dest({ id: 'z10', name: 'Zone 10' })];
    expect(search(list, 'zone 2').entries.map((e) => e.destinationId)).toEqual(['z2']);
  });

  it('requête vide : favoris d\'abord, limite respectée', () => {
    const list = Array.from({ length: 80 }, (_, i) => dest({ id: `d${i}`, name: `Lieu ${i}`, sortOrder: i }));
    const { entries } = search(list, '', ['d70', 'd5']);
    expect(entries).toHaveLength(PALETTE_LIMIT);
    expect(entries.slice(0, 3).map((e) => e.destinationId)).toEqual(['d5', 'd70', 'd0']);
    expect(entries.slice(0, 2).every((e) => e.favorite)).toBe(true);
    expect(search(list, 'lieu', [], 7).entries).toHaveLength(7);
    expect(search(list, 'lieu', [], 0).entries).toEqual([]);
  });

  it('recherche sans accents ni casse, plusieurs mots en ET', () => {
    const list = [dest({ id: 'm', name: 'Mériana', zone: 'Île fictive' }), dest({ id: 'v', name: 'Vortex' })];
    expect(search(list, 'MERIANA').entries.map((e) => e.destinationId)).toEqual(['m']);
    expect(search(list, 'ile meri').entries.map((e) => e.destinationId)).toEqual(['m']);
    expect(search(list, 'ile vortex').entries).toEqual([]);
  });
});

describe('parcours Farm dans la palette', () => {
  const tremble = dest({ id: 'tremble', name: 'Tremble', category: 'farm', command: TREMBLE });
  const other = dest({ id: 'chene', name: 'Chêne', category: 'farm', command: '/travel 2 2;/travel 6 6' });
  const card = dest({ id: 'pnj', name: 'Garde fictif', category: 'npc', command: '/travel 2 2' });

  it('« farm tremble » : parcours complet puis toutes les positions, dans l\'ordre', () => {
    const { entries, notice } = search([tremble, other, card], 'farm tremble');
    expect(notice).toBeNull();
    expect(subtitles(entries)).toEqual([
      'Tremble | Farm · parcours complet',
      'Tremble | Farm · je suis en 1,1 (étape 1/5)',
      'Tremble | Farm · je suis en 2,2 (étape 2/5)',
      'Tremble | Farm · je suis en 3,3 (étape 3/5)',
      'Tremble | Farm · je suis en 4,4 (étape 4/5)',
      'Tremble | Farm · je suis en 5,5 (étape 5/5) · fin de parcours',
    ]);
  });

  it('plusieurs parcours sans position : une ligne « parcours complet » par parcours', () => {
    const { entries } = search([tremble, other, card], 'farm');
    expect(subtitles(entries)).toEqual(['Chêne | Farm · parcours complet', 'Tremble | Farm · parcours complet']);
  });

  it('requête vide : parcours non dépliés', () => {
    const { entries } = search([tremble], '');
    expect(entries.map((e) => e.kind)).toEqual(['farm-start']);
  });

  it('« farm tremble 2 2 » : la reprise en premier, commande exacte', () => {
    const { entries, notice } = search([tremble, other, card], 'farm tremble 2 2');
    expect(notice).toBeNull();
    expect(entries[0]!.subtitle).toBe('Farm · je suis en 2,2 (étape 2/5)');
    expect(entries[0]!.variants[0]?.text ?? null).toBe(farmResumeCommand(parseFarmRoute(TREMBLE), 1));
    expect(entries[0]!.variants[0]?.text ?? null).toBe('/travel 3 3;/travel 4 4;/travel 5 5');
    // Seule l'étape à cette position : pas d'autres étapes ni d'autres parcours.
    expect(entries).toHaveLength(1);
  });

  it('écritures de la position équivalentes', () => {
    for (const q of ['tremble 2,2', 'tremble 2;2', 'tremble 2-2']) {
      expect(search([tremble], q).entries[0]!.subtitle).toBe('Farm · je suis en 2,2 (étape 2/5)');
    }
  });

  it('« farm tremble 2 » : positions dont l\'abscisse vaut 2', () => {
    const route = dest({ id: 'r', name: 'Tremble', category: 'farm', command: '/travel 2 1;/travel 3 3;/travel 2 5' });
    const { entries } = search([route], 'farm tremble 2');
    expect(entries.map((e) => e.subtitle)).toEqual([
      'Farm · je suis en 2,1 (étape 1/3)',
      'Farm · je suis en 2,5 (étape 3/3) · fin de parcours',
    ]);
  });

  it('« farm tremble 9 9 » : message, « parcours complet » toujours proposé', () => {
    const { entries, notice } = search([tremble], 'farm tremble 9 9');
    expect(notice).toBe('Position 9,9 absente du parcours');
    expect(entries.map((e) => e.kind)).toEqual(['farm-start']);
    expect(entries[0]!.variants[0]?.text ?? null).toBe(TREMBLE);
  });

  it('position répétée : une ligne par occurrence, première en tête', () => {
    const loop = dest({
      id: 'boucle',
      name: 'Boucle',
      category: 'farm',
      command: '/travel 1 1;/travel 2 2;/travel 1 1;/travel 3 3',
    });
    const { entries } = search([loop], 'boucle 1 1');
    expect(entries.map((e) => e.variants[0]?.text ?? null)).toEqual(['/travel 2 2;/travel 1 1;/travel 3 3', '/travel 3 3']);
  });

  it('dernière étape tapée : ligne sans rien à copier', () => {
    const { entries } = search([tremble], 'tremble 5 5');
    expect(entries[0]!.variants[0]?.text ?? null).toBeNull();
  });

  it('nom avec chiffres et parcours : les deux interprétations sont fusionnées', () => {
    const zone2 = dest({ id: 'z2', name: 'Zone 2', category: 'place' });
    const zoneFarm = dest({ id: 'zf', name: 'Zone boisée', category: 'farm', command: '/travel 2 4;/travel 5 5' });
    const { entries, notice } = search([zone2, zoneFarm], 'zone 2');
    // (a) l'étape d'abscisse 2 du parcours passe en tête, (b) la carte « Zone 2 » reste trouvée.
    expect(entries.map((e) => e.key)).toEqual([
      JSON.stringify(['zf', 'farm-step', 0]),
      JSON.stringify(['z2', 'card']),
    ]);
    expect(notice).toBeNull();
  });

  it('favori : marqué sur ses lignes', () => {
    const { entries } = search([tremble], 'tremble', ['tremble']);
    expect(entries.every((e) => e.favorite)).toBe(true);
  });
});

describe('recherche tolérante dans la palette (issue n°10)', () => {
  const dictionary = buildDictionary([{ term: 'hdv', expansions: ['hôtel des ventes'] }], {
    custom: [],
    disabledDefaults: [],
  });
  const list = [
    dest({ id: 'hb', name: 'Hôtel des ventes de Bonta', command: '/zaap 1 1;/travel 2 2' }),
    dest({ id: 'hk', name: 'Hôtel des ventes de Brâkmar', command: '/travel 3 3' }),
    dest({ id: 'meu', name: 'Donjon du Meulou', category: 'dungeon', command: '/travel 4 4' }),
    dest({ id: 'tremble', name: 'Tremble', category: 'farm', command: TREMBLE }),
  ];
  const titles = (query: string) =>
    searchPalette(buildPaletteIndex(list, new Set(), dictionary), query, PALETTE_LIMIT).entries.map((e) => e.title);

  it('alias du dictionnaire : toutes les destinations concernées, puis affinage', () => {
    expect(titles('HDV')).toEqual(['Hôtel des ventes de Bonta', 'Hôtel des ventes de Brâkmar']);
    expect(titles('hdv brakmar')).toEqual(['Hôtel des ventes de Brâkmar']);
  });

  it('les commandes copiées ne changent pas : texte brut, mêmes règles', () => {
    const [entry] = searchPalette(buildPaletteIndex(list, new Set(), dictionary), 'hdv bonta', PALETTE_LIMIT).entries;
    expect(entry?.variants).toEqual([
      { kind: 'withoutZaap', text: '/travel 2 2' },
      { kind: 'withZaap', text: '/zaap 1 1;/travel 2 2' },
    ]);
  });

  it('faute de frappe et mots de liaison', () => {
    expect(titles('melou donjon')).toEqual(['Donjon du Meulou']);
    expect(titles('donjon de la meulou')).toEqual(['Donjon du Meulou']);
  });

  it('parcours Farm avec une faute et une position : la reprise reste trouvée par indice', () => {
    const { entries } = searchPalette(buildPaletteIndex(list, new Set(), dictionary), 'farm tremle 2 2', PALETTE_LIMIT);
    expect(entries[0]?.kind).toBe('farm-step');
    expect(entries[0]?.variants[0]?.text).toBe('/travel 3 3;/travel 4 4;/travel 5 5');
  });

  it('un PNJ au nom proche n\'empêche pas de retrouver le parcours à une faute près', () => {
    const withNpc = [...list, dest({ id: 'pnj', name: 'Tremlbe garde', category: 'npc', command: '/travel 9 9' })];
    const { entries } = searchPalette(buildPaletteIndex(withNpc, new Set(), dictionary), 'tremlbe 2 2', PALETTE_LIMIT);
    expect(entries[0]?.kind).toBe('farm-step');
    expect(entries[0]?.variants[0]?.text).toBe('/travel 3 3;/travel 4 4;/travel 5 5');
  });

  it('favoris fournis à la recherche : l\'index n\'a pas à être reconstruit quand ils changent', () => {
    const index = buildPaletteIndex(list, new Set(), dictionary);
    expect(searchPalette(index, '', PALETTE_LIMIT).entries[0]?.favorite).toBe(false);
    const withFav = searchPalette(index, '', PALETTE_LIMIT, new Set(['meu'])).entries;
    expect(withFav[0]).toMatchObject({ title: 'Donjon du Meulou', favorite: true });
  });

  it('sans dictionnaire, la palette se comporte comme avant', () => {
    expect(searchPalette(buildPaletteIndex(list, new Set()), 'hdv', PALETTE_LIMIT).entries).toEqual([]);
  });
});
