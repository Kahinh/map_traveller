import { useId } from 'react';
import type { SettingsSectionProps } from './types';

/**
 * Rubrique « Affichage ». « Toujours au premier plan » agit sur le même réglage que l'épingle
 * de la barre de titre : les deux restent synchronisés.
 */
export function DisplaySection({ settings, onChange }: SettingsSectionProps) {
  const hintId = useId();
  return (
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
        La fenêtre reste au-dessus des autres, même quand elle n'a pas le focus. Même réglage que l'épingle de la barre
        de titre.
      </p>
    </div>
  );
}
