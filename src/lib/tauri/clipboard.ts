import { isTauri } from './env';

/**
 * Écrit du texte dans le presse-papiers. Ne colle jamais rien dans le jeu :
 * le joueur garde le contrôle du collage (CdC §9).
 */
export async function copyText(text: string): Promise<void> {
  if (isTauri()) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}
