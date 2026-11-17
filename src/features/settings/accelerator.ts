/**
 * Raccourcis clavier globaux : format, capture au clavier, affichage (issue n°3). PUR.
 *
 * Le format est le même que celui accepté par Rust (`src-tauri/src/shortcuts.rs`), qui reste
 * seul juge : modificateurs `Ctrl`, `Alt`, `Shift` (au moins `Ctrl` ou `Alt`) puis UNE touche
 * parmi `A`–`Z`, `0`–`9`, `F1`–`F12`, `Space`. Forme normalisée : `Ctrl+Alt+Shift+Touche`.
 */
import { isRecord } from '../shared/json';

export type ShortcutAction = 'toggleMain' | 'palette';

export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = ['toggleMain', 'palette'];

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  toggleMain: 'Afficher / masquer la fenêtre',
  palette: 'Ouvrir la palette',
};

export const DEFAULT_SHORTCUTS: Readonly<Record<ShortcutAction, string>> = {
  toggleMain: 'Ctrl+Alt+T',
  palette: 'Ctrl+Alt+Space',
};

/** Raccourci effectif d'une action, tel que renvoyé par Rust. */
export interface ShortcutStatus {
  accelerator: string;
  /** Faux si le système a refusé le raccourci (déjà pris par une autre application). */
  registered: boolean;
}

export type ShortcutsState = Record<ShortcutAction, ShortcutStatus>;

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

/** Nom normalisé d'une touche principale, ou `null` si elle n'est pas prise en charge. */
function normalizeKey(token: string): string | null {
  const upper = token.toUpperCase();
  if (upper === 'SPACE') return 'Space';
  if (/^[A-Z0-9]$/.test(upper)) return upper;
  if (FUNCTION_KEY.test(upper)) return upper;
  return null;
}

/** Forme normalisée d'un raccourci, ou `null` s'il est invalide. Miroir de `parse_accelerator`. */
export function normalizeAccelerator(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  let ctrl = false;
  let alt = false;
  let shift = false;
  let key: string | null = null;
  for (const raw of trimmed.split('+')) {
    const token = raw.trim();
    if (token === '') return null;
    switch (token.toLowerCase()) {
      case 'ctrl':
      case 'control':
        ctrl = true;
        break;
      case 'alt':
        alt = true;
        break;
      case 'shift':
        shift = true;
        break;
      default: {
        if (key !== null) return null;
        key = normalizeKey(token);
        if (key === null) return null;
      }
    }
  }
  if (key === null || (!ctrl && !alt)) return null;
  return [ctrl && 'Ctrl', alt && 'Alt', shift && 'Shift', key].filter(Boolean).join('+');
}

/** Sous-ensemble d'un `KeyboardEvent` utile à la capture (testable sans navigateur). */
export interface KeyLike {
  key: string;
  /** Code de touche virtuelle Windows (`KeyboardEvent.keyCode`) : suit la disposition du clavier. */
  keyCode: number;
  /** Position physique (`KeyboardEvent.code`), utilisée si `keyCode` est absent. */
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export type CaptureResult =
  /** Échap : annuler la capture. */
  | { kind: 'cancel' }
  /** Touche de modification seule : attendre la touche principale. */
  | { kind: 'pending' }
  | { kind: 'invalid'; message: string }
  | { kind: 'ok'; accelerator: string };

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'AltGraph']);
const META_KEYS = new Set(['Meta', 'OS']);

/**
 * Touche principale d'après le code de touche virtuelle. Le raccourci global de Windows est
 * enregistré par touche virtuelle : sur un clavier AZERTY, `Ctrl+Alt+A` est la touche marquée A.
 */
function keyFromEvent(e: KeyLike): string | null {
  const k = e.keyCode;
  if (k >= 65 && k <= 90) return String.fromCharCode(k);
  if (k >= 48 && k <= 57) return String.fromCharCode(k);
  if (k >= 112 && k <= 123) return `F${k - 111}`;
  if (k === 32) return 'Space';
  if (k > 0) return null;
  // Sans code de touche virtuelle : position physique.
  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter) return letter[1] ?? null;
  const digit = /^Digit([0-9])$/.exec(e.code);
  if (digit) return digit[1] ?? null;
  if (e.code === 'Space') return 'Space';
  return FUNCTION_KEY.test(e.code) ? e.code : null;
}

/**
 * Construit un raccourci à partir d'un appui de touche. Exige `Ctrl` ou `Alt` et une touche
 * principale ; une touche de modification seule laisse la capture en attente.
 */
export function captureAccelerator(e: KeyLike): CaptureResult {
  if (e.key === 'Escape') return { kind: 'cancel' };
  if (e.metaKey || META_KEYS.has(e.key)) {
    return { kind: 'invalid', message: "La touche Windows n'est pas acceptée dans un raccourci" };
  }
  if (MODIFIER_KEYS.has(e.key)) return { kind: 'pending' };
  const key = keyFromEvent(e);
  if (key === null) {
    return { kind: 'invalid', message: 'Touche non prise en charge : utilisez une lettre, un chiffre, F1 à F12 ou Espace' };
  }
  if (!e.ctrlKey && !e.altKey) return { kind: 'invalid', message: 'Le raccourci doit contenir Ctrl ou Alt' };
  const accelerator = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', key].filter(Boolean).join('+');
  return { kind: 'ok', accelerator };
}

const DISPLAY_NAMES: Record<string, string> = { Shift: 'Maj', Space: 'Espace' };

/** Affichage en français : `Ctrl+Shift+Space` → `Ctrl + Maj + Espace`. */
export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => DISPLAY_NAMES[part] ?? part)
    .join(' + ');
}

/** Valide la réponse de Rust (`get_shortcuts`, `set_shortcut`, `reset_shortcuts`) ; `null` si inattendue. */
export function parseShortcutsState(input: unknown): ShortcutsState | null {
  if (!isRecord(input)) return null;
  const state: Partial<ShortcutsState> = {};
  for (const action of SHORTCUT_ACTIONS) {
    const entry = input[action];
    if (!isRecord(entry) || typeof entry.accelerator !== 'string' || typeof entry.registered !== 'boolean') return null;
    state[action] = { accelerator: entry.accelerator, registered: entry.registered };
  }
  return state as ShortcutsState;
}

/** État affiché hors de l'application installée : valeurs par défaut, non enregistrées. */
export function defaultShortcutsState(): ShortcutsState {
  return {
    toggleMain: { accelerator: DEFAULT_SHORTCUTS.toggleMain, registered: false },
    palette: { accelerator: DEFAULT_SHORTCUTS.palette, registered: false },
  };
}
