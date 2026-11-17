import type { AliasesBinding } from '../../app/useAliases';
import type { Destination } from '../../features/catalog/schema';
import type { Settings, SettingsPatch } from '../../features/settings/settings';
import type { UpdaterBinding } from '../../features/updates/types';

/**
 * Props communes à toutes les rubriques du panneau Paramètres. Une rubrique ne lit ni n'écrit
 * le disque elle-même : elle reçoit les réglages et signale ses changements, enregistrés dès
 * qu'ils ont lieu par `useSettings`. (Exceptions : les raccourcis, possédés par Rust, passent
 * par leur propre pont `lib/tauri/shortcuts` ; la rubrique « Données » lit le chemin du dossier
 * par `lib/tauri/dataDir` ; les alias, rangés dans leur propre fichier, passent par `useAliases`.)
 */
export interface SettingsSectionProps {
  settings: Settings;
  onChange: (patch: SettingsPatch) => void;
  /** Moteur de mise à jour (issue n°5) ; indisponible hors de l'application installée. */
  updater: UpdaterBinding;
  /** Dictionnaire global d'alias de recherche (issue n°10) et son enregistrement. */
  aliases: AliasesBinding;
  /** Catalogue courant : sert à compter les destinations trouvées par chaque alias. */
  destinations: readonly Destination[];
}
