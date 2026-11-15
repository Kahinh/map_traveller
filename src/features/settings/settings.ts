/**
 * Modèle des réglages (`settings.json`). PUR et testé.
 *
 * - Lecture tolérante : fichier absent, illisible, clé absente ou invalide → valeur par défaut,
 *   jamais d'erreur. L'ancien format `{ "alwaysOnTop": … }` reste valide.
 * - Écriture : les clés inconnues du fichier sont CONSERVÉES (une autre version a pu les écrire),
 *   y compris à l'intérieur de l'objet `updates`.
 * - `shortcuts` appartient à Rust (`set_shortcut`) : l'interface le lit mais ne l'écrit jamais ;
 *   `mergeSettings` le reprend tel quel du fichier, et Rust le protège de son côté (`save_store`).
 */
import { DEFAULT_SHORTCUTS, normalizeAccelerator, type ShortcutAction } from './accelerator';

/** Manuel : rien n'est contacté sans action de l'utilisateur. Automatique : vérification au lancement. */
export type UpdateMode = 'manual' | 'auto';

export const UPDATE_MODES: readonly UpdateMode[] = ['manual', 'auto'];

export interface UpdateSettings {
  mode: UpdateMode;
}

export interface Settings {
  alwaysOnTop: boolean;
  updates: UpdateSettings;
  /** Lecture seule côté interface : modifié uniquement par les commandes Rust. */
  shortcuts: Record<ShortcutAction, string>;
}

/** Réglages modifiables depuis l'interface (les raccourcis passent par Rust). */
export interface SettingsPatch {
  alwaysOnTop?: boolean;
  updates?: Partial<UpdateSettings>;
}

export const DEFAULT_SETTINGS: Settings = {
  alwaysOnTop: true,
  // Hors ligne par défaut : aucune connexion sans choix explicite de l'utilisateur.
  updates: { mode: 'manual' },
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isUpdateMode(v: unknown): v is UpdateMode {
  return UPDATE_MODES.includes(v as UpdateMode);
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
  const updates = isRecord(data.updates) ? data.updates : {};
  return {
    // Comportement historique : seul `false` désactive le premier plan.
    alwaysOnTop: data.alwaysOnTop !== false,
    updates: { mode: isUpdateMode(updates.mode) ? updates.mode : DEFAULT_SETTINGS.updates.mode },
    shortcuts: { toggleMain, palette },
  };
}

/**
 * Réglages après application d'un changement partiel. Nouvel objet ; `settings` n'est pas
 * modifié. Une valeur `undefined` du patch ne remplace rien ; `shortcuts` n'est jamais touché.
 */
export function applySettingsPatch(settings: Settings, patch: SettingsPatch): Settings {
  return {
    ...settings,
    alwaysOnTop: patch.alwaysOnTop ?? settings.alwaysOnTop,
    updates: { ...settings.updates, mode: patch.updates?.mode ?? settings.updates.mode },
  };
}

/**
 * Objet à écrire : le contenu actuel du fichier (`raw`, toutes clés conservées, `shortcuts`
 * compris) avec les seules clés que l'interface possède remplacées. Dans `updates`, seul
 * `mode` est remplacé : les autres champs (écrits par une version plus récente) sont conservés.
 */
export function mergeSettings(raw: unknown, settings: Settings): Record<string, unknown> {
  const base = isRecord(raw) ? raw : {};
  const updates = isRecord(base.updates) ? base.updates : {};
  return {
    ...base,
    alwaysOnTop: settings.alwaysOnTop,
    updates: { ...updates, mode: settings.updates.mode },
  };
}
