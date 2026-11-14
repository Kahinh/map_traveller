/**
 * Résolution des images du catalogue (chemins relatifs `images/...`).
 * Dans Tauri, le dossier de données est servi par le protocole `asset:` (scope limité à images/).
 */
import { isTauri } from './env';

let dataDirPromise: Promise<string> | null = null;

async function dataDir(): Promise<string> {
  if (!dataDirPromise) {
    dataDirPromise = (async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<string>('data_dir');
    })();
  }
  return dataDirPromise;
}

/** URL affichable pour une image relative, ou `null` (placeholder). */
export async function resolveImageSrc(relative: string | null): Promise<string | null> {
  if (!relative) return null;
  if (!isTauri()) return `/${relative}`;
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  const dir = await dataDir();
  return convertFileSrc(`${dir}\\${relative.replace(/\//g, '\\')}`);
}
