import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { IS_TAURI } from './env';

/**
 * Écrit du texte dans le presse-papiers. Ne colle jamais rien dans le jeu :
 * le joueur garde le contrôle du collage (invariant 6).
 */
export function copyText(text: string): Promise<void> {
  return IS_TAURI ? writeText(text) : navigator.clipboard.writeText(text);
}
