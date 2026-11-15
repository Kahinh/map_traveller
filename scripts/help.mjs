// Menu de validation et d'outils du dépôt : `npm run help`.
// Les cibles sont nommées par intention. Préférer une cible de ce menu à une commande reconstruite.
const MENU = [
  ['Vérifier', [
    ['npm run check', 'pendant le travail : typecheck + lint + tests (rapide)'],
    ['npm run check:full', "avant de rendre la main : check + build des deux pages"],
    ['npm test -- tests/<fichier>.test.ts', "un seul fichier de test"],
    ['npm run ci:watch', "attendre le build GitHub du commit courant et résumer ses erreurs (seul moyen de compiler le Rust sans cargo)"],
  ]],
  ['Développer', [
    ['npm run dev', 'interface dans le navigateur, http://localhost:1420 (palette : /palette.html)'],
    ['npm run dev:stop', 'arrêter le serveur de développement resté ouvert sur le port 1420'],
    ['npm run tauri dev', 'application native (Rust requis)'],
    ['npm run context -- <mots>', 'contexte ciblé avant une tâche : fichiers récents, occurrences, tests liés'],
  ]],
  ['Publier', [
    ['npm run version:set', 'afficher la version de chaque fichier'],
    ['npm run version:set -- X.Y.Z', 'écrire la version partout (puis commit, tag vX.Y.Z, push)'],
    ['node scripts/make-latest-json.mjs --help', "index de mise à jour ; lancé par la CI, pas à la main"],
  ]],
];

for (const [title, rows] of MENU) {
  console.log(`\n${title}`);
  const width = Math.max(...rows.map(([cmd]) => cmd.length));
  for (const [cmd, what] of rows) console.log(`  ${cmd.padEnd(width)}  ${what}`);
}
console.log('\nDétail des règles : CLAUDE.md. Leçons tirées des erreurs passées : docs/agent-notes.md.\n');
