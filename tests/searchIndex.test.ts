import { describe, expect, it, vi } from 'vitest';
import { buildDictionary, type AliasDictionary, type AliasEntry } from '../src/features/aliases/aliases';
import type { Destination } from '../src/features/catalog/schema';
import { filterDestinations, rankDestinations } from '../src/features/catalog/search';
import { buildSearchIndex, getSearchIndex, searchIndexMatch, searchIndexRank } from '../src/features/catalog/searchIndex';
import * as searchText from '../src/features/catalog/searchText';

// Compte les calculs de distance sans changer leur comportement.
vi.mock('../src/features/catalog/searchText', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/catalog/searchText')>();
  return { ...actual, boundedPrefixDistance: vi.fn(actual.boundedPrefixDistance) };
});

// Noms libres, coordonnées fictives uniquement.
function dest(id: string, name: string, extra: Partial<Destination> = {}): Destination {
  return {
    id,
    name,
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
    ...extra,
  };
}

const catalog = [
  dest('bijoutiers', 'Bonta - Atelier des bijoutiers'),
  dest('meulou', 'Donjon du Meulou', { category: 'dungeon' }),
  dest('reine', 'Donjon Reine des Voleurs', { category: 'dungeon' }),
  dest('hdv-bonta', 'Hôtel des ventes de Bonta'),
  dest('hdv-brakmar', 'Hôtel des ventes de Brâkmar'),
  dest('coeur', 'Cœur immaculé'),
  dest('atelier', "L'atelier d'Astrub"),
];

const DEFAULTS: AliasEntry[] = [
  { term: 'hdv', expansions: ['hôtel des ventes'] },
  { term: 'rdv', expansions: ['reine des voleurs'] },
];
const dictionary = buildDictionary(DEFAULTS, { custom: [], disabledDefaults: [] });

const ids = (list: readonly Destination[]) => list.map((d) => d.id);
const search = (query: string, dict: AliasDictionary = dictionary, list = catalog) =>
  ids(rankDestinations(list, query, new Set(), dict));

describe('critères de l\'issue n°10', () => {
  it('« bijou » retrouve l\'atelier des bijoutiers', () => {
    expect(search('bijou')).toEqual(['bijoutiers']);
  });

  it('« bijoutier bonta » et « bonta bijoutier » : même liste, même ordre', () => {
    expect(search('bijoutier bonta')).toEqual(['bijoutiers']);
    expect(search('bonta bijoutier')).toEqual(search('bijoutier bonta'));
    // Avec plusieurs résultats aussi : le classement ne dépend pas de l'ordre des mots.
    expect(search('ventes hotel')).toEqual(search('hotel ventes'));
    expect(search('hotel ventes')).toHaveLength(2);
  });

  it('« melou donjon » retrouve le Donjon du Meulou, malgré la faute', () => {
    expect(search('melou donjon')).toEqual(['meulou']);
    expect(search('donjon melou')).toEqual(['meulou']);
  });

  it('pendant la frappe, « melo » le trouve déjà', () => {
    expect(search('melo')).toEqual(['meulou']);
  });

  it('« RDV » retrouve la Reine des Voleurs', () => {
    expect(search('RDV')).toEqual(['reine']);
  });

  it('« HDV » propose tous les hôtels des ventes ; « HDV Bonta » affine', () => {
    expect(search('HDV')).toEqual(['hdv-bonta', 'hdv-brakmar']);
    expect(search('HDV Bonta')).toEqual(['hdv-bonta']);
    expect(search('bonta hdv')).toEqual(['hdv-bonta']);
  });

  it('accents et casse ignorés dans la requête comme dans les noms', () => {
    const expected = ['hdv-bonta', 'hdv-brakmar'];
    expect(search('hotel des ventes')).toEqual(expected);
    expect(search('hôtel des ventes')).toEqual(expected);
    expect(search('HOTEL DES VENTES')).toEqual(expected);
    expect(search('brakmar')).toEqual(['hdv-brakmar']);
    expect(search('coeur')).toEqual(['coeur']);
  });

  it('mots de liaison, tirets et apostrophes ignorés', () => {
    expect(search('donjon de meulou')).toEqual(['meulou']);
    expect(search('bonta-atelier')).toEqual(['bijoutiers']);
    // « atelier » n'est le premier mot d'aucun des deux noms : à coût égal, ordre du catalogue (nom).
    expect(search("l'atelier")).toEqual(['bijoutiers', 'atelier']);
    expect(search('atelier de astrub')).toEqual(['atelier']);
  });
});

describe('dictionnaire d\'alias', () => {
  it('sans dictionnaire, un acronyme ne trouve rien', () => {
    expect(search('hdv', new Map())).toEqual([]);
  });

  it('alias désactivé : sans effet', () => {
    const dict = buildDictionary(DEFAULTS, { custom: [], disabledDefaults: ['hdv'] });
    expect(search('hdv', dict)).toEqual([]);
    expect(search('rdv', dict)).toEqual(['reine']);
  });

  it('alias personnalisé : remplace l\'alias livré du même terme', () => {
    const dict = buildDictionary(DEFAULTS, {
      custom: [{ term: 'HDV', expansions: ['atelier'] }],
      disabledDefaults: [],
    });
    expect(search('hdv', dict)).toEqual(['bijoutiers', 'atelier']);
  });

  it('plusieurs significations : union des résultats, aucun choix arbitraire', () => {
    const dict = buildDictionary([], {
      custom: [{ term: 'dj', expansions: ['meulou', 'reine des voleurs'] }],
      disabledDefaults: [],
    });
    expect(search('dj', dict)).toEqual(['meulou', 'reine']);
  });

  it('une signification exige tous ses mots : « hôtel » seul ne suffit pas', () => {
    const list = [...catalog, dest('hotel', 'Hôtel particulier')];
    expect(search('hdv', dictionary, list)).toEqual(['hdv-bonta', 'hdv-brakmar']);
  });

  it('les destinations qui portent la signification dans leur nom passent devant', () => {
    const list = [
      dest('tag', 'Comptoir', { tags: ['hôtel', 'ventes'] }),
      dest('nom', 'Hôtel des ventes fictif'),
    ];
    expect(search('hdv', dictionary, list)).toEqual(['nom', 'tag']);
  });

  it('un terme du dictionnaire garde sa correspondance directe', () => {
    const list = [dest('direct', 'Rdvium fictif'), dest('reine', 'Reine des Voleurs')];
    expect(search('rdv', dictionary, list)).toEqual(['direct', 'reine']);
  });
});

describe('classement', () => {
  it('nom entier ou alias entier de la fiche : en tête', () => {
    const list = [
      dest('long', 'Vortex du nord'),
      dest('exact', 'Vortex'),
      dest('alias', 'Autre lieu', { aliases: ['vortex'] }),
    ];
    expect(search('vortex', new Map(), list)).toEqual(['alias', 'exact', 'long']);
  });

  it('tolérance aux fautes : aucun résultat approximatif tant qu\'un résultat exact existe', () => {
    const list = [dest('exact', 'Melou fictif'), dest('proche', 'Meulou fictif')];
    expect(search('melou', new Map(), list)).toEqual(['exact']);
  });

  it('la distance d\'édition n\'est jamais calculée quand la recherche exacte aboutit', () => {
    const distance = vi.mocked(searchText.boundedPrefixDistance);
    distance.mockClear();
    const index = buildSearchIndex(catalog, dictionary);
    for (const q of ['bijou', 'hdv bonta', 'donjon', 'hotel des ventes', '']) searchIndexRank(index, q, new Set());
    expect(distance).not.toHaveBeenCalled();
    searchIndexRank(index, 'melou', new Set());
    expect(distance).toHaveBeenCalled();
  });

  it('pas de tolérance sous 4 lettres, ni sur la première lettre', () => {
    expect(search('rdw', new Map())).toEqual([]);
    expect(search('neulou', new Map())).toEqual([]);
  });

  it('une faute ne rapproche que le nom et les alias, pas les tags ni la zone', () => {
    const list = [dest('zone', 'Lieu', { zone: 'Meulou' }), dest('tag', 'Autre', { tags: ['meulou'] })];
    expect(search('melou', new Map(), list)).toEqual([]);
  });
});

describe('catégories', () => {
  const list = [
    dest('antre', 'Antre fictive', { category: 'dungeon' }),
    dest('colline', 'Colline', { category: 'place' }),
    dest('garde', 'Garde fictif', { category: 'npc' }),
  ];

  it('« on » ne ramène pas les donjons, « di » ne ramène pas les lieux-dits', () => {
    expect(search('on', new Map(), list)).toEqual([]);
    expect(search('di', new Map(), list)).toEqual([]);
  });

  it('« dit », « lieu-dit » et « lieux-dits » désignent les lieux-dits', () => {
    expect(search('dit', new Map(), list)).toEqual(['colline']);
    expect(search('lieu-dit', new Map(), list)).toEqual(['colline']);
    expect(search('lieux-dits col', new Map(), list)).toEqual(['colline']);
  });
});

describe('cas limites', () => {
  it('ponctuation seule : rien (une requête vide montre tout)', () => {
    expect(search('---')).toEqual([]);
    expect(ids(filterDestinations(catalog, 'all', '---', new Set(), dictionary))).toEqual([]);
    expect(search('')).toHaveLength(catalog.length);
    expect(filterDestinations(catalog, 'all', '   ', new Set(), dictionary)).toHaveLength(catalog.length);
  });

  it('un nombre ne tolère aucune faute', () => {
    const list = [dest('a', 'Atelier 1234'), dest('b', 'Atelier 1235')];
    expect(search('1236', new Map(), list)).toEqual([]);
    expect(search('1234', new Map(), list)).toEqual(['a']);
  });

  it('nom dans un autre alphabet : trouvé, et lui seul', () => {
    const list = [dest('jp', '東京'), dest('fr', 'Vortex')];
    expect(search('東京', new Map(), list)).toEqual(['jp']);
    expect(search('東', new Map(), list)).toEqual(['jp']);
  });

  it('recherche restreinte : un résultat exact écarté par le filtre ne bloque pas la seconde passe', () => {
    const list = [
      dest('farm', 'Tremble', { category: 'farm', command: '/travel 1 1' }),
      dest('pnj', 'Tremlbe garde', { category: 'npc' }),
    ];
    const index = buildSearchIndex(list);
    const farms = (q: string) => ids(searchIndexRank(index, q, new Set(), (d) => d.category === 'farm'));
    expect(ids(searchIndexRank(index, 'tremlbe', new Set()))).toEqual(['pnj']);
    expect(farms('tremlbe')).toEqual(['farm']);
    expect(farms('')).toEqual(['farm']);
  });

  it('sans tolérance aux fautes sur demande (compteur des alias)', () => {
    const index = buildSearchIndex(catalog, dictionary);
    expect(searchIndexMatch(index, 'melou').size).toBe(1);
    expect(searchIndexMatch(index, 'melou', { typos: false }).size).toBe(0);
    expect(searchIndexMatch(index, 'hdv', { typos: false }).size).toBe(2);
  });
});

describe('index', () => {
  it('destination désactivée absente', () => {
    const list = [dest('on', 'Vortex'), dest('off', 'Vortex éteint', { enabled: false })];
    expect(search('vortex', new Map(), list)).toEqual(['on']);
    expect(ids([...searchIndexMatch(buildSearchIndex(list), '')])).toEqual(['on']);
  });

  it('réutilisé pour le même tableau et le même dictionnaire, reconstruit sinon', () => {
    const list = [dest('a', 'Ancien')];
    const first = getSearchIndex(list, dictionary);
    expect(getSearchIndex(list, dictionary)).toBe(first);
    expect(getSearchIndex(list, new Map())).not.toBe(first);
    expect(getSearchIndex([dest('a', 'Nouveau')], dictionary)).not.toBe(first);
  });

  it('la grille applique les mêmes correspondances, dans l\'ordre du catalogue', () => {
    const list = [
      dest('z', 'Hôtel des ventes Z', { sortOrder: 2 }),
      dest('a', 'Hôtel des ventes A', { sortOrder: 1 }),
      dest('autre', 'Atelier'),
    ];
    expect(ids(filterDestinations(list, 'all', 'hdv', new Set(), dictionary))).toEqual(['a', 'z']);
    expect(ids(filterDestinations(list, 'all', 'atelié', new Set(), dictionary))).toEqual(['autre']);
    expect(ids(filterDestinations(list, 'favorites', 'hdv', new Set(['z']), dictionary))).toEqual(['z']);
  });
});
