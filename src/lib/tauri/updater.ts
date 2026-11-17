/**
 * Pont du moteur de mise à jour (issue n°5) : plugin de mise à jour et plugin de processus de
 * Tauri, côté interface. Trois opérations minces : vérifier, télécharger puis installer, relancer.
 * AUCUNE logique de décision ici (voir `features/updates/updates.ts` et `app/useUpdater.ts`).
 *
 * Requêtes : uniquement l'index `latest.json` des Releases GitHub (adresse fixée dans
 * `tauri.conf.json`, `plugins.updater.endpoints`) puis l'installateur qu'il désigne. Elles
 * partent du code natif ; la signature est vérifiée par le plugin avant toute installation.
 *
 * Permissions (`capabilities/default.json`, fenêtre principale seulement) : `updater:allow-check`,
 * `updater:allow-download`, `updater:allow-install`, `process:allow-restart`. La libération d'une
 * ressource (`Update.close`) est couverte par `core:default`.
 *
 * Navigateur (`npm run dev`) : non disponible, aucune requête.
 */
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { UpdateTimeoutError } from '../../features/updates/updates';
import { INSTALLED_ONLY, IS_TAURI } from './env';

/** Délai maximal de la requête de vérification, transmis au plugin (ms). */
const CHECK_TIMEOUT_MS = 15_000;
/** Délai maximal de la vérification côté interface : filet si le plugin ne rend jamais la main. */
const CHECK_WATCHDOG_MS = CHECK_TIMEOUT_MS + 5_000;
/** Délai maximal du téléchargement de l'installateur, transmis au plugin (ms). */
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
const DOWNLOAD_WATCHDOG_MS = DOWNLOAD_TIMEOUT_MS + 30_000;

/** Version trouvée par `checkForUpdate`. `handle` est une ressource native, à libérer par `releaseUpdate`. */
export interface AvailableUpdate {
  version: string;
  notes: string;
  readonly handle: Update;
}

/** Progression du téléchargement : taille annoncée (au premier morceau), puis chaque morceau reçu. */
type DownloadProgress = { kind: 'length'; total: number | null } | { kind: 'chunk'; bytes: number };

/**
 * Promesse rejetée par `UpdateTimeoutError` si `promise` ne s'est pas réglée après `ms`.
 * `onLate` reçoit la valeur d'une promesse résolue APRÈS le délai (pour libérer une ressource).
 */
function withWatchdog<T>(promise: Promise<T>, ms: number, onLate?: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new UpdateTimeoutError());
    }, ms);
    promise.then(
      (value) => {
        if (expired) onLate?.(value);
        else {
          clearTimeout(timer);
          resolve(value);
        }
      },
      (error: unknown) => {
        if (!expired) {
          clearTimeout(timer);
          reject(error);
        }
      },
    );
  });
}

/** Libère la ressource native d'une mise à jour non installée. Ne lève jamais. */
export async function releaseUpdate(update: AvailableUpdate | Update | null): Promise<void> {
  if (update === null) return;
  const handle = 'handle' in update ? update.handle : update;
  await handle.close().catch(() => undefined);
}

/**
 * Interroge l'index des Releases. Renvoie la version proposée si elle est plus récente que la
 * version installée (comparaison faite par le plugin), `null` sinon. Rejette en cas d'erreur
 * réseau, d'index invalide ou de délai dépassé (`UpdateTimeoutError`).
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!IS_TAURI) throw new Error(INSTALLED_ONLY);
  const update = await withWatchdog(check({ timeout: CHECK_TIMEOUT_MS }), CHECK_WATCHDOG_MS, (late) => {
    void releaseUpdate(late);
  });
  if (update === null) return null;
  return { version: update.version, notes: update.body ?? '', handle: update };
}

function toProgress(event: DownloadEvent): DownloadProgress | null {
  switch (event.event) {
    case 'Started':
      return { kind: 'length', total: event.data.contentLength ?? null };
    case 'Progress':
      return { kind: 'chunk', bytes: event.data.chunkLength };
    case 'Finished':
      return null;
  }
}

/**
 * Télécharge l'installateur (signature vérifiée par le plugin à la fin du téléchargement),
 * attend `beforeInstall` (garde-fous de l'appelant), puis lance l'installation.
 *
 * Windows : l'installateur NSIS est lancé en mode passif (`tauri.conf.json`) et le plugin
 * TERMINE le processus ; l'installateur relance ensuite l'application. Cette promesse ne se
 * résout donc normalement jamais sous Windows. Rejette si le téléchargement, la signature ou le
 * lancement de l'installateur échoue : l'application installée reste alors intacte.
 */
export async function downloadAndInstall(
  update: AvailableUpdate,
  onProgress: (progress: DownloadProgress) => void,
  beforeInstall: () => Promise<void>,
): Promise<void> {
  if (!IS_TAURI) throw new Error(INSTALLED_ONLY);
  await withWatchdog(
    update.handle.download(
      (event) => {
        const progress = toProgress(event);
        if (progress !== null) onProgress(progress);
      },
      { timeout: DOWNLOAD_TIMEOUT_MS },
    ),
    DOWNLOAD_WATCHDOG_MS,
  );
  await beforeInstall();
  await update.handle.install();
}

/** Relance l'application (plugin de processus). Sans effet dans le navigateur. */
export async function relaunchApp(): Promise<void> {
  if (IS_TAURI) await relaunch();
}
