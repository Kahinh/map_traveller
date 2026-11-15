import { describe, expect, it } from 'vitest';
import defaultsJson from '../resources/aliases.default.json';
import {
  aliasesFileProblem,
  buildDictionary,
  listAliases,
  mergeUserAliases,
  normalizeTerm,
  parseDefaultAliases,
  parseUserAliases,
  removeAlias,
  setDefaultEnabled,
  splitExpansions,
  upsertAlias,
  validateAliasEntry,
  type AliasEntry,
  type UserAliases,
} from '../src/features/aliases/aliases';

const DEFAULTS: AliasEntry[] = [
  { term: 'hdv', expansions: ['hôtel des ventes'] },
  { term: 'rdv', expansions: ['reine des voleurs'] },
];
const EMPTY: UserAliases = { custom: [], disabledDefaults: [] };

describe('dictionnaire livré', () => {
  it('le fichier embarqué est valide et contient hdv et rdv', () => {
    const defaults = parseDefaultAliases(defaultsJson);
    expect(defaults.map((e) => e.term)).toEqual(['hdv', 'rdv']);
    for (const e of defaults) expect(validateAliasEntry(e, EMPTY)).toBeNull();
    expect(buildDictionary(defaults, EMPTY).get('hdv')).toEqual([['hotel', 'ventes']]);
  });

  it('contenu inattendu : liste vide, jamais d\'erreur', () => {
    expect(parseDefaultAliases(null)).toEqual([]);
    expect(parseDefaultAliases({ aliases: 'x' })).toEqual([]);
  });
});

describe('lecture des personnalisations (tolérante)', () => {
  it('fichier absent, vide ou illisible : rien, sans erreur', () => {
    for (const input of [undefined, null, 'x', 42, [], {}]) expect(parseUserAliases(input)).toEqual(EMPTY);
  });

  it('entrées invalides écartées une à une, les autres gardées', () => {
    const user = parseUserAliases({
      custom: [
        { term: 'BIJ', expansions: ['bijoutier', ' bijoutiers ', 'Bijoutier'] },
        { term: 'deux mots', expansions: ['x'] },
        { term: 'vide', expansions: ['de la'] },
        { term: 'bij', expansions: ['doublon de terme'] },
        { term: 'des', expansions: ['mot de liaison refusé comme à la saisie'] },
        { term: 12, expansions: ['x'] },
        'x',
      ],
      disabledDefaults: ['RDV', 'rdv', 7, 'deux mots'],
    });
    expect(user).toEqual({
      custom: [{ term: 'BIJ', expansions: ['bijoutier', 'bijoutiers'] }],
      disabledDefaults: ['rdv'],
    });
  });

  it('terme normalisé : un seul mot', () => {
    expect(normalizeTerm(' HDV ')).toBe('hdv');
    expect(normalizeTerm('Hôtel')).toBe('hotel');
    expect(normalizeTerm('deux mots')).toBeNull();
    expect(normalizeTerm('a-b')).toBeNull();
    expect(normalizeTerm('  ')).toBeNull();
  });
});

describe('écriture', () => {
  it('conserve les clés inconnues du fichier et remplace les siennes', () => {
    const user: UserAliases = { custom: [{ term: 'bij', expansions: ['bijoutier'] }], disabledDefaults: ['rdv'] };
    const merged = mergeUserAliases({ futur: { x: 1 }, custom: [], schemaVersion: 0 }, user);
    expect(merged).toEqual({
      futur: { x: 1 },
      schemaVersion: 1,
      custom: [{ term: 'bij', expansions: ['bijoutier'] }],
      disabledDefaults: ['rdv'],
    });
  });

  it('rien de ce que cette version ne comprend n\'est perdu : clés d\'une entrée, entrées illisibles', () => {
    const raw = {
      schemaVersion: 1,
      custom: [
        { term: 'bij', expansions: ['bijoutier'], note: 'gardée' },
        { term: 'deux mots', expansions: ['illisible ici'] },
        { term: 'bij', expansions: ['doublon écarté'] },
        'texte inattendu',
        { term: 'supprime', expansions: ['retiré par l\'utilisateur'] },
      ],
    };
    // L'utilisateur garde « bij » (modifié) et supprime « supprime ».
    const merged = mergeUserAliases(raw, { custom: [{ term: 'BIJ', expansions: ['bijoutiers'] }], disabledDefaults: [] });
    expect(merged.custom).toEqual([
      { term: 'BIJ', expansions: ['bijoutiers'], note: 'gardée' },
      { term: 'deux mots', expansions: ['illisible ici'] },
      'texte inattendu',
    ]);
  });

  it('fichier à ne jamais réécrire : version plus récente, racine qui n\'est pas un objet', () => {
    expect(aliasesFileProblem(undefined)).toBeNull();
    expect(aliasesFileProblem({})).toBeNull();
    expect(aliasesFileProblem({ schemaVersion: 1, custom: [] })).toBeNull();
    expect(aliasesFileProblem({ schemaVersion: 2 })).toMatch(/plus récente/);
    expect(aliasesFileProblem([])).toMatch(/objet/);
    expect(aliasesFileProblem('x')).toMatch(/objet/);
    // Lu au mieux pour la recherche, même s'il n'est pas modifiable.
    expect(parseUserAliases({ schemaVersion: 2, custom: [{ term: 'dj', expansions: ['donjon'] }] }).custom).toHaveLength(1);
  });

  it('relecture : ce qui est écrit se relit à l\'identique', () => {
    const user: UserAliases = { custom: [{ term: 'Bij', expansions: ['bijoutier', 'bijoutiers'] }], disabledDefaults: ['hdv'] };
    expect(parseUserAliases(JSON.parse(JSON.stringify(mergeUserAliases(undefined, user))))).toEqual(user);
  });
});

describe('dictionnaire effectif', () => {
  it('alias livrés, moins les désactivés, plus les personnalisés qui remplacent', () => {
    const user: UserAliases = {
      custom: [
        { term: 'HDV', expansions: ['hôtel de vente', 'comptoir'] },
        { term: 'bij', expansions: ['bijoutier'] },
      ],
      disabledDefaults: ['rdv'],
    };
    const dictionary = buildDictionary(DEFAULTS, user);
    expect([...dictionary.keys()].sort()).toEqual(['bij', 'hdv']);
    expect(dictionary.get('hdv')).toEqual([['hotel', 'vente'], ['comptoir']]);
  });

  it('liste affichée : triée, origine, état, remplacement signalé', () => {
    const user: UserAliases = { custom: [{ term: 'HDV', expansions: ['comptoir'] }], disabledDefaults: ['rdv'] };
    expect(listAliases(DEFAULTS, user)).toEqual([
      { key: 'hdv', term: 'HDV', expansions: ['comptoir'], origin: 'custom', enabled: true, overridesDefault: true },
      { key: 'rdv', term: 'rdv', expansions: ['reine des voleurs'], origin: 'default', enabled: false, overridesDefault: false },
    ]);
  });
});

describe('validation d\'une saisie', () => {
  const user: UserAliases = { custom: [{ term: 'bij', expansions: ['bijoutier'] }], disabledDefaults: [] };
  const check = (term: string, expansions: string[], previous?: string) =>
    validateAliasEntry({ term, expansions }, user, previous)?.message ?? null;

  it('saisie valide', () => {
    expect(check('dj', ['donjon'])).toBeNull();
    // Reprendre le terme d'un alias LIVRÉ est permis : il le remplace.
    expect(check('hdv', ['comptoir'])).toBeNull();
  });

  it('chaque refus a son message', () => {
    expect(check('  ', ['x'])).toMatch(/requis/);
    expect(check('deux mots', ['x'])).toMatch(/un seul mot/);
    expect(check('a-b', ['x'])).toMatch(/un seul mot/);
    expect(check('des', ['x'])).toMatch(/mot de liaison/);
    expect(check('x'.repeat(21), ['x'])).toMatch(/trop long/);
    expect(check('dj', [])).toMatch(/au moins une signification/);
    expect(check('dj', ['de la'])).toMatch(/au moins une signification/);
    expect(check('dj', ['x'.repeat(61)])).toMatch(/trop longue/);
    expect(check('dj', ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'])).toMatch(/8 significations/);
  });

  it('l\'erreur désigne le champ fautif', () => {
    expect(validateAliasEntry({ term: 'a b', expansions: ['x'] }, user)?.field).toBe('term');
    expect(validateAliasEntry({ term: 'dj', expansions: [] }, user)?.field).toBe('expansions');
  });

  it('terme personnalisé en double refusé, sauf pour l\'alias en cours de modification', () => {
    expect(check('BIJ', ['x'])).toMatch(/existe déjà/);
    expect(check('BIJ', ['x'], 'bij')).toBeNull();
    expect(check('dj', ['x'], 'bij')).toBeNull();
  });
});

describe('édition sans mutation', () => {
  const user: UserAliases = Object.freeze({
    custom: Object.freeze([Object.freeze({ term: 'bij', expansions: Object.freeze(['bijoutier']) })]),
    disabledDefaults: Object.freeze(['rdv']),
  }) as unknown as UserAliases;

  it('ajout, modification (terme changé ou non), suppression', () => {
    const added = upsertAlias(user, { term: ' DJ ', expansions: ['donjon', 'donjon', ' '] });
    expect(added.custom).toEqual([
      { term: 'bij', expansions: ['bijoutier'] },
      { term: 'DJ', expansions: ['donjon'] },
    ]);
    const edited = upsertAlias(added, { term: 'bijou', expansions: ['bijoutiers'] }, 'BIJ');
    expect(edited.custom.map((e) => e.term)).toEqual(['bijou', 'DJ']);
    expect(removeAlias(edited, 'dj').custom.map((e) => e.term)).toEqual(['bijou']);
    // Entrée intacte, nouveaux objets.
    expect(user.custom).toHaveLength(1);
    expect(added).not.toBe(user);
    expect(added.disabledDefaults).toEqual(['rdv']);
  });

  it('désactivation et réactivation d\'un alias livré', () => {
    const off = setDefaultEnabled(user, 'HDV', false);
    expect(off.disabledDefaults).toEqual(['rdv', 'hdv']);
    expect(setDefaultEnabled(off, 'hdv', false).disabledDefaults).toEqual(['rdv', 'hdv']);
    expect(setDefaultEnabled(off, 'rdv', true).disabledDefaults).toEqual(['hdv']);
    expect(user.disabledDefaults).toEqual(['rdv']);
  });

  it('significations d\'un champ : virgules ou points-virgules', () => {
    expect(splitExpansions(' hôtel des ventes , comptoir;; ')).toEqual(['hôtel des ventes', 'comptoir']);
  });
});
