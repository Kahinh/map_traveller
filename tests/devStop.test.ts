// `npm run dev:stop` doit retrouver le serveur de développement, quelle que soit la langue de
// Windows et que Vite écoute en IPv4 ou en IPv6 (il écoute sur [::1]:1420 sur la machine de dev).
import { describe, expect, it } from 'vitest';
import { listeningPids } from '../scripts/dev-stop.mjs';

const NETSTAT = [
  'Connexions actives',
  '',
  '  Proto  Adresse locale         Adresse distante       État',
  '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1516',
  '  TCP    [::1]:1420             [::]:0                 LISTENING       13292',
  '  TCP    [::1]:1420             [::1]:61599            FIN_WAIT_2      13292',
  '  TCP    [::1]:61599            [::1]:1420             ESTABLISHED     700',
  '  TCP    127.0.0.1:14200        0.0.0.0:0              LISTENING       42',
  '  UDP    0.0.0.0:1420           *:*                                    99',
].join('\r\n');

describe('dev:stop — processus en écoute sur un port', () => {
  it('trouve un serveur qui écoute en IPv6', () => {
    expect(listeningPids(NETSTAT, 1420)).toEqual(['13292']);
  });

  it('ignore les connexions établies vers ce port, les autres ports et UDP', () => {
    // 700 est un client connecté au port 1420, 42 écoute sur 14200, 99 est de l'UDP.
    expect(listeningPids(NETSTAT, 1420)).not.toContain('700');
    expect(listeningPids(NETSTAT, 1420)).not.toContain('42');
    expect(listeningPids(NETSTAT, 1420)).not.toContain('99');
  });

  it('ne dépend pas du mot LISTENING (Windows dans une autre langue)', () => {
    const traduit = NETSTAT.replace(/LISTENING/g, 'ABHÖREN');
    expect(listeningPids(traduit, 1420)).toEqual(['13292']);
  });

  it('trouve aussi un serveur en IPv4, et rien sur un port libre', () => {
    expect(listeningPids(NETSTAT, 135)).toEqual(['1516']);
    expect(listeningPids(NETSTAT, 5173)).toEqual([]);
  });
});
