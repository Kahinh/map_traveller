import { describe, expect, it, vi } from 'vitest';
import { buildDictionary, type AliasDictionary, type AliasEntry } from '../src/features/aliases/aliases';
import type { Destination } from '../src/features/catalog/schema';
import { filterDestinations } from '../src/features/catalog/search';
import { acronymsOf, buildSearchIndex, getSearchIndex, searchIndexMatch, searchIndexRank } from '../src/features/catalog/searchIndex';
import { tokenize } from '../src/features/catalog/searchText';
import * as searchText from '../src/features/catalog/searchText';
import { makeDestination } from './helpers/destination';

// Compte les calculs de distance sans changer leur comportement.
vi.mock('../src/features/catalog/searchText', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/features/catalog/searchText')>();
  return { ...actual, boundedPrefixDistance: vi.fn(actual.boundedPrefixDistance) };
});

// Noms libres, coordonnées fictives uniquement.
const dest = (id: string, name: string, extra: Partial<Destination> = {}): Destination =>
  makeDestination({ id, name, ...extra });

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
  ids(searchIndexRank(getSearchIndex(list, dict), query, new Set()));

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
    // « l'atelier » est le début du nom « L'atelier d'Astrub » (palier 3) ; l'autre n'a que le mot (palier 4).
    expect(search("l'atelier")).toEqual(['atelier', 'bijoutiers']);
    expect(search('atelier de astrub')).toEqual(['atelier']);
  });
});

describe('dictionnaire d\'alias', () => {
  it('sans dictionnaire, un terme ne trouve que les initiales calculées', () => {
    // « Hôtel des ventes de … » a pour initiales « hdvdb » : « hdv » en est le début (palier 5).
    expect(search('hdv', new Map())).toEqual(['hdv-bonta', 'hdv-brakmar']);
    // « Donjon Reine des Voleurs » : « drdv », « drv » ; « rdv » n'en est pas le début.
    expect(search('rdv', new Map())).toEqual([]);
  });

  it('alias désactivé : sans effet', () => {
    const dict = buildDictionary(DEFAULTS, { custom: [], disabledDefaults: ['rdv'] });
    expect(search('rdv', dict)).toEqual([]);
    expect(search('hdv', dict)).toEqual(['hdv-bonta', 'hdv-brakmar']);
  });

  it('alias personnalisé : remplace l\'alias livré du même terme', () => {
    const dict = buildDictionary(DEFAULTS, {
      custom: [{ term: 'HDV', expansions: ['atelier'] }],
      disabledDefaults: [],
    });
    // Le terme (palier 1) passe devant les initiales calculées des hôtels (palier 5).
    expect(search('hdv', dict)).toEqual(['bijoutiers', 'atelier', 'hdv-bonta', 'hdv-brakmar']);
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

  it('un terme du dictionnaire garde sa correspondance directe, après ce qu\'il désigne', () => {
    const list = [dest('direct', 'Rdvium fictif'), dest('reine', 'Reine des Voleurs')];
    // Alias exact (palier 1) devant le début d'un nom (palier 3) : issue n°24.
    expect(search('rdv', dictionary, list)).toEqual(['reine', 'direct']);
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

  it('une simple inclusion ne suffit pas : « on » et « jon » ne ramènent pas les donjons, « di » pas les lieux-dits', () => {
    expect(search('on', new Map(), list)).toEqual([]);
    expect(search('jon', new Map(), list)).toEqual([]);
    expect(ids(filterDestinations(list, 'all', 'on', new Set()))).toEqual([]);
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
    expect(searchIndexMatch(index, 'melou')?.size).toBe(1);
    expect(searchIndexMatch(index, 'melou', { typos: false })?.size).toBe(0);
    expect(searchIndexMatch(index, 'hdv', { typos: false })?.size).toBe(2);
  });

  it('requête vide : `null` (tout correspond) ; ponctuation seule : ensemble vide', () => {
    const index = buildSearchIndex(catalog, dictionary);
    expect(searchIndexMatch(index, '')).toBeNull();
    expect(searchIndexMatch(index, '   ')).toBeNull();
    expect(searchIndexMatch(index, '---')?.size).toBe(0);
  });

  it('grille : faute de frappe dans l\'onglet courant malgré un lieu qui correspond exactement', () => {
    const list = [
      dest('lieu', 'Meulou fictif', { category: 'place' }),
      dest('donjon', 'Antre du Meulu', { category: 'dungeon' }),
    ];
    expect(ids(filterDestinations(list, 'all', 'meulou', new Set()))).toEqual(['lieu']);
    expect(ids(filterDestinations(list, 'dungeon', 'meulou', new Set()))).toEqual(['donjon']);
    expect(ids(filterDestinations(list, 'favorites', 'meulou', new Set(['donjon'])))).toEqual(['donjon']);
  });
});

describe('index', () => {
  it('destination désactivée absente', () => {
    const list = [dest('on', 'Vortex'), dest('off', 'Vortex éteint', { enabled: false })];
    expect(search('vortex', new Map(), list)).toEqual(['on']);
    expect(ids([...(searchIndexMatch(buildSearchIndex(list), 'vortex') ?? [])])).toEqual(['on']);
    expect(ids(filterDestinations(list, 'all', '', new Set()))).toEqual(['on']);
  });

  it('cache des coûts par mot : le moins récemment lu est évincé, pas tout le cache', () => {
    const index = buildSearchIndex([dest('a', 'Ancien')]);
    // Mots de trois lettres : aucune seconde passe, une seule entrée de cache par mot.
    const word = (i: number) => `w${i.toString(36).padStart(2, '0')}`;
    const typed = (q: string) => searchIndexRank(index, q, new Set());
    for (let i = 0; i < 64; i++) typed(word(i));
    expect(index.cache.size).toBe(64);
    typed(word(0)); // relu : devient le plus récent
    typed('zzz');
    expect(index.cache.size).toBe(64);
    expect(index.cache.has(`exact:${word(0)}`)).toBe(true);
    expect(index.cache.has(`exact:${word(1)}`)).toBe(false);
    expect(index.cache.has('exact:zzz')).toBe(true);
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

describe('paliers de pertinence (issue n°24)', () => {
  it('un témoin par palier : alias exact > nom exact > début > mots > acronyme > sous-chaîne', () => {
    const dict = buildDictionary([], { custom: [{ term: 'vortex', expansions: ['portail bleu'] }], disabledDefaults: [] });
    const list = [
      dest('dedans', 'Supervortex'),
      dest('acronyme-debut', 'Vieux Ormeau Rouge Tour Est Xénon Ouest'),
      dest('acronyme', 'Vieux Ormeau Rouge Tour Est Xénon'),
      dest('tag', 'Lieu C', { tags: ['vortex'] }),
      dest('mot', 'Grand vortex'),
      dest('prefixe-alias', 'Lieu B', { aliases: ['vortex sud'] }),
      dest('prefixe', 'Vortex du nord'),
      dest('exact', 'Vortex'),
      dest('terme', 'Portail bleu fictif'),
      dest('alias', 'Autre lieu', { aliases: ['Vortex'] }),
    ];
    expect(search('vortex', dict, list)).toEqual([
      'alias',
      'terme',
      'exact',
      'prefixe',
      'prefixe-alias',
      'mot',
      'tag',
      'acronyme',
      'acronyme-debut',
      'dedans',
    ]);
  });

  it('« rdv » : l\'alias de fiche exact passe devant les acronymes et les débuts de nom', () => {
    const list = [
      dest('rdvium', 'Rdvium fictif'),
      dest('repaire', 'Repaire du Vent'),
      dest('trone', 'Trône de la Cour Sombre', { aliases: ['RDV', 'Reine des Voleurs'] }),
    ];
    expect(search('rdv', new Map(), list)).toEqual(['trone', 'rdvium', 'repaire']);
    expect(search('RDV', dictionary, list)[0]).toBe('trone');
  });

  it('acronymes calculés : avec et sans mots de liaison, jamais pour un seul mot', () => {
    expect(acronymsOf(tokenize('Reine des Voleurs'))).toEqual(['rdv', 'rv']);
    expect(acronymsOf(tokenize('Grand Vortex'))).toEqual(['gv']);
    expect(acronymsOf(tokenize('Le Pont'))).toEqual(['lp']);
    expect(acronymsOf(tokenize('Vortex'))).toEqual([]);
    const list = [dest('reine', 'Reine des Voleurs'), dest('seul', 'Rv')];
    expect(search('rv', new Map(), list)).toEqual(['seul', 'reine']);
    // Début d'acronyme : « ad » commence « adb » (Atelier des bijoutiers).
    expect(search('ad', new Map(), [dest('a', 'Atelier des bijoutiers')])).toEqual(['a']);
  });

  it('un acronyme ne s\'applique qu\'à une requête d\'un seul mot', () => {
    const list = [dest('reine', 'Reine des Voleurs')];
    expect(search('rdv bonta', new Map(), list)).toEqual([]);
  });

  it('alias de fiche en double (catalogue existant) : toutes les fiches, ordre déterministe', () => {
    const list = [
      dest('b', 'Beta', { aliases: ['xy'], sortOrder: 2 }),
      dest('a', 'Alpha', { aliases: ['xy'], sortOrder: 1 }),
    ];
    expect(search('xy', new Map(), list)).toEqual(['a', 'b']);
    expect(ids(searchIndexRank(getSearchIndex(list, new Map()), 'xy', new Set(['b'])))).toEqual(['b', 'a']);
  });

  it('les acronymes comptent comme une correspondance exacte : pas de seconde passe', () => {
    const distance = vi.mocked(searchText.boundedPrefixDistance);
    distance.mockClear();
    expect(search('rdvd', new Map(), [dest('r', 'Reine des Voleurs Dorés'), dest('x', 'Rdvdx')])).toEqual(['x', 'r']);
    expect(distance).not.toHaveBeenCalled();
  });
});
