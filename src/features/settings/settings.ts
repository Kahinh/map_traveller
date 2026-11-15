/**
 * Modèle des réglages (`settings.json`). PUR et testé.
 *
 * - Lecture tolérante : fichier absent, illisible, clé absente ou invalide → valeur par défaut,
 *   jamais d'erreur. L'ancien format `{ "alwaysOnTop": … }` reste valide.
 * - Écriture : les clés inconnues du fichier sont CONSERVÉES (une autre version a pu les écrire).
 * - `shortcuts` appartient à Rust (`set_shortcut`) : l'interface le lit mais ne l'écrit jamais ;
 *   `mergeSettings` le reprend tel quel du fichier, et Rust le protège de son côté (`save_store`).
 */
import { DEFAULT_SHORTCUTS, normalizeAccelerator, type ShortcutAction } from './accelerator';

export interface Settings {
  alwaysOnTop: boolean;
  /** Lecture seule côté interface : modifié uniquement par les commandes Rust. */
  shortcuts: Record<ShortcutAction, string>;
}

/** Réglages modifiables depuis l'interface (les raccourcis passent par Rust). */
export type SettingsPatch = Partial<Pick<Settings, 'alwaysOnTop'>>;

export const DEFAULT_SETTINGS: Settings = {
  alwaysOnTop: true,
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Réglages lus d'un contenu JSON quelconque. Ne lève jamais. */
export function parseSettings(input: unknown): Settings {
  const data = isRecord(input) ? input : {};
  const shortcuts = isRecord(data.shortcuts) ? data.shortcuts : {};
  let toggleMain = normalizeAccelerator(shortcuts.toggleMain) ?? DEFAULT_SHORTCUTS.toggleMain;
  let palette = normalizeAccelerator(shortcuts.palette) ?? DEFAULT_SHORTCUTS.palette;
  // Même règle que Rust : deux actions sur le même raccourci → valeurs par défaut.
  if (toggleMain === palette) {
    toggleMain = DEFAULT_SHORTCUTS.toggleMain;
    palette = DEFAULT_SHORTCUTS.palette;
  }
  return {
    // Comportement historique : seul `false` désactive le premier plan.
    alwaysOnTop: data.alwaysOnTop !== false,
    shortcuts: { toggleMain, palette },
  };
}

/**
 * Objet à écrire : le contenu actuel du fichier (`raw`, toutes clés conservées, `shortcuts`
 * compris) avec les seules clés que l'interface possède remplacées.
 */
export function mergeSettings(raw: unknown, settings: Settings): Record<string, unknown> {
  const base = isRecord(raw) ? raw : {};
  return { ...base, alwaysOnTop: settings.alwaysOnTop };
}
