import { describe, expect, it } from 'vitest';
import seed from '../resources/catalog.seed.json';
import { validateCatalog, type Destination } from '../src/features/catalog/schema';
import { DEFAULT_ZAAPS } from '../src/features/zaaps/defaultZaaps';
import { nearestZaaps, zaapTripCommand, type Zaap } from '../src/features/zaaps/zaaps';

/**
 * Catalogue livré (issue n°8), fabriqué par `scripts/catalog/build-official-catalog.mjs`. Ces
 * tests recalculent chaque commande avec les fonctions de l'application : le générateur ne peut
 * pas diverger de la règle « zaap le plus proche, puis /travel ».
 */
const checked = validateCatalog(seed);
const destinations: Destination[] = checked.ok ? checked.catalog.destinations : [];
const TRAVEL = /^\/travel (-?\d+) (-?\d+)$/;

function zaapOf(segment: string): Zaap | undefined {
  return DEFAULT_ZAAPS.zaaps.find((z) => z.command === segment);
}

describe('catalogue livré', () => {
  it('est valide, au schéma 3, avec des identifiants livrés stables', () => {
    expect(checked.ok).toBe(true);
    expect(destinations.length).toBeGreaterThan(300);
    for (const d of destinations) expect(d.id).toMatch(/^officiel-[a-z0-9-]+$/);
  });

  it('couvre PNJ, donjons et lieux (HDV, ateliers)', () => {
    const count = (c: string) => destinations.filter((d) => d.category === c).length;
    expect(count('npc')).toBeGreaterThan(20);
    expect(count('dungeon')).toBeGreaterThan(100);
    expect(count('place')).toBeGreaterThan(150);
  });

  it('chaque entrée a une image livrée, et chaque image livrée sert', () => {
    const files = new Set(Object.keys(import.meta.glob('../resources/images/*')).map((p) => p.split('/').pop() ?? ''));
    const used = new Set<string>();
    for (const d of destinations) {
      expect(d.image, d.id).toMatch(/^images\/[a-z0-9-]+\.webp$/);
      const name = (d.image ?? '').slice('images/'.length);
      expect(files.has(name), `${d.id} : ${name}`).toBe(true);
      used.add(name);
    }
    expect([...files].filter((f) => !used.has(f))).toEqual([]);
  });

  it('commande = zaap le plus proche (même monde) puis /travel vers la cible', () => {
    let withZaap = 0;
    for (const d of destinations) {
      const [first, ...rest] = d.command.split(';');
      const zaap = zaapOf(first ?? '');
      if (!zaap) {
        // Monde sans zaap (Srambad, Xélorium…) : un seul /travel, à taper sur place.
        expect(d.command, d.id).toMatch(TRAVEL);
        continue;
      }
      withZaap++;
      expect(rest.length, d.id).toBeLessThanOrEqual(1);
      const m = rest.length === 1 ? TRAVEL.exec(rest[0] ?? '') : null;
      if (rest.length === 1) expect(m, d.id).not.toBeNull();
      const target = m ? { x: Number(m[1]), y: Number(m[2]) } : { x: zaap.x, y: zaap.y };
      const [nearest] = nearestZaaps(DEFAULT_ZAAPS.zaaps, target, zaap.world, 1);
      expect(nearest?.zaap.id, d.id).toBe(zaap.id);
      expect(d.command).toBe(zaapTripCommand(zaap, target));
    }
    expect(withZaap).toBeGreaterThan(250);
  });

  it('deux étapes : entrée par zaap, puis un /travel dans l\'autre monde', () => {
    const twoStep = destinations.filter((d) => d.twoStep);
    expect(twoStep.length).toBeGreaterThan(0);
    for (const d of twoStep) {
      expect(d.category).toBe('dungeon');
      expect(zaapOf(d.command.split(';')[0] ?? ''), d.id).toBeDefined();
      expect(d.command2, d.id).toMatch(TRAVEL);
    }
  });

  it('aucune entrée Farm ni coordonnée hors de la carte', () => {
    expect(destinations.some((d) => d.category === 'farm')).toBe(false);
    for (const d of destinations) {
      for (const part of [d.command, d.command2].join(';').matchAll(/-?\d+/g)) {
        expect(Math.abs(Number(part[0])), d.id).toBeLessThan(200);
      }
    }
  });
});
