/**
 * Modèle des réglages (`settings.json`). PUR et testé.
 *
 * - Lecture tolérante : fichier absent, illisible, clé absente ou invalide → valeur par défaut,
 *   jamais d'erreur. L'ancien format `{ "alwaysOnTop": … }` reste valide.
 * - Écriture : les clés inconnues du fichier sont CONSERVÉES (une autre version a pu les écrire),
 *   y compris à l'intérieur de l'objet `updates`.
 * - `updates.lastCheckedAt`, `updates.lastSeenVersion` et `updates.lastAutoInstallVersion` sont
 *   écrits par le moteur de mise à jour (`useUpdater`) ; absents ou invalides → non définis.
 * - `tray.minimizeToTray` (issue n°14) : écrit par l'interface, LU par Rust au moment de réduire
 *   (`src-tauri/src/main_window.rs`) ; `true` si absent ou invalide, comme côté Rust. Les autres
 *   clés de `tray` sont conservées.
 * - `palette.defaultVariant` (issue n°11) : écrit par la fenêtre principale, LU par la palette à
 *   chaque affichage ; `withoutZaap` si absent ou invalide (comportement d'avant). Les autres clés
 *   de `palette` sont conservées.
 * - `shortcuts` appartient à Rust (`set_shortcut`) : l'interface le lit mais ne l'écrit jamais ;
 *   `mergeSettings` le reprend tel quel du fichier, et Rust le protège de son côté (`save_store`).
 */
import { DEFAULT_SHORTCUTS, normalizeAccelerator, type ShortcutAction } from './accelerator';
import { DEFAULT_PALETTE_SETTINGS, parsePaletteSettings, type PaletteSettings } from './paletteSettings';
import { isRecord } from '../shared/json';

export type { PaletteSettings } from './paletteSettings';

/** Manuel : rien n'est contacté sans action de l'utilisateur. Automatique : vérification au lancement. */
export type UpdateMode = 'manual' | 'auto';

const UPDATE_MODES: readonly UpdateMode[] = ['manual', 'auto'];

export interface UpdateSettings {
  mode: UpdateMode;
  /** Date (ms depuis 1970) de la dernière recherche aboutie ; absente si jamais. */
  lastCheckedAt?: number;
  /** Dernière version de l'application lancée : sert à annoncer une mise à jour une seule fois. */
  lastSeenVersion?: string;
  /** Dernière version dont l'installation AUTOMATIQUE a été lancée (garde-fou anti-boucle). */
  lastAutoInstallVersion?: string;
}

/** Zone de notification (issue n°14). */
export interface TraySettings {
  /** Réduire et le raccourci « afficher / masquer » envoient l'application dans la zone de notification. */
  minimizeToTray: boolean;
}

export interface Settings {
  alwaysOnTop: boolean;
  updates: UpdateSettings;
  tray: TraySettings;
  palette: PaletteSettings;
  /** Lecture seule côté interface : modifié uniquement par les commandes Rust. */
  shortcuts: Record<ShortcutAction, string>;
}

/** Réglages modifiables depuis l'interface (les raccourcis passent par Rust). */
export interface SettingsPatch {
  alwaysOnTop?: boolean;
  updates?: Partial<UpdateSettings>;
  tray?: Partial<TraySettings>;
  palette?: Partial<PaletteSettings>;
}

export const DEFAULT_SETTINGS: Settings = {
  alwaysOnTop: true,
  // Hors ligne par défaut : aucune connexion sans choix explicite de l'utilisateur.
  updates: { mode: 'manual' },
  // Activé par défaut (décision 6 de l'issue n°14) : le bouton fermer, lui, quitte toujours.
  tray: { minimizeToTray: true },
  palette: DEFAULT_PALETTE_SETTINGS,
  shortcuts: { ...DEFAULT_SHORTCUTS },
};

export function isUpdateMode(v: unknown): v is UpdateMode {
  return UPDATE_MODES.includes(v as UpdateMode);
}

/** Horodatage plausible : entier positif ou nul ; sinon `undefined`. */
function readTimestamp(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
}

/** Numéro de version plausible (`0.5.0`, `1.2.3-beta.1`) ; sinon `undefined`. */
const VERSION_PATTERN = /^[0-9A-Za-z.+-]{1,64}$/;
function readVersion(v: unknown): string | undefined {
  return typeof v === 'string' && VERSION_PATTERN.test(v) ? v : undefined;
}

/** Champs de `updates` lus d'un objet quelconque : seuls les champs valides sont présents. */
function parseUpdateSettings(updates: Record<string, unknown>): UpdateSettings {
  const result: UpdateSettings = { mode: isUpdateMode(updates.mode) ? updates.mode : DEFAULT_SETTINGS.updates.mode };
  const lastCheckedAt = readTimestamp(updates.lastCheckedAt);
  const lastSeenVersion = readVersion(updates.lastSeenVersion);
  const lastAutoInstallVersion = readVersion(updates.lastAutoInstallVersion);
  if (lastCheckedAt !== undefined) result.lastCheckedAt = lastCheckedAt;
  if (lastSeenVersion !== undefined) result.lastSeenVersion = lastSeenVersion;
  if (lastAutoInstallVersion !== undefined) result.lastAutoInstallVersion = lastAutoInstallVersion;
  return result;
}

/** Champs de `updates` définis (valeur autre que `undefined`), dans un nouvel objet. */
function definedUpdateFields(updates: Partial<UpdateSettings>): Partial<UpdateSettings> {
  const result: Partial<UpdateSettings> = {};
  if (updates.mode !== undefined) result.mode = updates.mode;
  if (updates.lastCheckedAt !== undefined) result.lastCheckedAt = updates.lastCheckedAt;
  if (updates.lastSeenVersion !== undefined) result.lastSeenVersion = updates.lastSeenVersion;
  if (updates.lastAutoInstallVersion !== undefined) result.lastAutoInstallVersion = updates.lastAutoInstallVersion;
  return result;
}

/** Réglages lus d'un contenu JSON quelconque. Ne lève jamais. */
export function parseSettings(input: unknown): Settings {
  const data = isRecord(input) ? input : {};
  const shortcuts = isRecord(data.shortcuts) ? data.shortcuts : {};
  let toggleMain = normalizeAccelerator(shortcuts.toggleMain) ?? DEFAULT_SHORTCUTS.toggleMain;
  let paletteShortcut = normalizeAccelerator(shortcuts.palette) ?? DEFAULT_SHORTCUTS.palette;
  // Même règle que Rust : deux actions sur le même raccourci → valeurs par défaut.
  if (toggleMain === paletteShortcut) {
    toggleMain = DEFAULT_SHORTCUTS.toggleMain;
    paletteShortcut = DEFAULT_SHORTCUTS.palette;
  }
  // « Position suivante » (ajoutée après les deux autres) : en conflit, elle seule revient à sa
  // valeur par défaut, sans toucher aux deux premières.
  let farmNext = normalizeAccelerator(shortcuts.farmNext) ?? DEFAULT_SHORTCUTS.farmNext;
  if (farmNext === toggleMain || farmNext === paletteShortcut) farmNext = DEFAULT_SHORTCUTS.farmNext;
  const updates = isRecord(data.updates) ? data.updates : {};
  const tray = isRecord(data.tray) ? data.tray : {};
  return {
    // Comportement historique : seul `false` désactive le premier plan.
    alwaysOnTop: data.alwaysOnTop !== false,
    updates: parseUpdateSettings(updates),
    // Seul un booléen est lu ; sinon la valeur par défaut (même règle que Rust).
    tray: {
      minimizeToTray:
        typeof tray.minimizeToTray === 'boolean' ? tray.minimizeToTray : DEFAULT_SETTINGS.tray.minimizeToTray,
    },
    palette: parsePaletteSettings(data),
    shortcuts: { toggleMain, palette: paletteShortcut, farmNext },
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
    updates: { ...settings.updates, ...definedUpdateFields(patch.updates ?? {}) },
    tray: { minimizeToTray: patch.tray?.minimizeToTray ?? settings.tray.minimizeToTray },
    palette: { defaultVariant: patch.palette?.defaultVariant ?? settings.palette.defaultVariant },
  };
}

/**
 * Objet à écrire : le contenu actuel du fichier (`raw`, toutes clés conservées, `shortcuts`
 * compris) avec les seules clés que l'interface possède remplacées. Dans `tray`, seul
 * `minimizeToTray` est remplacé. Dans `updates`, seuls
 * `mode` et les champs DÉFINIS du moteur de mise à jour sont remplacés : les autres champs
 * (écrits par une version plus récente) sont conservés, de même qu'un champ connu non défini.
 */
export function mergeSettings(raw: unknown, settings: Settings): Record<string, unknown> {
  const base = isRecord(raw) ? raw : {};
  const updates = isRecord(base.updates) ? base.updates : {};
  const tray = isRecord(base.tray) ? base.tray : {};
  const palette = isRecord(base.palette) ? base.palette : {};
  return {
    ...base,
    alwaysOnTop: settings.alwaysOnTop,
    updates: { ...updates, ...definedUpdateFields(settings.updates), mode: settings.updates.mode },
    tray: { ...tray, minimizeToTray: settings.tray.minimizeToTray },
    palette: { ...palette, defaultVariant: settings.palette.defaultVariant },
  };
}
