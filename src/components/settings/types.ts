import type { Settings, SettingsPatch } from '../../features/settings/settings';

/**
 * Props communes à toutes les rubriques du panneau Paramètres. Une rubrique ne lit ni n'écrit
 * le disque elle-même : elle reçoit les réglages et signale ses changements, enregistrés dès
 * qu'ils ont lieu par `App`. (Exception : les raccourcis, possédés par Rust, passent par leur
 * propre pont `lib/tauri/shortcuts`.)
 */
export interface SettingsSectionProps {
  settings: Settings;
  onChange: (patch: SettingsPatch) => void;
}
