// Coordonnées FICTIVES : elles illustrent les règles, ce ne sont pas des trajets réels.
import { describe, expect, it } from 'vitest';
import {
  draftFromDestination,
  draftPreview,
  duplicateDraft,
  emptyDraft,
  isDraftDirty,
  parseSortOrder,
  removeDestination,
  splitList,
  upsertDestination,
  validateDraft,
  type DestinationDraft,
} from '../src/features/catalog/editor';
import { SCHEMA_VERSION, validateCatalog, type Catalog, type Destination } from '../src/features/catalog/schema';
import { leftClickCommand, rightClickCommand } from '../src/features/commands/copyRules';
import { parseFarmRoute } from '../src/features/farm/farmRoute';
import { makeDestination } from './helpers/destination';

const dest = (partial: Partial<Destination> & { id: string; name: string }): Destination =>
  makeDestination({ category: 'npc', command: '/zaap 5 -18;/travel 1 1', ...partial });

function catalog(...destinations: Destination[]): Catalog {
  return { schemaVersion: SCHEMA_VERSION, destinations };
}

function draft(partial: Partial<DestinationDraft>): DestinationDraft {
  return { ...emptyDraft(), name: 'Nouvelle', command: '/travel 1 1', ...partial };
}

/** Catalogue figé : toute mutation lèverait une exception en mode strict. */
function frozen(c: Catalog): Catalog {
  c.destinations.forEach((d) => Object.freeze(d));
  Object.freeze(c.destinations);
  return Object.freeze(c);
}

describe('brouillon vide', () => {
  it('catégorie PNJ par défaut, deux étapes décoché, champs vides', () => {
    const d = emptyDraft();
    expect(d.id).toBeNull();
    expect(d.category).toBe('npc');
    expect(d.twoStep).toBe(false);
    expect(d.command).toBe('');
    expect(d.command2).toBe('');
    expect(d.image).toBeNull();
    expect(d.sortOrder).toBe('');
  });

  it('catégorie imposée', () => {
    expect(emptyDraft('farm').category).toBe('farm');
  });
});

describe('création', () => {
  it('identifiant généré, unique, destination ajoutée en fin de catalogue', () => {
    const a = dest({ id: 'nouvelle', name: 'Nouvelle' });
    const b = dest({ id: 'autre', name: 'Autre' });
    const r = upsertDestination(catalog(a, b), draft({ name: 'Nouvelle' }));
    expect(r.id).toBe('nouvelle-2');
    expect(r.catalog.destinations).toHaveLength(3);
    expect(r.catalog.destinations[2]?.id).toBe('nouvelle-2');
    expect(r.catalog.destinations[0]).toBe(a);
    expect(r.catalog.destinations[1]).toBe(b);
  });

  it('nom nettoyé des espaces, destination active, champs facultatifs convertis', () => {
    const r = upsertDestination(
      catalog(),
      draft({ name: '  Exemple  ', zone: ' Zone fictive ', aliases: 'a, b', tags: 'x', sortOrder: ' 5 ' }),
    );
    const created = r.catalog.destinations[0]!;
    expect(created).toMatchObject({
      id: 'exemple',
      name: 'Exemple',
      zone: 'Zone fictive',
      aliases: ['a', 'b'],
      tags: ['x'],
      sortOrder: 5,
      enabled: true,
      twoStep: false,
      command2: '',
    });
  });

  it('refuse un brouillon invalide', () => {
    expect(() => upsertDestination(catalog(), draft({ name: ' ' }))).toThrow();
  });
});

describe('modification', () => {
  it('identifiant inchangé même si le nom change, position conservée', () => {
    const a = dest({ id: 'a', name: 'A' });
    const b = dest({ id: 'b', name: 'B' });
    const c = dest({ id: 'c', name: 'C' });
    const r = upsertDestination(catalog(a, b, c), { ...draftFromDestination(b), name: 'Bravo' });
    expect(r.id).toBe('b');
    expect(r.catalog.destinations.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(r.catalog.destinations[1]?.name).toBe('Bravo');
  });

  it('les champs inconnus du formulaire sont conservés', () => {
    const extra = { ...dest({ id: 'a', name: 'A', enabled: false }), futur: 42 } as Destination;
    const r = upsertDestination(catalog(extra), { ...draftFromDestination(extra), name: 'A2' });
    const saved = r.catalog.destinations[0] as Destination & { futur?: number };
    expect(saved.enabled).toBe(false);
    expect(saved.futur).toBe(42);
  });

  it('identifiant introuvable : erreur, aucune création silencieuse', () => {
    expect(() => upsertDestination(catalog(), { ...draft({}), id: 'absent' })).toThrow();
  });
});

describe('commandes enregistrées strictement telles que saisies', () => {
  const tricky = [
    '  /zaap 5 -18 ;/travel 1 1;  ',
    '/travel 1 1;;/travel  2   2;',
    '/zaap 5 -18;\n/travel 1 1\r\n/travel 2 2\n',
    '\t/travel 1 1;',
  ];

  it.each(tricky)('commande %j', (command) => {
    const r = upsertDestination(catalog(), draft({ command }));
    expect(r.catalog.destinations[0]?.command).toBe(command);
  });

  it('commande 2 conservée telle quelle', () => {
    const command2 = ' /travel 2 2 ;\n/travel 3 3;  ';
    const r = upsertDestination(catalog(), draft({ category: 'dungeon', twoStep: true, command2 }));
    expect(r.catalog.destinations[0]?.command2).toBe(command2);
  });

  it('commande intacte après passage par validateCatalog', () => {
    const command = '  /zaap 5 -18 ;\n/travel 1 1;  ';
    const r = upsertDestination(catalog(), draft({ command }));
    const v = validateCatalog(r.catalog);
    expect(v.ok && v.catalog.destinations[0]?.command).toBe(command);
  });
});

describe('immutabilité', () => {
  it('upsert ne modifie pas le catalogue d\'entrée et garde l\'identité des autres objets', () => {
    const a = dest({ id: 'a', name: 'A' });
    const b = dest({ id: 'b', name: 'B' });
    const input = frozen(catalog(a, b));
    const r = upsertDestination(input, { ...draftFromDestination(a), name: 'A2' });
    expect(input.destinations[0]?.name).toBe('A');
    expect(r.catalog).not.toBe(input);
    expect(r.catalog.destinations).not.toBe(input.destinations);
    expect(r.catalog.destinations[0]).not.toBe(a);
    expect(r.catalog.destinations[1]).toBe(b);
  });

  it('remove ne modifie pas le catalogue d\'entrée et garde l\'identité des autres objets', () => {
    const a = dest({ id: 'a', name: 'A' });
    const b = dest({ id: 'b', name: 'B' });
    const c = dest({ id: 'c', name: 'C' });
    const input = frozen(catalog(a, b, c));
    const out = removeDestination(input, 'b');
    expect(input.destinations).toHaveLength(3);
    expect(out.destinations).toHaveLength(2);
    expect(out.destinations[0]).toBe(a);
    expect(out.destinations[1]).toBe(c);
  });

  it('remove d\'un identifiant absent : nouveau catalogue au contenu identique', () => {
    const a = dest({ id: 'a', name: 'A' });
    const input = frozen(catalog(a));
    const out = removeDestination(input, 'zzz');
    expect(out).not.toBe(input);
    expect(out.destinations).toEqual([a]);
    expect(out.destinations[0]).toBe(a);
  });
});

describe('validation du brouillon', () => {
  it('brouillon correct : aucune erreur', () => {
    expect(validateDraft(draft({}))).toEqual({});
  });

  it.each(['', '   ', '\n\t'])('nom %j → erreur sur name', (name) => {
    const e = validateDraft(draft({ name }));
    expect(Object.keys(e)).toEqual(['name']);
  });

  it.each(['', '   ', '\n'])('commande %j → erreur sur command', (command) => {
    const e = validateDraft(draft({ command }));
    expect(Object.keys(e)).toEqual(['command']);
  });

  it('la validation ne modifie jamais le brouillon', () => {
    const d = draft({ name: '  X  ', command: '  /travel 1 1  ' });
    const copy = { ...d };
    validateDraft(d);
    expect(d).toEqual(copy);
  });

  it('chemin d\'image dangereux refusé', () => {
    expect(validateDraft(draft({ image: '../secret.png' })).image).toBeDefined();
    expect(validateDraft(draft({ image: 'images/img-1.png' })).image).toBeUndefined();
  });
});

describe('alias de fiche en double (issue n°24)', () => {
  const a = dest({ id: 'a', name: 'Antre fictive', aliases: ['RDV', 'Reine des Voleurs'] });
  const off = dest({ id: 'off', name: 'Éteinte', aliases: ['eteint'], enabled: false });

  it('alias déjà porté par une autre destination active : refusé, avec son nom', () => {
    const c = catalog(a, off);
    expect(validateDraft(draft({ aliases: 'rdv' }), c.destinations).aliases).toBe('Alias déjà utilisé par « Antre fictive »');
    // Comparaison normalisée : casse, accents, ponctuation et ordre des mots.
    expect(validateDraft(draft({ aliases: 'autre, voleurs  REINE des' }), c.destinations).aliases).toBeDefined();
    expect(() => upsertDestination(c, draft({ aliases: ' Rdv ' }))).toThrow(/Antre fictive/);
  });

  it('même destination, destination désactivée, alias distinct : accepté', () => {
    const c = catalog(a, off);
    expect(validateDraft({ ...draftFromDestination(a), name: 'Antre renommée' }, c.destinations)).toEqual({});
    expect(validateDraft(draft({ aliases: 'eteint' }), c.destinations)).toEqual({});
    expect(validateDraft(draft({ aliases: 'rdv2, reine' }), c.destinations)).toEqual({});
  });

  it('un catalogue qui contient déjà des doublons reste valide', () => {
    const twin = dest({ id: 'b', name: 'Bis', aliases: ['rdv'] });
    expect(validateCatalog(catalog(a, twin)).ok).toBe(true);
    // Modifier une autre destination n'est pas bloqué par le doublon existant.
    const other = dest({ id: 'c', name: 'Tierce' });
    expect(() => upsertDestination(catalog(a, twin, other), { ...draftFromDestination(other), zone: 'Z' })).not.toThrow();
  });
});

describe('trajet en deux étapes', () => {
  it('case cochée (PNJ ou Donjon) : les deux commandes sont obligatoires', () => {
    expect(validateDraft(draft({ category: 'npc', twoStep: true, command2: '' })).command2).toBeDefined();
    expect(validateDraft(draft({ category: 'dungeon', twoStep: true, command2: '  ' })).command2).toBeDefined();
    expect(validateDraft(draft({ category: 'dungeon', twoStep: true, command: '', command2: '/travel 2 2' })).command)
      .toBeDefined();
    expect(validateDraft(draft({ category: 'dungeon', twoStep: true, command2: '/travel 2 2' }))).toEqual({});
  });

  it('case décochée : commande 2 non exigée', () => {
    expect(validateDraft(draft({ category: 'npc', twoStep: false, command2: '' }))).toEqual({});
  });

  it('Lieu-dit ou Farm : case ignorée, twoStep enregistré à false, command2 conservée', () => {
    const command2 = '/travel 9 9';
    expect(validateDraft(draft({ category: 'place', twoStep: true, command2: '' }))).toEqual({});
    const place = upsertDestination(catalog(), draft({ category: 'place', twoStep: true, command2 }));
    expect(place.catalog.destinations[0]).toMatchObject({ twoStep: false, command2 });
    const farm = upsertDestination(
      catalog(),
      draft({ category: 'farm', command: '/travel 1 1;/travel 2 2', twoStep: true, command2 }),
    );
    expect(farm.catalog.destinations[0]).toMatchObject({ twoStep: false, command2 });
    expect(validateCatalog(farm.catalog).ok).toBe(true);
  });

  it('case décochée : command2 conservée dans le catalogue', () => {
    const r = upsertDestination(catalog(), draft({ category: 'npc', twoStep: false, command2: '/travel 2 2' }));
    expect(r.catalog.destinations[0]).toMatchObject({ twoStep: false, command2: '/travel 2 2' });
  });

  it('case cochée sur un donjon : twoStep enregistré à true', () => {
    const r = upsertDestination(catalog(), draft({ category: 'dungeon', twoStep: true, command2: '/travel 2 2' }));
    expect(r.catalog.destinations[0]?.twoStep).toBe(true);
  });

  it('aller-retour destination → brouillon → destination', () => {
    const d = dest({ id: 'd', name: 'D', category: 'dungeon', twoStep: true, command2: ' /travel 2 2\n' });
    const back = draftFromDestination(d);
    expect(back.twoStep).toBe(true);
    expect(back.command2).toBe(' /travel 2 2\n');
    const r = upsertDestination(catalog(d), back);
    expect(r.catalog.destinations[0]).toEqual(d);
  });
});

describe('Farm', () => {
  it('parcours valide accepté', () => {
    expect(validateDraft(draft({ category: 'farm', command: '/zaap 1 2;/travel 1 1;/travel 2 2' }))).toEqual({});
  });

  it('segment non reconnu → erreur listant le segment', () => {
    const e = validateDraft(draft({ category: 'farm', command: '/travel 1 1;/aller 2 2;/travel 3 3' }));
    expect(e.command).toContain('/aller 2 2');
  });

  it('aucune étape → erreur', () => {
    expect(validateDraft(draft({ category: 'farm', command: '/zaap 1 2' })).command).toBeDefined();
  });

  it('la même commande hors Farm n\'est pas analysée comme un parcours', () => {
    expect(validateDraft(draft({ category: 'place', command: '/aller 2 2' }))).toEqual({});
  });
});

describe('alias et tags', () => {
  it('découpage sur la virgule, espaces, vides et doublons retirés, ordre conservé', () => {
    expect(splitList(' b , a,,  b ,c, ')).toEqual(['b', 'a', 'c']);
    expect(splitList('')).toEqual([]);
    expect(splitList(' , ')).toEqual([]);
  });

  it('appliqué à l\'enregistrement', () => {
    const r = upsertDestination(catalog(), draft({ aliases: 'x, y, x', tags: ' t ,, ' }));
    expect(r.catalog.destinations[0]).toMatchObject({ aliases: ['x', 'y'], tags: ['t'] });
  });
});

describe('ordre d\'affichage', () => {
  it('vide → 0, entier accepté (signe et espaces tolérés)', () => {
    expect(parseSortOrder('')).toBe(0);
    expect(parseSortOrder('   ')).toBe(0);
    expect(parseSortOrder('12')).toBe(12);
    expect(parseSortOrder(' -3 ')).toBe(-3);
  });

  it.each(['1.5', 'abc', '1e3', '12a', '99999999999999999999'])('%j → non entier, erreur', (value) => {
    expect(parseSortOrder(value)).toBeNull();
    expect(validateDraft(draft({ sortOrder: value })).sortOrder).toBeDefined();
  });
});

describe('duplication', () => {
  it('nouvel identifiant, même image, même commande, nom suffixé', () => {
    const d = dest({
      id: 'a',
      name: 'A',
      image: 'images/img-1.png',
      command: ' /zaap 1 1;/travel 2 2\n',
      twoStep: true,
      command2: '/travel 3 3',
      category: 'dungeon',
      aliases: ['Alias A'],
    });
    const copy = duplicateDraft(d);
    expect(copy.aliases).toBe('');
    expect(copy.id).toBeNull();
    expect(copy.name).toBe('A (copie)');
    expect(copy.image).toBe(d.image);
    expect(copy.command).toBe(d.command);
    expect(copy.command2).toBe(d.command2);
    expect(copy.twoStep).toBe(true);
    const r = upsertDestination(catalog(d), copy);
    expect(r.id).not.toBe('a');
    expect(r.catalog.destinations).toHaveLength(2);
    expect(r.catalog.destinations[1]?.image).toBe('images/img-1.png');
  });
});

describe('aperçu', () => {
  it('classique avec Zaap : identique à leftClickCommand / rightClickCommand', () => {
    const command = '/zaap 5 -18;/travel 1 1';
    const p = draftPreview(draft({ command }));
    expect(p).toEqual({
      kind: 'classic',
      parts: [{ index: 1, left: leftClickCommand(command), right: rightClickCommand(command) }],
    });
  });

  it('classique sans Zaap : gauche = droit = commande', () => {
    const command = '/travel 1 1;/travel 2 2';
    const p = draftPreview(draft({ category: 'place', command }));
    expect(p.kind === 'classic' && p.parts[0]).toEqual({ index: 1, left: command, right: command });
  });

  it('commande vide : rien à copier', () => {
    const p = draftPreview(draft({ command: '  ' }));
    expect(p.kind === 'classic' && p.parts[0]).toEqual({ index: 1, left: null, right: null });
  });

  it('deux étapes : quatre résultats (étape × bouton)', () => {
    const command = '/zaap 5 -18;/travel 1 1';
    const command2 = '/zaap 1 2;/travel 2 2';
    const p = draftPreview(draft({ category: 'npc', twoStep: true, command, command2 }));
    expect(p).toEqual({
      kind: 'classic',
      parts: [
        { index: 1, left: '/travel 1 1', right: command },
        { index: 2, left: '/travel 2 2', right: command2 },
      ],
    });
  });

  it('deux étapes cochées sur un Lieu-dit : une seule partie', () => {
    const p = draftPreview(draft({ category: 'place', twoStep: true, command2: '/travel 2 2' }));
    expect(p.kind === 'classic' && p.parts).toHaveLength(1);
  });

  it('Farm : identique à parseFarmRoute', () => {
    const command = '/zaap 1 2;/travel 1 1;/foo;/travel 1 1';
    expect(draftPreview(draft({ category: 'farm', command }))).toEqual({
      kind: 'farm',
      route: parseFarmRoute(command),
    });
  });
});

describe('modifications non enregistrées', () => {
  it('faux à l\'ouverture, vrai après une modification', () => {
    const d = dest({ id: 'a', name: 'A' });
    const initial = draftFromDestination(d);
    expect(isDraftDirty(initial, draftFromDestination(d))).toBe(false);
    expect(isDraftDirty(initial, { ...initial, command: `${initial.command} ` })).toBe(true);
    expect(isDraftDirty(initial, { ...initial, twoStep: true })).toBe(true);
    expect(isDraftDirty(initial, { ...initial, image: 'images/img-2.png' })).toBe(true);
    expect(isDraftDirty(emptyDraft(), emptyDraft())).toBe(false);
  });
});

describe('catalogue produit', () => {
  it('passe validateCatalog pour chaque catégorie', () => {
    let c = catalog();
    c = upsertDestination(c, draft({ name: 'P', category: 'npc', twoStep: true, command2: '/travel 2 2' })).catalog;
    c = upsertDestination(c, draft({ name: 'D', category: 'dungeon', image: 'images/img-1.webp' })).catalog;
    c = upsertDestination(c, draft({ name: 'L', category: 'place', aliases: 'l', tags: 't' })).catalog;
    c = upsertDestination(c, draft({ name: 'F', category: 'farm', command: '/travel 1 1;/travel 1 1' })).catalog;
    c = upsertDestination(c, draft({ name: 'P' })).catalog;
    const v = validateCatalog(c);
    expect(v.ok).toBe(true);
    expect(c.destinations.map((d) => d.id)).toEqual(['p', 'd', 'l', 'f', 'p-2']);
  });
});
