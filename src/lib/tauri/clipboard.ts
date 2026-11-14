import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { isTauri } from './env';

/**
 * Écrit du texte dans le presse-papiers. Ne colle jamais rien dans le jeu :
 * le joueur garde le contrôle du collage (CdC §9).
 */
export function copyText(text: string): Promise<void> {
  return isTauri() ? writeText(text) : navigator.clipboard.writeText(text);
}
