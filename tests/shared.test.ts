import { describe, expect, it } from 'vitest';
import { isCoordinate, MAX_COORDINATE } from '../src/features/shared/coordinates';
import { formatValidationErrors } from '../src/features/catalog/schema';
import { errorText } from '../src/features/shared/errors';
import { isRecord, newerSchemaVersion, parseJsonText } from '../src/features/shared/json';

describe('lecture JSON partagée', () => {
  it('isRecord : objet seulement', () => {
    expect(isRecord({})).toBe(true);
    for (const v of [null, [], 'x', 1, undefined]) expect(isRecord(v)).toBe(false);
  });

  it('newerSchemaVersion : seulement un nombre plus grand que la version courante', () => {
    expect(newerSchemaVersion({ schemaVersion: 4 }, 3)).toBe(4);
    expect(newerSchemaVersion({ schemaVersion: 3 }, 3)).toBeNull();
    expect(newerSchemaVersion({ schemaVersion: '9' }, 3)).toBeNull();
    expect(newerSchemaVersion({}, 3)).toBeNull();
  });

  it('parseJsonText : fichier absent, texte valide, texte invalide, sans jamais lever', () => {
    expect(parseJsonText(null)).toEqual({ ok: true, data: undefined });
    expect(parseJsonText('{"a":1}')).toEqual({ ok: true, data: { a: 1 } });
    expect(parseJsonText('null')).toEqual({ ok: true, data: null });
    expect(parseJsonText('{')).toEqual({ ok: false });
    expect(parseJsonText('')).toEqual({ ok: false });
  });

  it('formatValidationErrors : chemin et message, séparateur au choix', () => {
    const errors = [
      { path: '', message: 'catalog.json illisible' },
      { path: 'destinations[0].id', message: 'vide' },
    ];
    expect(formatValidationErrors(errors, ' · ')).toBe('catalog.json illisible · destinations[0].id vide');
    expect(formatValidationErrors(errors, '\n')).toBe('catalog.json illisible\ndestinations[0].id vide');
  });
});

describe('errorText', () => {
  it('Error, chaîne, objet { message } et valeur quelconque', () => {
    expect(errorText(new Error('perdu'))).toBe('perdu');
    expect(errorText('refus de Rust')).toBe('refus de Rust');
    expect(errorText({ message: 'du plugin' })).toBe('du plugin');
    expect(errorText(42)).toBe('42');
    expect(errorText({ message: 3 })).toBe('[object Object]');
  });

  it('ne lève jamais, même sans toString', () => {
    expect(errorText(Object.create(null))).toBe('');
  });
});

describe('coordonnées tapées', () => {
  it('entières et bornées des deux côtés', () => {
    expect(isCoordinate(MAX_COORDINATE)).toBe(true);
    expect(isCoordinate(-MAX_COORDINATE)).toBe(true);
    expect(isCoordinate(MAX_COORDINATE + 1)).toBe(false);
    expect(isCoordinate(1.5)).toBe(false);
    expect(isCoordinate('1')).toBe(false);
  });
});
