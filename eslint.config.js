import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src-tauri/target', 'src-tauri/gen', '.claude', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    // Scripts d'outillage (Node) : même socle de règles, globales de Node.
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node },
  },
  {
    // Les fonctions pures ne doivent dépendre ni de Tauri ni de React.
    files: ['src/features/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['@tauri-apps/*', 'react', 'react-dom', '**/lib/tauri/*', '**/components/*'] },
      ],
    },
  },
);
