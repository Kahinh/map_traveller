/** Actions de fenêtre ; sans effet dans le navigateur. */
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from './env';

const win = () => (isTauri() ? getCurrentWindow() : null);

export async function setAlwaysOnTop(value: boolean): Promise<void> {
  await win()?.setAlwaysOnTop(value);
}

export async function minimizeWindow(): Promise<void> {
  await win()?.minimize();
}

export async function closeWindow(): Promise<void> {
  await win()?.close();
}
