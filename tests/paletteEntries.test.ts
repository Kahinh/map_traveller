import { describe, expect, it } from 'vitest';
import type { Destination } from '../src/features/catalog/schema';
import { farmResumeCommand, parseFarmRoute } from '../src/features/farm/farmRoute';
import {
  buildPaletteIndex,
  cardEntry,
  PALETTE_LIMIT,
  searchPalette,
  STEP_HINTS,
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
  it('carte avec Zaap : primary sans Zaap, secondary intégrale', () => {
    const e = cardEntry(dest({ id: 'a', name: 'A', command: '/zaap 1 2;/travel 3 4' }), false);
    expect(e.kind).toBe('card');
    expect(e.choices).toEqual([{ label: '', hint: '', primary: '/travel 3 4', secondary: '/zaap 1 2;/travel 3 4' }]);
  });

  it('carte sans Zaap : primary et secondary identiques, texte intact', () => {
    const command = '/travel  3 , 4 ;/travel 5 6';
    const e = cardEntry(dest({ id: 'a', name: 'A', command }), false);
    expect(e.choices[0]).toMatchObject({ primary: command, secondary: command });
  });

  it('carte à deux étapes : UNE ligne, deux choix explicites, commandes exactes', () => {
    const d = dest({
      id: 'dj',
      name: 'Antre fictive',
      category: 'dungeon',
      zone: 'Zone fictive',
      twoStep: true,
      command: '/zaap 5 -18;/travel 1 1',
      command2: '/zaap 7 7;/travel 2 2;/travel 3 3',
    });
    const { entries } = search([d], 'antre');
    expect(entries).toHaveLength(1);
    const [e] = entries;
    expect(e!.subtitle).toBe('Donjons · Zone fictive');
    expect(e!.choices).toEqual([
      { label: '1', hint: STEP_HINTS[1], primary: '/travel 1 1', secondary: '/zaap 5 -18;/travel 1 1' },
      {
        label: '2',
        hint: STEP_HINTS[2],
        primary: '/travel 2 2;/travel 3 3',
        secondary: '/zaap 7 7;/travel 2 2;/travel 3 3',
      },
    ]);
    expect(STEP_HINTS).toEqual({ 1: 'Étape 1 : accès', 2: 'Étape 2 : sur place' });
  });

  it('deux étapes cochées hors PNJ / Donjons : une seule zone', () => {
    const e = cardEntry(dest({ id: 'p', name: 'P', twoStep: true, command2: '/travel 8 8' }), false);
    expect(e.choices).toHaveLength(1);
  });

  it('commande vide : primary null', () => {
    const e = cardEntry(dest({ id: 'v', name: 'Vide', command: '   ' }), false);
    expect(e.choices[0]).toMatchObject({ primary: null, secondary: null });
    const zaapOnly = cardEntry(dest({ id: 'z', name: 'Zaap seul', command: '/zaap 1 1' }), false);
    expect(zaapOnly.choices[0]).toMatchObject({ primary: null, secondary: '/zaap 1 1' });
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
    expect(entries[0]!.choices[0]!.primary).toBe(farmResumeCommand(parseFarmRoute(TREMBLE), 1));
    expect(entries[0]!.choices[0]!.primary).toBe('/travel 3 3;/travel 4 4;/travel 5 5');
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
    expect(notice).toBe('Position 9,9 absente du parcours.');
    expect(entries.map((e) => e.kind)).toEqual(['farm-start']);
    expect(entries[0]!.choices[0]!.primary).toBe(TREMBLE);
  });

  it('position répétée : une ligne par occurrence, première en tête', () => {
    const loop = dest({
      id: 'boucle',
      name: 'Boucle',
      category: 'farm',
      command: '/travel 1 1;/travel 2 2;/travel 1 1;/travel 3 3',
    });
    const { entries } = search([loop], 'boucle 1 1');
    expect(entries.map((e) => e.choices[0]!.primary)).toEqual(['/travel 2 2;/travel 1 1;/travel 3 3', '/travel 3 3']);
  });

  it('dernière étape tapée : ligne sans rien à copier', () => {
    const { entries } = search([tremble], 'tremble 5 5');
    expect(entries[0]!.choices[0]!.primary).toBeNull();
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
