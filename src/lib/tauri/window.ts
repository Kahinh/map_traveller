/** Actions de fenêtre ; sans effet dans le navigateur. */
import { isTauri } from './env';

async function current() {
  if (!isTauri()) return null;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

export async function setAlwaysOnTop(value: boolean): Promise<void> {
  await (await current())?.setAlwaysOnTop(value);
}

export async function minimizeWindow(): Promise<void> {
  await (await current())?.minimize();
}

export async function closeWindow(): Promise<void> {
  await (await current())?.close();
}
