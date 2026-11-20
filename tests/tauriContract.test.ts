/**
 * Contrat entre l'interface, Rust et les feuilles de style : noms de commandes, d'événements et
 * dimensions qui doivent rester identiques des deux côtés. Les fichiers sont lus bruts : une
 * divergence (commande renommée d'un seul côté, hauteur changée en CSS mais pas en Rust) casse ce
 * test au lieu d'échouer en silence dans l'application installée.
 */
import { describe, expect, it } from 'vitest';
import buildRs from '../src-tauri/build.rs?raw';
import libRs from '../src-tauri/src/lib.rs?raw';
import farmRs from '../src-tauri/src/farm_window.rs?raw';
import paletteRs from '../src-tauri/src/palette.rs?raw';
import storageRs from '../src-tauri/src/storage.rs?raw';
import { PALETTE_BAR_HEIGHT, PALETTE_VISIBLE_ROWS } from '../src/features/palette/windowHeight';
import { FARM_OPEN_EVENT } from '../src/lib/tauri/farm';
import { PALETTE_HIDDEN_EVENT, PALETTE_SHOWN_EVENT } from '../src/lib/tauri/palette';
import { STORE_CHANGED_EVENT } from '../src/lib/tauri/storeRead';

/**
 * Vitest remplace toute feuille de style par un module vide, `?raw` compris : palette.css est
 * donc lue sur le disque (import dynamique, le projet ne déclare pas les types de Node).
 */
const fs = (await import('node:' + 'fs')) as { readFileSync(path: URL, encoding: 'utf8'): string };
const paletteCss = fs.readFileSync(new URL('../src/styles/palette.css', import.meta.url), 'utf8');

/** Texte brut de chaque fichier TypeScript de `src/`. */
const sources: Record<string, string> = import.meta.glob(['../src/**/*.ts', '../src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Commandes déclarées à Tauri (`COMMANDS` de `build.rs`). */
function declaredCommands(): string[] {
  const block = /const COMMANDS: &\[&str\] = &\[([\s\S]*?)\];/.exec(buildRs);
  expect(block, 'liste COMMANDS introuvable dans build.rs').not.toBeNull();
  return [...block![1]!.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!);
}

/** Valeur d'une constante Rust `const NOM: type = valeur;` (texte brut de la valeur). */
function rustConst(source: string, name: string): string {
  const match = new RegExp(`const ${name}: [^=]+= ([^;]+);`).exec(source);
  expect(match, `${name} introuvable`).not.toBeNull();
  return match![1]!.trim();
}

describe('contrat interface ↔ Rust', () => {
  it('chaque commande appelée par l’interface est déclarée dans build.rs', () => {
    const declared = new Set(declaredCommands());
    const called = new Set<string>();
    for (const text of Object.values(sources)) {
      // invoke('nom') et invoke<T>('nom'), puis les constantes `*_COMMAND = 'nom'`.
      for (const m of text.matchAll(/\binvoke(?:<[^>]*>)?\(\s*'([a-z_]+)'/g)) called.add(m[1]!);
      for (const m of text.matchAll(/\b[A-Z_]+_COMMAND = '([a-z_]+)'/g)) called.add(m[1]!);
    }
    expect(called.size).toBeGreaterThan(10);
    expect([...called].filter((c) => !declared.has(c))).toEqual([]);
  });

  it('build.rs et generate_handler! listent les mêmes commandes', () => {
    const block = /generate_handler!\[([\s\S]*?)\]/.exec(libRs);
    expect(block).not.toBeNull();
    const handled = [...block![1]!.matchAll(/\w+::(\w+)/g)].map((m) => m[1]!);
    expect([...handled].sort()).toEqual([...declaredCommands()].sort());
  });

  it('événements : mêmes noms que les constantes Rust', () => {
    expect(rustConst(paletteRs, 'SHOWN_EVENT')).toBe(JSON.stringify(PALETTE_SHOWN_EVENT));
    expect(rustConst(paletteRs, 'HIDDEN_EVENT')).toBe(JSON.stringify(PALETTE_HIDDEN_EVENT));
    expect(rustConst(storageRs, 'STORE_CHANGED_EVENT')).toBe(JSON.stringify(STORE_CHANGED_EVENT));
    expect(rustConst(farmRs, 'OPEN_EVENT')).toBe(JSON.stringify(FARM_OPEN_EVENT));
    expect(rustConst(farmRs, 'FARM_LABEL')).toBe('"farm"');
  });
});

describe('contrat palette ↔ Rust ↔ CSS', () => {
  it('hauteur de la barre seule : BAR_HEIGHT de palette.rs', () => {
    expect(Number(rustConst(paletteRs, 'BAR_HEIGHT'))).toBe(PALETTE_BAR_HEIGHT);
  });

  it('lignes visibles : --pal-max-rows de palette.css', () => {
    const match = /--pal-max-rows:\s*(\d+);/.exec(paletteCss);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(PALETTE_VISIBLE_ROWS);
  });
});
