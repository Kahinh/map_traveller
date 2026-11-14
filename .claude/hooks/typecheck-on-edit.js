#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit) : lance `npm run typecheck` après l'édition d'un
// fichier .ts/.tsx du front. En cas d'erreur, renvoie la sortie à Claude (code 2).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch (_) {
  process.exit(0);
}

const filePath = String((input.tool_input && input.tool_input.file_path) || '').replace(/\\/g, '/');
if (!/\.(ts|tsx)$/.test(filePath) || filePath.includes('/node_modules/')) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
if (!fs.existsSync(path.join(root, 'node_modules', 'typescript'))) process.exit(0);

try {
  execSync('npm run typecheck --silent', { cwd: root, stdio: 'pipe' });
} catch (e) {
  const out = ((e.stdout && e.stdout.toString()) || '') + ((e.stderr && e.stderr.toString()) || '');
  console.error('[typecheck] Erreurs TypeScript après cette édition :\n' + out.slice(0, 4000));
  process.exit(2);
}
process.exit(0);
