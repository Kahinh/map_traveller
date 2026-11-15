import { useId } from 'react';
import type { SettingsSectionProps } from './types';

/**
 * Rubrique « Affichage ». « Toujours au premier plan » agit sur le même réglage que l'épingle
 * de la barre de titre : les deux restent synchronisés. « Réduire dans la zone de notification »
 * est lu par Rust au moment de réduire (issue n°14).
 */
export function DisplaySection({ settings, onChange }: SettingsSectionProps) {
  const hintId = useId();
  const trayHintId = useId();
  return (
    <>
      <div className="form__field">
        <label className="form__check">
          <input
            type="checkbox"
            checked={settings.alwaysOnTop}
            aria-describedby={hintId}
            onChange={(e) => onChange({ alwaysOnTop: e.target.checked })}
          />
          <span>Toujours au premier plan</span>
        </label>
        <p className="form__hint" id={hintId}>
          La fenêtre reste au-dessus des autres, même quand elle n'a pas le focus. Même réglage que l'épingle de la
          barre de titre.
        </p>
      </div>
      <div className="form__field">
        <label className="form__check">
          <input
            type="checkbox"
            checked={settings.tray.minimizeToTray}
            aria-describedby={trayHintId}
            onChange={(e) => onChange({ tray: { minimizeToTray: e.target.checked } })}
          />
          <span>Réduire dans la zone de notification</span>
        </label>
        <p className="form__hint" id={trayHintId}>
          Le bouton réduire et le raccourci « afficher / masquer » ferment la fenêtre et laissent Map Traveller dans la
          zone de notification, à droite de la barre des tâches. Le bouton fermer quitte l'application. La palette
          reste disponible par son raccourci.
        </p>
      </div>
    </>
  );
}
