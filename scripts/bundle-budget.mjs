// Budget du JavaScript chargé à l'ouverture de chaque page (`npm run check:full`, après le build).
// Mesure, dans dist/, le script d'entrée et les modules préchargés (`modulepreload`) de chaque
// page, en octets non compressés : c'est ce que la WebView lit et analyse à chaque ouverture.
// Échoue si une page dépasse son budget. Les budgets valent la taille mesurée au moment où ils
// ont été fixés, plus 10 % : un dépassement signale une dépendance ou un import de trop (la
// palette ne doit embarquer ni la grille ni les panneaux).
//
//   node scripts/bundle-budget.mjs
import { readFileSync, statSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);

/** Budgets en octets (1 Ko = 1000 octets, comme l'affichage de Vite). */
const BUDGETS = {
  // Mesuré : 272,7 Ko (React 218,8 + commun 30,6 + palette 23,2).
  'palette.html': 300_000,
  // Mesuré : 417,8 Ko (React 218,8 + commun 30,6 + fenêtre principale 168,4).
  'index.html': 460_000,
  // Mesuré : 253,4 Ko (React 218,8 + commun 32,0 + fenêtre Farm 2,6).
  'farm.html': 280_000,
};

/** Fichiers JS chargés à l'ouverture d'une page : script d'entrée et modules préchargés. */
function initialScripts(html) {
  const pattern = /<(?:script[^>]*\ssrc|link[^>]*rel="modulepreload"[^>]*\shref)="\/?([^"]+\.js)"/g;
  return [...new Set([...html.matchAll(pattern)].map((match) => match[1]))];
}

const kilo = (bytes) => `${(bytes / 1000).toFixed(1).replace('.', ',')} Ko`;

let failed = false;
for (const [page, budget] of Object.entries(BUDGETS)) {
  let html;
  try {
    html = readFileSync(new URL(page, dist), 'utf8');
  } catch {
    console.error(`dist/${page} introuvable : lancer \`npm run build\` d'abord.`);
    process.exit(1);
  }
  const scripts = initialScripts(html);
  if (scripts.length === 0) {
    console.error(`dist/${page} : aucun script trouvé, le format de la page a changé.`);
    failed = true;
    continue;
  }
  const total = scripts.reduce((sum, file) => sum + statSync(new URL(file, dist)).size, 0);
  const verdict = total > budget ? 'DÉPASSÉ' : 'ok';
  console.log(`${page.padEnd(13)} ${kilo(total).padStart(10)} / ${kilo(budget)}  ${verdict}`);
  if (total > budget) {
    console.error(`  ${scripts.join(', ')}`);
    failed = true;
  }
}

if (failed) {
  console.error('Budget JS dépassé : vérifier les imports ajoutés, ou relever le budget en le justifiant.');
  process.exit(1);
}
