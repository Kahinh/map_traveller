/**
 * Informations sur l'application installée. `getVersion` est couvert par `core:default`
 * (`core:app:default` → `allow-version`) : aucune permission à ajouter.
 */
import { getVersion } from '@tauri-apps/api/app';
import { IS_TAURI } from './env';

/** Version installée (celle de `tauri.conf.json` au build) ; `null` dans le navigateur. */
export async function getAppVersion(): Promise<string | null> {
  return IS_TAURI ? getVersion() : null;
}
