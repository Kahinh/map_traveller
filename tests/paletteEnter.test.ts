import { describe, expect, it } from 'vitest';
import type { Destination } from '../src/features/catalog/schema';
import { createCopyGate, enterChoice, variantText, type ShownResults } from '../src/features/palette/enter';
import { buildPaletteIndex, PALETTE_LIMIT, searchPalette } from '../src/features/palette/entries';
import { initialNav, type NavState } from '../src/features/palette/navigation';
import { summarize } from '../src/features/palette/percentiles';
import { makeDestination } from './helpers/destination';

// Coordonnées fictives uniquement.
const list: Destination[] = [
  makeDestination({ id: 'rdeux', name: 'Rdeux fictif', command: '/zaap 1 1;/travel 2 2' }),
  makeDestination({ id: 'trone', name: 'Trône fictif', aliases: ['RDV'], command: '/zaap 3 3;/travel 4 4' }),
];
const index = buildPaletteIndex(list);
const search = (q: string) => searchPalette(index, q, { limit: PALETTE_LIMIT }).entries;
/** Résultats tels que la palette les afficherait après le rendu de `query`. */
const shown = (query: string): ShownResults => ({ query, entries: query.trim() === '' ? [] : search(query) });
const navOf = (s: ShownResults): NavState => initialNav(s.entries.length);

describe('Entrée sur la dernière valeur saisie (issue n°24)', () => {
  it('r, d, v, Entrée sans rendu entre V et Entrée : la commande de « rdv », copiée une seule fois', () => {
    // Le dernier rendu est celui de « rd » : sa première ligne n'est PAS celle de « rdv ».
    const rendered = shown('rd');
    expect(rendered.entries[0]?.destinationId).toBe('rdeux');
    const copies: string[] = [];
    const gate = createCopyGate();
    const pressEnter = (value: string) => {
      const chosen = enterChoice(value, rendered, navOf(rendered), false, search);
      if (chosen?.text != null && gate.acquire()) copies.push(chosen.text);
    };
    pressEnter('rdv');
    pressEnter('rdv'); // seconde Entrée avant le masquage
    expect(copies).toEqual(['/travel 4 4']);
  });

  it('résultats à jour : la ligne et la case sélectionnées', () => {
    const rendered = shown('rd');
    const choice = enterChoice('rd', rendered, { index: 1, choice: 1 }, false, () => {
      throw new Error('aucune recherche quand le rendu est à jour');
    });
    expect(choice).toMatchObject({ entry: { destinationId: 'trone' }, text: '/zaap 3 3;/travel 4 4' });
  });

  it('Ctrl+Entrée : l\'autre variante, y compris quand la recherche est refaite', () => {
    expect(enterChoice('rd', shown('rd'), { index: 0, choice: 0 }, true, search)?.text).toBe('/zaap 1 1;/travel 2 2');
    expect(enterChoice('rdv', shown('r'), { index: 0, choice: 1 }, true, search)?.text).toBe('/zaap 3 3;/travel 4 4');
  });

  it('résultats en retard : la sélection affichée est ignorée, première ligne en variante par défaut', () => {
    const choice = enterChoice('rdv', shown('rd'), { index: 1, choice: 1 }, false, search);
    expect(choice?.text).toBe('/travel 4 4');
  });

  it('champ vide ou blanc : jamais de copie, même avec des résultats affichés en retard', () => {
    const rendered = shown('rd');
    expect(enterChoice('', rendered, navOf(rendered), false, search)).toBeNull();
    expect(enterChoice('   ', rendered, navOf(rendered), false, search)).toBeNull();
  });

  it('aucun résultat : rien', () => {
    expect(enterChoice('zzz', shown('rd'), navOf(shown('rd')), false, search)).toBeNull();
    expect(enterChoice('zzz', shown('zzz'), navOf(shown('zzz')), false, search)).toBeNull();
  });

  it('ligne sans commande : choisie, mais rien à copier (avertissement)', () => {
    const empty = buildPaletteIndex([makeDestination({ id: 'vide', name: 'Vide', command: '  ' })]);
    const choice = enterChoice('vide', { query: '', entries: [] }, initialNav(0), false, (q) =>
      searchPalette(empty, q, { limit: PALETTE_LIMIT }).entries,
    );
    expect(choice).toMatchObject({ entry: { destinationId: 'vide' }, text: null });
  });
});

describe('variante copiée', () => {
  const [entry] = search('rdv');
  it('case bornée, autre variante sur demande', () => {
    expect(entry && variantText(entry, 0, false)).toBe('/travel 4 4');
    expect(entry && variantText(entry, 7, false)).toBe('/zaap 3 3;/travel 4 4');
    expect(entry && variantText(entry, -1, true)).toBe('/zaap 3 3;/travel 4 4');
  });
});

describe('garde anti double copie', () => {
  it('prise une fois, libérée après la copie ou son échec', () => {
    const gate = createCopyGate();
    expect(gate.acquire()).toBe(true);
    expect(gate.acquire()).toBe(false);
    gate.release();
    expect(gate.acquire()).toBe(true);
  });
});

describe('percentiles (instrumentation)', () => {
  it('rang le plus proche ; série vide : zéros', () => {
    const samples = Array.from({ length: 100 }, (_, i) => 100 - i);
    expect(summarize(samples)).toEqual({ count: 100, p50: 50, p95: 95, p99: 99 });
    expect(summarize([3])).toEqual({ count: 1, p50: 3, p95: 3, p99: 3 });
    expect(summarize([])).toEqual({ count: 0, p50: 0, p95: 0, p99: 0 });
    expect(samples[0]).toBe(100); // la série d'origine n'est pas triée sur place
  });
});
