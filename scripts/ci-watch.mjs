// Attend un build GitHub Actions et résume son résultat : `npm run ci:watch [-- <id du run>]`.
// Sans argument : le run le plus récent du commit courant. C'est la boucle de validation du code
// natif sous Windows (code `cfg(windows)`, installateur), y compris quand cargo est installé en
// local, et la seule quand il ne l'est pas.
// Code de sortie : 0 si le build est vert, 1 sinon.
import { execFileSync, spawnSync } from 'node:child_process';

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const tryGh = (args) => {
  try {
    return gh(args);
  } catch {
    return '';
  }
};

/** Retire le préfixe « job<TAB>étape<TAB>horodatage » des journaux de gh. */
const stripPrefix = (line) => line.replace(/^[^\t]*\t[^\t]*\t\S+\s/, '');

let runId = process.argv[2];
if (!runId) {
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const runs = JSON.parse(gh(['run', 'list', '--commit', sha, '--limit', '5', '--json', 'databaseId,headBranch,status,event']));
  if (runs.length === 0) {
    console.error(`Aucun build pour le commit ${sha.slice(0, 7)} : a-t-il été poussé ?`);
    process.exit(1);
  }
  // Un tag et main peuvent porter le même commit : le tag d'abord, c'est lui qui publie.
  const run = runs.find((r) => /^v\d/.test(r.headBranch)) ?? runs[0];
  runId = String(run.databaseId);
  console.log(`Build ${runId} (${run.headBranch}) du commit ${sha.slice(0, 7)}`);
}

spawnSync('gh', ['run', 'watch', runId, '--interval', '30'], { stdio: 'ignore' });

const view = JSON.parse(gh(['run', 'view', runId, '--json', 'conclusion,status,url,jobs']));
const failedSteps = view.jobs.flatMap((j) => j.steps.filter((s) => s.conclusion === 'failure').map((s) => s.name));
console.log(`Résultat : ${view.conclusion || view.status}  ${view.url}`);

const log = tryGh(['run', 'view', runId, '--log']);
const rust = log.split('\n').map(stripPrefix).filter((l) => /^test result: \w+\. [1-9]/.test(l));
if (rust.length) console.log(`Tests Rust : ${rust[0]}`);

if (view.conclusion !== 'success') {
  console.log(`Étapes en échec : ${failedSteps.join(', ') || '(inconnue)'}`);
  const failed = tryGh(['run', 'view', runId, '--log-failed']);
  const lines = failed
    .split('\n')
    .map(stripPrefix)
    .filter((l) => /error(\[E\d+\])?:|^\s*-->|could not compile|FAILED|panicked|Error:|✗|×/.test(l));
  console.log(lines.slice(0, 60).join('\n') || '(aucune ligne d\'erreur reconnue : gh run view ' + runId + ' --log-failed)');
  process.exit(1);
}
