#!/usr/bin/env node
// SessionStart : met à jour l'index CodeGraph (silencieux, jamais bloquant).
// Ne fait rien si la CLI `codegraph` n'est pas installée ou si l'index n'existe pas.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
if (!fs.existsSync(path.join(root, '.codegraph', 'codegraph.db'))) process.exit(0);

try {
  execSync('codegraph sync', { cwd: root, stdio: 'ignore', timeout: 55000 });
} catch (_) {
  // CLI absente, verrou ou timeout : on ignore, l'index sera resynchronisé plus tard.
}
process.exit(0);
