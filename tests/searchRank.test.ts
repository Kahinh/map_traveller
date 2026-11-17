import { describe, expect, it } from 'vitest';
import type { Destination } from '../src/features/catalog/schema';
import { filterDestinations } from '../src/features/catalog/search';
import { buildSearchIndex, FIELD_COST, searchIndexRank, TIER } from '../src/features/catalog/searchIndex';
import { makeDestination } from './helpers/destination';

// Coordonnées fictives uniquement.
const dest = (partial: Partial<Destination> & { id: string; name: string }): Destination => makeDestination(partial);

const ids = (list: Destination[]) => list.map((d) => d.id);
const rankDestinations = (list: Destination[], query: string, favorites: ReadonlySet<string>) =>
  searchIndexRank(buildSearchIndex(list), query, favorites);

describe('classement de la recherche (palette §5.2)', () => {
  it('début du nom > début d\'un mot du nom > mot d\'un tag > contenu dans un mot (issue n°24)', () => {
    const list = [
      dest({ id: 'tag', name: 'Autre', tags: ['arbre'] }),
      dest({ id: 'contenu', name: 'Marbre' }),
      dest({ id: 'mot', name: 'Grand arbre' }),
      dest({ id: 'prefixe', name: 'Arbre creux' }),
    ];
    // Un mot entier trouvé dans un tag (palier 4) passe devant une sous-chaîne du nom (palier 6).
    expect(ids(rankDestinations(list, 'arbre', new Set()))).toEqual(['prefixe', 'mot', 'tag', 'contenu']);
  });

  it('coûts explicites par champ ; un mot manquant écarte la destination', () => {
    // Une destination témoin par coût : l'ordre du classement révèle le coût de chaque mot.
    const list = [
      dest({ id: 'zone', name: 'Autre', zone: 'Plaine fictive' }),
      dest({ id: 'dedans', name: 'Esplanade' }),
      dest({ id: 'mot', name: 'Grande plaine' }),
      dest({ id: 'debut', name: 'Plaine haute' }),
    ];
    expect(ids(rankDestinations(list, 'plaine', new Set()))).toEqual(['debut', 'mot', 'zone']);
    expect(ids(rankDestinations(list, 'plan', new Set()))).toEqual(['dedans']);
    expect(rankDestinations(list, 'plaine absent', new Set())).toEqual([]);
    expect(FIELD_COST.nameFirst).toBeLessThan(FIELD_COST.nameOther);
    expect(FIELD_COST.nameOther).toBeLessThan(FIELD_COST.alias);
    expect(FIELD_COST.alias).toBeLessThan(FIELD_COST.other);
    const tiers = [TIER.aliasExact, TIER.nameExact, TIER.prefix, TIER.words, TIER.acronym, TIER.inside, TIER.typo];
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
  });

  it('un mot après un tiret compte comme début de mot', () => {
    const list = [dest({ id: 'dedans', name: 'Inédite' }), dest({ id: 'tiret', name: 'Lieu-dit Haut' })];
    expect(ids(searchIndexRank(buildSearchIndex(list), 'dit', new Set()))).toEqual(['tiret', 'dedans']);
  });

  it('favori en tête à rang égal, puis sortOrder et nom', () => {
    const list = [
      dest({ id: 'a', name: 'Pont A', sortOrder: 1 }),
      dest({ id: 'b', name: 'Pont B', sortOrder: 2 }),
      dest({ id: 'c', name: 'Pont C', sortOrder: 3 }),
    ];
    expect(ids(rankDestinations(list, 'pont', new Set(['c'])))).toEqual(['c', 'a', 'b']);
    // Le favori ne passe pas devant un meilleur rang.
    const mixed = [dest({ id: 'fav', name: 'Le pont' }), dest({ id: 'top', name: 'Pont haut' })];
    expect(ids(rankDestinations(mixed, 'pont', new Set(['fav'])))).toEqual(['top', 'fav']);
  });

  it('sans accents ni casse, plusieurs mots en ET', () => {
    const list = [dest({ id: 'm', name: 'Mériana', zone: 'Île fictive' }), dest({ id: 'v', name: 'Vortex' })];
    expect(ids(rankDestinations(list, 'MERIANA', new Set()))).toEqual(['m']);
    expect(ids(rankDestinations(list, 'ile mer', new Set()))).toEqual(['m']);
    expect(rankDestinations(list, 'ile vortex', new Set())).toEqual([]);
  });

  it('requête vide : toutes les destinations actives, favoris d\'abord', () => {
    const list = [
      dest({ id: 'a', name: 'A', sortOrder: 1 }),
      dest({ id: 'b', name: 'B', sortOrder: 2 }),
      dest({ id: 'off', name: 'C', enabled: false }),
    ];
    expect(ids(rankDestinations(list, '  ', new Set(['b'])))).toEqual(['b', 'a']);
  });
});

describe('mots de catégorie cherchables', () => {
  const list = [
    dest({ id: 'tremble', name: 'Tremble', category: 'farm', command: '/travel 1 1' }),
    dest({ id: 'antre', name: 'Antre fictive', category: 'dungeon' }),
    dest({ id: 'grotte', name: 'Grotte fictive', category: 'dungeon' }),
    dest({ id: 'garde', name: 'Garde fictif', category: 'npc' }),
    dest({ id: 'nom-donjon', name: 'Donjon des tests', category: 'place' }),
  ];

  it('« farm tremble » trouve un parcours nommé « Tremble »', () => {
    expect(ids(rankDestinations(list, 'farm tremble', new Set()))).toEqual(['tremble']);
  });

  it('« donjon » liste les donjons ; un nom contenant le mot passe devant', () => {
    expect(ids(rankDestinations(list, 'donjon', new Set()))).toEqual(['nom-donjon', 'antre', 'grotte']);
  });

  it('« pnj » et « lieu » trouvent leur catégorie', () => {
    expect(ids(rankDestinations(list, 'pnj', new Set()))).toEqual(['garde']);
    expect(ids(rankDestinations(list, 'lieu', new Set()))).toEqual(['nom-donjon']);
    expect(ids(rankDestinations(list, 'lieu tes', new Set()))).toEqual(['nom-donjon']);
  });

  it('s\'appliquent aussi à la recherche de la fenêtre principale', () => {
    expect(ids(filterDestinations(list, 'all', 'farm', new Set()))).toEqual(['tremble']);
    expect(ids(filterDestinations(list, 'all', 'donjons', new Set()))).toEqual(['antre', 'grotte']);
  });
});

describe('mots de catégorie : début de mot-clé seulement', () => {
  const list = [
    dest({ id: 'g', name: 'Grotte fictive', category: 'dungeon' }),
    dest({ id: 't', name: 'Tremble', category: 'farm', command: '/travel 1 1' }),
    dest({ id: 'c', name: 'Colline', category: 'place' }),
  ];
  const ids = (q: string) => filterDestinations(list, 'all', q, new Set()).map((d) => d.id);

  it('« donj » et « donjons » désignent les donjons', () => {
    expect(ids('donj')).toEqual(['g']);
    expect(ids('donjons')).toEqual(['g']);
  });

  it('une seule lettre ne désigne pas une catégorie', () => {
    expect(ids('f')).toEqual(['g']); // « fictive », pas la catégorie Farm
  });
});
