import { describe, expect, it } from 'vitest';
import { mergeOfficial, parseOfficialState } from '../src/features/catalog/official';
import { validateCatalog, type Catalog, type Destination } from '../src/features/catalog/schema';

/** Coordonnées fictives (invariant 7). */
function dest(id: string, command = '/travel 1 1'): Destination {
  const r = validateCatalog({ schemaVersion: 3, destinations: [{ id, name: id, category: 'place', command }] });
  if (!r.ok) throw new Error('fixture invalide');
  return r.catalog.destinations[0] as Destination;
}
const catalog = (...destinations: Destination[]): Catalog => ({ schemaVersion: 3, destinations });

const official = [dest('officiel-a'), dest('officiel-b'), dest('officiel-c')];

describe('mergeOfficial', () => {
  it('catalogue existant sans état : ajoute toutes les entrées absentes, à la fin', () => {
    const user = catalog(dest('perso'), dest('officiel-b', '/travel 9 9'));
    const m = mergeOfficial(user, official, new Set());
    expect(m.catalog.destinations.map((d) => d.id)).toEqual(['perso', 'officiel-b', 'officiel-a', 'officiel-c']);
    // L'entrée modifiée par l'utilisateur n'est jamais remplacée.
    expect(m.catalog.destinations[1]?.command).toBe('/travel 9 9');
    expect(m.state?.known).toEqual(['officiel-a', 'officiel-b', 'officiel-c']);
  });

  it('une entrée déjà proposée puis supprimée ne revient pas', () => {
    const user = catalog(dest('officiel-a'));
    const m = mergeOfficial(user, official, new Set(['officiel-a', 'officiel-b', 'officiel-c']));
    expect(m.added).toEqual([]);
    expect(m.catalog).toBe(user);
    expect(m.state).toBeNull();
  });

  it('nouvelle version livrée : seules les nouvelles entrées arrivent', () => {
    const user = catalog(dest('officiel-a'));
    const m = mergeOfficial(user, [...official, dest('officiel-d')], new Set(['officiel-a', 'officiel-b', 'officiel-c']));
    expect(m.added.map((d) => d.id)).toEqual(['officiel-d']);
    expect(m.state?.known).toContain('officiel-d');
  });

  it('idempotent et sans mutation', () => {
    const user = catalog(dest('perso'));
    const before = JSON.stringify(user);
    const first = mergeOfficial(user, official, new Set());
    expect(JSON.stringify(user)).toBe(before);
    const second = mergeOfficial(first.catalog, official, new Set(first.state?.known));
    expect(second.added).toEqual([]);
    expect(second.state).toBeNull();
    expect(second.catalog).toBe(first.catalog);
    // Les entrées de l'utilisateur gardent leur identité.
    expect(first.catalog.destinations[0]).toBe(user.destinations[0]);
  });

  it('nouvel utilisateur (seed déjà copié) : rien à ajouter, état mémorisé', () => {
    const m = mergeOfficial(catalog(...official), official, new Set());
    expect(m.added).toEqual([]);
    expect(m.state?.known).toEqual(['officiel-a', 'officiel-b', 'officiel-c']);
  });
});

describe('parseOfficialState', () => {
  it('fichier absent : rien de proposé', () => {
    const r = parseOfficialState(undefined);
    expect(r.ok && r.known.size).toBe(0);
  });

  it('lit la liste, ignore ce qui n\'est pas un texte', () => {
    const r = parseOfficialState({ schemaVersion: 1, known: ['officiel-a', 3, null] });
    expect(r.ok && [...r.known]).toEqual(['officiel-a']);
  });

  it('forme inattendue ou version plus récente : refus (rien ne sera ajouté ni écrit)', () => {
    expect(parseOfficialState({ known: 'x' }).ok).toBe(false);
    expect(parseOfficialState([]).ok).toBe(false);
    expect(parseOfficialState({ schemaVersion: 2, known: [] }).ok).toBe(false);
  });
});
