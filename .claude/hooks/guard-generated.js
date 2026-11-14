#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit) : bloque l'édition de fichiers générés.
// Entrée : JSON du hook sur stdin. Sortie code 2 = blocage, stderr renvoyé à Claude.
const fs = require('fs');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch (_) {
  process.exit(0);
}

const filePath = String((input.tool_input && input.tool_input.file_path) || '').replace(/\\/g, '/');

const GENERATED = [
  { re: /\/node_modules\//, why: 'dépendance installée' },
  { re: /\/dist\//, why: 'build Vite' },
  { re: /\/src-tauri\/target\//, why: 'build Rust/Tauri' },
  { re: /\/src-tauri\/gen\//, why: 'schémas générés par Tauri' },
  { re: /\/package-lock\.json$/, why: 'lockfile npm (passer par npm install)' },
  { re: /\/src-tauri\/Cargo\.lock$/, why: 'lockfile Cargo (passer par cargo)' },
];

for (const g of GENERATED) {
  if (g.re.test(filePath)) {
    console.error(`BLOCK: ${filePath} est un fichier généré (${g.why}). Modifier la source à la place.`);
    process.exit(2);
  }
}
process.exit(0);
