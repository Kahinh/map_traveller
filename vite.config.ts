/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration adaptée à Tauri 2 : port fixe, pas d'écran d'erreur masquant les logs Rust.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'chrome105',
    sourcemap: false,
    // Deux pages : la fenêtre principale et la palette (paquet séparé, sans la grille).
    // Chemins relatifs à la racine du projet, d'où sont lancés npm et Tauri.
    rolldownOptions: {
      input: {
        main: 'index.html',
        palette: 'palette.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
