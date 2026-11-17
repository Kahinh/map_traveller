import { describe, expect, it } from 'vitest';
import { isCoordinate, MAX_COORDINATE } from '../src/features/shared/coordinates';
import { isRecord, newerSchemaVersion } from '../src/features/shared/json';

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
