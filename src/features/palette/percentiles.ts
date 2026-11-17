/**
 * Percentiles d'une série de durées (instrumentation de la palette, benchmarks). Fonction pure.
 * Méthode du rang le plus proche : p95 est la plus petite valeur dont au moins 95 % des mesures
 * sont inférieures ou égales.
 */

export interface DurationSummary {
  count: number;
  p50: number;
  p95: number;
  p99: number;
}

/** Valeur au percentile `p` (0 à 100) d'une série TRIÉE par ordre croissant ; 0 si elle est vide. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] as number;
}

/** Nombre de mesures et percentiles 50, 95 et 99 d'une série quelconque (non modifiée). */
export function summarize(samples: readonly number[]): DurationSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  return { count: sorted.length, p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99) };
}
