#!/usr/bin/env node
/**
 * Statusline Claude Code — idle_ogame
 * Affiche : branche git · modèle · % contexte · coût session · lignes +/-
 *
 * Inspiré des outils de monitoring (claude-hud / CodeBurn) mais 100% natif,
 * sans dépendance externe. Lit le JSON de session sur stdin (fourni par Claude Code).
 *
 * Robuste par construction : toute erreur d'une section est avalée et la section
 * est simplement omise. La statusline ne doit jamais faire échouer le rendu.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// --- Couleurs ANSI (dim pour rester discret dans le terminal) ---
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};
const paint = (s, color) => `${color}${s}${C.reset}`;

const CONTEXT_WINDOW = 200000; // seuil de référence Claude Code (exceeds_200k_tokens)

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

/**
 * Branche git courante, lue directement sur le système de fichiers (pas de
 * sous-processus : plus rapide pour la statusline et insensible au shell/PATH).
 * Remonte les répertoires parents jusqu'à trouver `.git`, gère les worktrees
 * (où `.git` est un fichier `gitdir: <chemin>`) et le mode detached HEAD.
 */
function gitBranch(cwd) {
  try {
    let dir = cwd;
    for (let depth = 0; depth < 64 && dir; depth++) {
      const dotGit = path.join(dir, '.git');
      let stat;
      try {
        stat = fs.statSync(dotGit);
      } catch (_) {
        stat = null;
      }
      if (stat) {
        let gitDir = dotGit;
        if (stat.isFile()) {
          // worktree : `.git` contient "gitdir: <chemin>"
          const m = fs.readFileSync(dotGit, 'utf8').match(/gitdir:\s*(.+)/);
          if (!m) return null;
          gitDir = path.resolve(dir, m[1].trim());
        }
        const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
        const ref = head.match(/ref:\s*refs\/heads\/(.+)/);
        if (ref) return ref[1];
        // HEAD détaché : sha court
        return /^[0-9a-f]{7,40}$/.test(head) ? head.slice(0, 7) : null;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Estime le contexte consommé en lisant la fin du transcript (JSONL).
 * On ne lit que la queue du fichier pour borner le coût à chaque rendu.
 * Le contexte ≈ input_tokens + cache_read + cache_creation du dernier message.
 */
function contextUsed(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
    const { size } = fs.statSync(transcriptPath);
    const TAIL = 256 * 1024;
    const start = Math.max(0, size - TAIL);
    const fd = fs.openSync(transcriptPath, 'r');
    const len = size - start;
    const buf = Buffer.allocUnsafe(len);
    fs.readSync(fd, buf, 0, len, start);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line || line.indexOf('"usage"') === -1) continue;
      try {
        const obj = JSON.parse(line);
        const u = obj && obj.message && obj.message.usage;
        if (!u) continue;
        const used =
          (u.input_tokens || 0) +
          (u.cache_read_input_tokens || 0) +
          (u.cache_creation_input_tokens || 0);
        if (used > 0) return used;
      } catch (_) {
        /* ligne tronquée par le TAIL : on ignore */
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

function fmtCost(usd) {
  if (typeof usd !== 'number' || !isFinite(usd)) return null;
  return usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`;
}

function main() {
  let data = {};
  try {
    data = JSON.parse(readStdin() || '{}');
  } catch (_) {
    data = {};
  }

  const cwd =
    (data.workspace && data.workspace.current_dir) || data.cwd || process.cwd();
  const parts = [];

  // Branche git
  const branch = gitBranch(cwd);
  if (branch) parts.push(paint(` ${branch}`, C.magenta));

  // Modèle
  const model =
    (data.model && (data.model.display_name || data.model.id)) || null;
  if (model) parts.push(paint(model, C.cyan));

  // Contexte
  const used = contextUsed(data.transcript_path);
  if (used != null) {
    const pct = Math.min(100, Math.round((used / CONTEXT_WINDOW) * 100));
    const k = (used / 1000).toFixed(0);
    const color = pct >= 80 ? C.red : pct >= 50 ? C.yellow : C.green;
    parts.push(paint(`ctx ${pct}% (${k}k)`, color));
  }

  // Coût session
  const cost = data.cost && fmtCost(data.cost.total_cost_usd);
  if (cost) parts.push(paint(cost, C.gray));

  // Lignes ajoutées / supprimées
  if (data.cost) {
    const add = data.cost.total_lines_added || 0;
    const del = data.cost.total_lines_removed || 0;
    if (add || del) {
      parts.push(`${paint('+' + add, C.green)} ${paint('-' + del, C.red)}`);
    }
  }

  process.stdout.write(parts.join(paint(' · ', C.dim)));
}

main();