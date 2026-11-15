// Arrête le serveur de développement resté ouvert : `npm run dev:stop [-- <port>]`.
// Sous Windows, arrêter la tâche qui a lancé Vite laisse parfois le processus Node en vie ;
// le port 1420 reste alors pris et le prochain `npm run dev` échoue (strictPort).
import { execFileSync } from 'node:child_process';

const port = Number(process.argv[2] ?? 1420);
if (!Number.isInteger(port) || port <= 0) {
  console.error('Port invalide.');
  process.exit(1);
}

function pidsOnPort() {
  if (process.platform === 'win32') {
    const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' });
    return [
      ...new Set(
        out
          .split('\n')
          .filter((l) => /LISTENING/.test(l) && new RegExp(`[:.]${port}\\s`).test(l))
          .map((l) => l.trim().split(/\s+/).pop())
          .filter((pid) => pid && pid !== '0'),
      ),
    ];
  }
  try {
    return execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

const pids = pidsOnPort();
if (pids.length === 0) {
  console.log(`Aucun serveur sur le port ${port}.`);
} else {
  for (const pid of pids) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' });
    else process.kill(Number(pid));
    console.log(`Serveur arrêté (processus ${pid}, port ${port}).`);
  }
}
