// Le catalogue de démonstration sert aux contrôles visuels (voir CLAUDE.md, « Validation de
// l'interface »). Ce test l'empêche de pourrir quand le schéma évolue. Coordonnées FICTIVES.
import { describe, expect, it } from 'vitest';
import demo from './fixtures/demo-catalog.json';
import { CATEGORIES, validateCatalog } from '../src/features/catalog/schema';
import { isTwoStep } from '../src/features/commands/cardParts';
import { isValidFarmRoute, parseFarmRoute } from '../src/features/farm/farmRoute';

describe('catalogue de démonstration', () => {
  const result = validateCatalog(demo);

  it('est valide au schéma courant', () => {
    expect(result.ok).toBe(true);
  });

  it('couvre chaque cas à contrôler à l\'écran', () => {
    if (!result.ok) return;
    const all = result.catalog.destinations;
    for (const category of CATEGORIES) expect(all.some((d) => d.category === category)).toBe(true);
    expect(all.some(isTwoStep)).toBe(true);
    expect(all.some((d) => d.command.trim() === '')).toBe(true);
    expect(all.some((d) => d.name.length > 24)).toBe(true);
    // Un parcours qui repasse par la même position, et un parcours avec Zaap initial.
    const farms = all.filter((d) => d.category === 'farm').map((d) => parseFarmRoute(d.command));
    expect(farms.every(isValidFarmRoute)).toBe(true);
    expect(farms.some((r) => new Set(r.steps.map((s) => s.label)).size < r.steps.length)).toBe(true);
    expect(farms.some((r) => r.zaapPrefix !== null)).toBe(true);
  });
});
