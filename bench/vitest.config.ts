import { defineConfig } from 'vitest/config';

// Benchmarks de la palette (`npm run bench:palette`), hors de `npm test` : ils durent plusieurs
// secondes et ne prouvent rien de plus que les garde-fous de tests/palettePerf.test.ts.
export default defineConfig({
  test: {
    include: ['bench/**/*.bench.ts'],
    environment: 'node',
    // Un seul processus, ramasse-miettes exposé : la mémoire mesurée est celle de l'index.
    pool: 'forks',
    execArgv: ['--expose-gc'],
    testTimeout: 600_000,
  },
});
