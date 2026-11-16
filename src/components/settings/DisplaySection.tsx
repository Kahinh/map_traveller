import { useId } from 'react';
import { SettingRow, Switch } from '../controls';
import type { SettingsSectionProps } from './types';

const ON_TOP_DETAIL =
  "La fenêtre reste au-dessus des autres, même quand elle n'a pas le focus. Même réglage que l'épingle de la barre de titre.";
const TRAY_DETAIL =
  "Le bouton réduire et le raccourci « afficher / masquer » ferment la fenêtre et laissent Map Traveller dans la zone de notification, à droite de la barre des tâches. Le bouton fermer quitte l'application. La palette reste disponible par son raccourci.";

/**
 * Rubrique « Affichage ». « Toujours au premier plan » agit sur le même réglage que l'épingle
 * de la barre de titre : les deux restent synchronisés. « Réduire dans la zone de notification »
 * est lu par Rust au moment de réduire (issue n°14).
 */
export function DisplaySection({ settings, onChange }: SettingsSectionProps) {
  const uid = useId();
  return (
    <div className="settings__block">
      <SettingRow
        label="Toujours au premier plan"
        htmlFor={`${uid}-on-top`}
        description="Même réglage que l'épingle de la barre de titre"
        descriptionId={`${uid}-on-top-hint`}
        title={ON_TOP_DETAIL}
      >
        <Switch
          id={`${uid}-on-top`}
          checked={settings.alwaysOnTop}
          describedBy={`${uid}-on-top-hint`}
          onChange={(checked) => onChange({ alwaysOnTop: checked })}
        />
      </SettingRow>
      <SettingRow
        label="Réduire dans la zone de notification"
        htmlFor={`${uid}-tray`}
        description="Réduire range la fenêtre près de l'horloge ; fermer quitte"
        descriptionId={`${uid}-tray-hint`}
        title={TRAY_DETAIL}
      >
        <Switch
          id={`${uid}-tray`}
          checked={settings.tray.minimizeToTray}
          describedBy={`${uid}-tray-hint`}
          onChange={(checked) => onChange({ tray: { minimizeToTray: checked } })}
        />
      </SettingRow>
    </div>
  );
}
