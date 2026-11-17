// Contexte ciblé avant une tâche : `npm run context -- <mot> [<mot>…]`.
// Rassemble en une sortie courte ce qu'il faut lire en premier, au lieu d'explorer le dépôt :
// fichiers modifiés récemment, fichiers où les mots apparaissent, tests liés, symboles CodeGraph.
// Lecture seule ; ne lit jamais node_modules, dist ni src-tauri/target.
import { execFileSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';

const words = process.argv.slice(2).filter(Boolean);
if (words.length === 0) {
  console.error('Usage : npm run context -- <mot> [<mot>…]   (ex. : npm run context -- palette farm)');
  process.exit(1);
}

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const SOURCES = ['src', 'src-tauri/src', 'tests', 'scripts', '.github'];

// 1. Fichiers source touchés par les derniers commits (ce qui bouge en ce moment).
const recent = [...new Set(lines(run('git', ['log', '-12', '--name-only', '--pretty=format:', '--', ...SOURCES])))].slice(0, 15);

// 2. Fichiers où chaque mot apparaît, classés par nombre de mots trouvés puis d'occurrences.
const score = new Map();
for (const w of words) {
  for (const l of lines(run('git', ['grep', '-I', '-i', '-c', '-e', w, '--', ...SOURCES]))) {
    const i = l.lastIndexOf(':');
    const file = l.slice(0, i);
    const s = score.get(file) ?? { words: 0, hits: 0 };
    s.words += 1;
    s.hits += Number(l.slice(i + 1));
    score.set(file, s);
  }
}
const matches = [...score.entries()].sort((a, b) => b[1].words - a[1].words || b[1].hits - a[1].hits).slice(0, 15);

// 3. Tests liés : fichiers de tests parmi les correspondances.
const tests = matches.filter(([f]) => f.startsWith('tests/')).map(([f]) => f);

console.log(`Contexte pour : ${words.join(' ')}\n`);
console.log('Fichiers où ces mots apparaissent (mots trouvés, occurrences) :');
console.log(matches.length ? matches.map(([f, s]) => `  ${f}  (${s.words}/${words.length}, ${s.hits})`).join('\n') : '  aucun');
console.log('\nTests liés :');
console.log(tests.length ? tests.map((f) => `  ${f}   → npm test -- ${f}`).join('\n') : '  aucun trouvé : en écrire un avant de modifier une fonction pure');
console.log('\nModifiés récemment :');
console.log(recent.length ? recent.map((f) => `  ${f}`).join('\n') : '  aucun');

// 4. Symboles : CodeGraph si l'index existe.
const symbols = lines(run('codegraph', ['query', words[0]])).filter((l) => /\.(ts|tsx|rs|mjs):\d+/.test(l)).slice(0, 8);
if (symbols.length) console.log(`\nSymboles (CodeGraph, « ${words[0]} ») :\n${symbols.map((l) => `  ${stripVTControlCharacters(l)}`).join('\n')}`);

console.log('\nRègles à respecter : CLAUDE.md (invariants). Pièges connus : docs/agent-notes.md.');
