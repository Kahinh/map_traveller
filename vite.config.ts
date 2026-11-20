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
    // Trois pages : la fenêtre principale, la palette et la fenêtre d'un parcours Farm (paquets
    // séparés : ni la palette ni la fenêtre Farm n'embarquent la grille).
    // Chemins relatifs à la racine du projet, d'où sont lancés npm et Tauri.
    rolldownOptions: {
      input: {
        main: 'index.html',
        palette: 'palette.html',
        farm: 'farm.html',
      },
      // Code commun aux deux pages dans des fichiers nommés d'après leur contenu : React d'une
      // part, nos modules partagés d'autre part. Sans ces groupes, le morceau commun prend le nom
      // d'un de nos modules (« storage ») et masque ce qu'il contient.
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 2 },
            { name: 'shared', minShareCount: 2, priority: 1 },
          ],
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
