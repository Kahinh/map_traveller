// Arrête le serveur de développement resté ouvert : `npm run dev:stop [-- <port>]`.
// Sous Windows, arrêter la tâche qui a lancé Vite laisse parfois le processus Node en vie ;
// le port 1420 reste alors pris et le prochain `npm run dev` échoue (strictPort).
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Processus en écoute sur `port`, d'après une sortie de `netstat -ano` (Windows).
 * - IPv4 ET IPv6 : Vite écoute sur `[::1]:1420` ; `netstat -p TCP` ne liste que l'IPv4 et ne le voit pas.
 * - Indépendant de la langue de Windows : une ligne d'écoute se reconnaît à son adresse distante
 *   nulle (`0.0.0.0:0` ou `[::]:0`), pas au mot « LISTENING », que Windows peut traduire.
 */
export function listeningPids(netstatOutput, port) {
  const pids = new Set();
  for (const line of netstatOutput.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5 || !/^TCP/i.test(cols[0])) continue;
    const [, local, remote] = cols;
    const pid = cols[cols.length - 1];
    if (!local.endsWith(`:${port}`)) continue;
    if (remote !== '0.0.0.0:0' && remote !== '[::]:0') continue;
    if (/^\d+$/.test(pid) && pid !== '0') pids.add(pid);
  }
  return [...pids];
}

function pidsOnPort(port) {
  if (process.platform === 'win32') {
    return listeningPids(execFileSync('netstat', ['-ano'], { encoding: 'utf8' }), port);
  }
  try {
    return execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const port = Number(process.argv[2] ?? 1420);
  if (!Number.isInteger(port) || port <= 0) {
    console.error('Port invalide.');
    process.exit(1);
  }
  const pids = pidsOnPort(port);
  if (pids.length === 0) {
    console.log(`Aucun serveur sur le port ${port}.`);
    return;
  }
  for (const pid of pids) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' });
    else process.kill(Number(pid));
    console.log(`Serveur arrêté (processus ${pid}, port ${port}).`);
  }
}

// Lancé comme script (`node scripts/dev-stop.mjs`), et non importé par un test.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
