import { describe, expect, it } from 'vitest';
import seed from '../resources/catalog.seed.json';
import {
  isSafeImagePath,
  makeDestinationId,
  SCHEMA_VERSION,
  validateCatalog,
  type Destination,
} from '../src/features/catalog/schema';
import { filterDestinations } from '../src/features/catalog/search';
import { normalizeText } from '../src/features/catalog/searchText';
import { makeDestination } from './helpers/destination';

const dest = (partial: Partial<Destination> & { id: string; name: string }): Destination => makeDestination(partial);

describe('validation du catalogue (invariant 5)', () => {
  it('le seed livré est valide', () => {
    const r = validateCatalog(seed);
    expect(r.ok).toBe(true);
  });

  it('refuse ids en double, catégorie inconnue, chemin image dangereux', () => {
    const r = validateCatalog({
      schemaVersion: 2,
      destinations: [
        { id: 'a', name: 'A', category: 'npc', command: '' },
        { id: 'a', name: 'B', category: 'boss', command: '', image: '../../secret.png' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const paths = r.errors.map((e) => e.path);
      expect(paths).toContain('destinations[1].id');
      expect(paths).toContain('destinations[1].category');
      expect(paths).toContain('destinations[1].image');
    }
  });

  it('test 17 : JSON corrompu → erreur, jamais d\'exception', () => {
    expect(validateCatalog(null).ok).toBe(false);
    expect(validateCatalog('oops').ok).toBe(false);
    expect(validateCatalog({ schemaVersion: 2 }).ok).toBe(false);
    expect(validateCatalog({ schemaVersion: 99, destinations: [] }).ok).toBe(false);
  });

  it('ne modifie jamais command', () => {
    const command = ' /zaap 1 1 ;/travel 2 2\n';
    const r = validateCatalog({ schemaVersion: 2, destinations: [{ id: 'x', name: 'X', category: 'npc', command }] });
    expect(r.ok && r.catalog.destinations[0]?.command).toBe(command);
  });

  it('le seed livré est au schéma 3 et contient un exemple deux étapes', () => {
    const r = validateCatalog(seed);
    expect(r.ok && r.catalog.schemaVersion).toBe(SCHEMA_VERSION);
    expect(seed.schemaVersion).toBe(3);
    expect(r.ok && r.catalog.destinations.some((d) => d.twoStep)).toBe(true);
  });

  it('catalogue v2 sans les nouveaux champs : valide, twoStep faux, command2 vide, sortie en v3', () => {
    const r = validateCatalog({
      schemaVersion: 2,
      destinations: [{ id: 'a', name: 'A', category: 'dungeon', command: '/travel 1 1' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.catalog.schemaVersion).toBe(3);
      expect(r.catalog.destinations[0]?.twoStep).toBe(false);
      expect(r.catalog.destinations[0]?.command2).toBe('');
    }
  });

  it('twoStep et command2 de mauvais type : erreur avec le bon chemin', () => {
    const r = validateCatalog({
      schemaVersion: 3,
      destinations: [
        { id: 'a', name: 'A', category: 'npc', command: '', twoStep: 'oui' },
        { id: 'b', name: 'B', category: 'npc', command: '', command2: 42 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const paths = r.errors.map((e) => e.path);
      expect(paths).toContain('destinations[0].twoStep');
      expect(paths).toContain('destinations[1].command2');
    }
  });

  it('twoStep refusé hors PNJ et Donjons', () => {
    const r = validateCatalog({
      schemaVersion: 3,
      destinations: [
        { id: 'p', name: 'P', category: 'place', command: '/travel 1 1', twoStep: true, command2: '/travel 2 2' },
        { id: 'f', name: 'F', category: 'farm', command: '/travel 1 1', twoStep: true },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const paths = r.errors.map((e) => e.path);
      expect(paths).toContain('destinations[0].twoStep');
      expect(paths).toContain('destinations[1].twoStep');
    }
  });

  it('twoStep accepté pour PNJ et Donjons, même avec command2 vide', () => {
    const r = validateCatalog({
      schemaVersion: 3,
      destinations: [
        { id: 'n', name: 'N', category: 'npc', command: '/travel 1 1', twoStep: true, command2: '' },
        { id: 'd', name: 'D', category: 'dungeon', command: '/travel 1 1', twoStep: true, command2: '/travel 2 2' },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.catalog.destinations.map((d) => d.twoStep)).toEqual([true, true]);
  });

  it('command2 conservée quand twoStep est faux, et jamais modifiée', () => {
    const command2 = '  /zaap 2 2 ;\n/travel 3 3  ';
    const r = validateCatalog({
      schemaVersion: 3,
      destinations: [
        { id: 'x', name: 'X', category: 'npc', command: '', twoStep: true, command2 },
        { id: 'y', name: 'Y', category: 'place', command: '', twoStep: false, command2 },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.catalog.destinations[0]?.command2).toBe(command2);
      expect(r.catalog.destinations[1]?.command2).toBe(command2);
    }
  });

  it('chemins d\'image', () => {
    expect(isSafeImagePath('images/abc-1.webp')).toBe(true);
    expect(isSafeImagePath('C:/Users/x.png')).toBe(false);
    expect(isSafeImagePath('https://exemple.test/a.png')).toBe(false);
    expect(isSafeImagePath('images/../x.png')).toBe(false);
  });

  it('identifiants générés uniques et lisibles', () => {
    expect(makeDestinationId('Abraknyde Ancestral', [])).toBe('abraknyde-ancestral');
    expect(makeDestinationId('Mériana', ['meriana'])).toBe('meriana-2');
    expect(makeDestinationId('!!!', [])).toBe('destination');
    // Ligatures dépliées comme dans la recherche, au lieu de couper le mot.
    expect(makeDestinationId('Cœur de Ætheria', [])).toBe('coeur-de-aetheria');
    expect(makeDestinationId('Straße  Łódź', [])).toBe('strasse-lodz');
  });
});

describe('recherche et tri', () => {
  const list = [
    dest({ id: 'm', name: 'Mériana', zone: 'Île fictive', sortOrder: 5 }),
    dest({ id: 'v', name: 'Vortex', category: 'dungeon', sortOrder: 1 }),
    dest({ id: 'b', name: 'Bois test', category: 'farm', tags: ['bûcheron'], sortOrder: 1 }),
    dest({ id: 'off', name: 'Désactivée', enabled: false }),
  ];

  it('test 16 : recherche sans accents', () => {
    expect(normalizeText('  Mériana  ÎLE ')).toBe('meriana ile');
    expect(filterDestinations(list, 'all', 'meriana', new Set()).map((d) => d.id)).toEqual(['m']);
  });

  it('recherche « vortex » et sur tags / zone', () => {
    expect(filterDestinations(list, 'all', 'vortex', new Set()).map((d) => d.id)).toEqual(['v']);
    expect(filterDestinations(list, 'all', 'bucheron', new Set()).map((d) => d.id)).toEqual(['b']);
    expect(filterDestinations(list, 'all', 'ile', new Set()).map((d) => d.id)).toEqual(['m']);
  });

  it('tri stable sortOrder puis nom ; désactivées masquées', () => {
    expect(filterDestinations(list, 'all', '', new Set()).map((d) => d.id)).toEqual(['b', 'v', 'm']);
  });

  it('tri par nom : accents et casse ignorés, nombres dans l\'ordre naturel', () => {
    const names = ['Zone 10', 'zone 2', 'Écurie', 'eau', 'Zone 1'];
    const sorted = filterDestinations(
      names.map((name, i) => dest({ id: `n${i}`, name })),
      'all',
      '',
      new Set(),
    ).map((d) => d.name);
    expect(sorted).toEqual(['eau', 'Écurie', 'Zone 1', 'zone 2', 'Zone 10']);
  });

  it('recherche multi-mots (ET) et résultat identique au second appel (cache)', () => {
    const run = () => filterDestinations(list, 'all', 'ILE  mer', new Set()).map((d) => d.id);
    expect(run()).toEqual(['m']);
    expect(run()).toEqual(['m']);
    expect(filterDestinations(list, 'all', 'ile vortex', new Set())).toEqual([]);
  });

  it('une destination modifiée (nouvel objet) est réindexée', () => {
    const before = dest({ id: 'x', name: 'Ancien nom' });
    const after = { ...before, name: 'Nouveau nom' };
    expect(filterDestinations([before], 'all', 'nouveau', new Set())).toEqual([]);
    expect(filterDestinations([after], 'all', 'nouveau', new Set()).map((d) => d.id)).toEqual(['x']);
  });

  it('vues catégorie et favoris (Farm inclus)', () => {
    expect(filterDestinations(list, 'farm', '', new Set()).map((d) => d.id)).toEqual(['b']);
    expect(filterDestinations(list, 'favorites', '', new Set(['b', 'm'])).map((d) => d.id)).toEqual(['b', 'm']);
  });
});
