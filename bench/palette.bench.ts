// Benchmarks reproductibles de la palette (issue n°24) : `npm run bench:palette`.
//
// Catalogues FICTIFS (noms inventés, coordonnées fictives) de 100, 1 000 et 10 000 destinations,
// chacune avec deux alias de fiche, plus un dictionnaire global de 40 termes. Mesures en Node :
// ce ne sont pas celles de WebView2 sous Windows (voir docs/perf-palette.md et la recette).
//
// Chaque requête est mesurée « à froid » : le cache des coûts par mot est vidé avant chaque
// essai, comme pour la première frappe d'un mot. En frappe réelle, les mots déjà tapés sont
// repris du cache et coûtent moins.
import { describe, it } from 'vitest';
import { buildDictionary, type AliasEntry } from '../src/features/aliases/aliases';
import type { Destination } from '../src/features/catalog/schema';
import { buildPaletteIndex, PALETTE_LIMIT, searchPalette } from '../src/features/palette/entries';
import { percentile, summarize } from '../src/features/palette/percentiles';

// Node, sans dépendre de @types/node (le projet n'en a pas besoin ailleurs).
declare const process: {
  version: string;
  platform: string;
  arch: string;
  memoryUsage(): { heapUsed: number };
};

const SIZES = [100, 1_000, 10_000] as const;
const RUNS = 200;

const KINDS = ['Hôtel des ventes', 'Atelier des bijoutiers', 'Donjon', 'Temple', 'Comptoir', 'Pont', 'Grotte', 'Tour', 'Marché', 'Repaire'];
const ADJECTIVES = ['ancien', 'brumeux', 'cristallin', 'dorée', 'écarlate', 'fendu', 'gelé', 'hanté', 'immense', 'jaspé'];
const CATEGORIES = ['place', 'dungeon', 'npc'] as const;

/** Mot inventé et propre à la destination i (« Vilbo12 »). */
const town = (i: number) => `Vil${i.toString(36)}`;

function destination(i: number): Destination {
  const kind = KINDS[i % KINDS.length] as string;
  const adjective = ADJECTIVES[Math.floor(i / KINDS.length) % ADJECTIVES.length] as string;
  return {
    id: `d${i}`,
    name: `${kind} ${adjective} de ${town(i)}`,
    category: CATEGORIES[i % CATEGORIES.length] as Destination['category'],
    zone: `Zone fictive ${i % 50}`,
    // Un alias court propre à la fiche (« k2s ») et un alias de deux mots.
    aliases: [`k${i.toString(36)}`, `${adjective} ${town(i)}`],
    tags: [`tag${i % 25}`],
    image: null,
    command: `/zaap 1 1;/travel ${i % 30} ${-(i % 17)}`,
    sortOrder: 0,
    enabled: true,
    twoStep: false,
    command2: '',
  };
}

function catalog(size: number): Destination[] {
  const list = Array.from({ length: size }, (_, i) => destination(i));
  // La destination de l'issue : « rdv » doit la trouver au rang 1, quelle que soit la taille.
  list.push({ ...destination(size), id: 'reine', name: 'Reine des Voleurs', aliases: ['RDV'] });
  return list;
}

const DICTIONARY_ENTRIES: AliasEntry[] = [
  { term: 'hdv', expansions: ['hôtel des ventes'] },
  { term: 'bij', expansions: ['atelier des bijoutiers'] },
  ...Array.from({ length: 38 }, (_, i) => ({ term: `t${i}x`, expansions: [`${ADJECTIVES[i % ADJECTIVES.length]} ${KINDS[i % KINDS.length]}`] })),
];

const ms = (n: number) => n.toFixed(n < 1 ? 3 : 2);

function heapUsed(): number {
  (globalThis as { gc?: () => void }).gc?.();
  return process.memoryUsage().heapUsed;
}

interface Row {
  size: number;
  label: string;
  p50: number;
  p95: number;
  p99: number;
}


describe('benchmark de la palette', () => {
  it('mesures', () => {
    const rows: Row[] = [];
    const builds: { size: number; build: number[]; heap: number; first: string }[] = [];
    const dictionary = buildDictionary(DICTIONARY_ENTRIES, { custom: [], disabledDefaults: [] });

    for (const size of SIZES) {
      const list = catalog(size);
      // Construction : médiane de quelques essais, mémoire de l'index retenu.
      const buildTimes: number[] = [];
      for (let k = 0; k < 7; k++) {
        const t = performance.now();
        buildPaletteIndex(list, dictionary);
        buildTimes.push(performance.now() - t);
      }
      const before = heapUsed();
      const index = buildPaletteIndex(list, dictionary);
      const heap = heapUsed() - before;
      const first = searchPalette(index, 'rdv', { limit: PALETTE_LIMIT }).entries[0]?.title ?? '(rien)';
      builds.push({ size, build: buildTimes.sort((a, b) => a - b), heap, first });

      const pick = (k: number) => Math.floor((k * 7919) % size);
      const queries: [string, (k: number) => string][] = [
        ['alias de fiche exact', (k) => `k${pick(k).toString(36)}`],
        ['alias global exact (hdv)', () => 'hdv'],
        ['« rdv »', () => 'rdv'],
        ['1 lettre', (k) => 'abcdefghijklmnoprstv'[k % 20] as string],
        ['2 lettres', (k) => ['ho', 'at', 'do', 'te', 'co', 'po', 'gr', 'to', 'ma', 're'][k % 10] as string],
        ['3 lettres', (k) => ['hot', 'ate', 'don', 'tem', 'com', 'pon', 'gro', 'tou', 'mar', 'rep'][k % 10] as string],
        ['deux mots', (k) => `${(KINDS[pick(k) % KINDS.length] as string).split(' ')[0]} ${town(pick(k))}`],
        ['faute de frappe', (k) => ['atelyer', 'donjom', 'tempel', 'comptoit', 'grote'][k % 5] as string],
      ];
      for (const [label, make] of queries) {
        const times: number[] = [];
        for (let k = 0; k < RUNS; k++) {
          const q = make(k);
          index.search.cache.clear();
          const t = performance.now();
          searchPalette(index, q, { limit: PALETTE_LIMIT });
          times.push(performance.now() - t);
        }
        rows.push({ size, label, ...summarize(times) });
      }
    }

    const out: string[] = [];
    out.push(`Node ${process.version}, ${process.platform} ${process.arch}, ${RUNS} essais par requête (cache vidé à chaque essai)`);
    out.push('');
    out.push('| Destinations | Construction de l\'index (médiane) | Mémoire de l\'index | Rang 1 de « rdv » |');
    out.push('|---:|---:|---:|---|');
    for (const b of builds) {
      out.push(`| ${b.size} | ${ms(percentile(b.build, 50))} ms | ${(b.heap / 1e6).toFixed(1)} Mo | ${b.first} |`);
    }
    out.push('');
    out.push('| Destinations | Requête | p50 (ms) | p95 (ms) | p99 (ms) |');
    out.push('|---:|---|---:|---:|---:|');
    for (const r of rows) out.push(`| ${r.size} | ${r.label} | ${ms(r.p50)} | ${ms(r.p95)} | ${ms(r.p99)} |`);
    console.log(out.join('\n'));
  });
});
