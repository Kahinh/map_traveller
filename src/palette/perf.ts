/**
 * Instrumentation locale de la palette (issue n°24) : `performance.mark` / `measure` aux étapes
 * du parcours clavier, et résumé p50 / p95 / p99 dans la console (`window.__paletteStats()`).
 *
 * Rien ne sort de la machine (invariant 6) : les mesures restent en mémoire dans la page et ne
 * sont lues qu'à la main. Activée en développement (`npm run dev`, `tauri dev`) ou, dans
 * l'application installée, par le drapeau `localStorage` `map-traveller:perf` (valeur `1`, à
 * poser dans les outils de développement de la palette, puis rouvrir la palette).
 *
 * Désactivée : `perf` vaut `null`, et chaque point de mesure se réduit à `perf?.mark(…)`, une
 * seule condition, sans calcul ni allocation.
 */
import { summarize, type DurationSummary } from '../features/palette/percentiles';

/** Étapes marquées, dans l'ordre du parcours. */
export type PerfMark =
  | 'palette_shown'
  | 'palette_focused'
  | 'input_received'
  | 'search_done'
  | 'results_rendered'
  | 'enter_received'
  | 'clipboard_done';

/** Mesures : nom, étape de départ, étape d'arrivée. Une seule mesure par départ. */
const MEASURES: readonly (readonly [string, PerfMark, PerfMark])[] = [
  ['affichage → focus', 'palette_shown', 'palette_focused'],
  ['frappe → recherche', 'input_received', 'search_done'],
  ['frappe → rendu', 'input_received', 'results_rendered'],
  ['Entrée → presse-papiers', 'enter_received', 'clipboard_done'],
];

/** Mesures gardées par série : les plus anciennes sont oubliées. */
const MAX_SAMPLES = 1000;
const FLAG_KEY = 'map-traveller:perf';

export interface PerfRecorder {
  mark(name: PerfMark): void;
  stats(): Record<string, DurationSummary>;
}

function flagSet(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function createRecorder(): PerfRecorder {
  const at = new Map<PerfMark, number>();
  /** Départ déjà mesuré, par mesure : un second rendu de la même frappe ne compte pas deux fois. */
  const measuredFrom = new Map<string, number>();
  const samples = new Map<string, number[]>(MEASURES.map(([label]) => [label, []]));
  return {
    mark(name) {
      const now = performance.now();
      at.set(name, now);
      // Une seule marque par nom : le tampon des marques ne grossit pas avec la frappe.
      performance.clearMarks(name);
      performance.mark(name);
      for (const [label, start, end] of MEASURES) {
        const from = at.get(start);
        if (end !== name || from === undefined || measuredFrom.get(label) === from) continue;
        measuredFrom.set(label, from);
        const list = samples.get(label) as number[];
        list.push(now - from);
        if (list.length > MAX_SAMPLES) list.shift();
        performance.clearMeasures(label);
        performance.measure(label, start, end);
      }
    },
    stats() {
      return Object.fromEntries([...samples].map(([label, list]) => [label, summarize(list)]));
    },
  };
}

export const perf: PerfRecorder | null = import.meta.env.DEV || flagSet() ? createRecorder() : null;

if (perf) {
  (window as unknown as { __paletteStats: () => Record<string, DurationSummary> }).__paletteStats = () => {
    const stats = perf.stats();
    console.table(stats);
    return stats;
  };
}
