/** Processus en écoute sur `port`, d'après une sortie de `netstat -ano` (Windows). */
export function listeningPids(netstatOutput: string, port: number): string[];
