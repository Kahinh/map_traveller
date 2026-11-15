import { useEffect, useId, useState } from 'react';
import type { UpdateMode } from '../../features/settings/settings';
import { canCheckForUpdate, canInstallUpdate, describeUpdateState } from '../../features/updates/types';
import { getAppVersion } from '../../lib/tauri/app';
import type { SettingsSectionProps } from './types';

const MODE_OPTIONS: { mode: UpdateMode; label: string; hint: string }[] = [
  {
    mode: 'manual',
    label: 'Manuel',
    hint: "Rien n'est contacté sans votre action : vous lancez vous-même la recherche avec le bouton ci-dessous.",
  },
  {
    mode: 'auto',
    label: 'Automatique',
    hint: "Une vérification a lieu à l'ouverture de la fenêtre (lancement, retour depuis la zone de notification, au plus une toutes les deux minutes) ; une nouvelle version est alors téléchargée puis installée. Rien n'est vérifié tant que l'application est dans la zone de notification.",
  },
];

/**
 * Rubrique « Mises à jour » : version installée, choix du mode (enregistré dès qu'il change)
 * et recherche manuelle. AUCUNE logique de mise à jour ici : l'état et les actions viennent
 * de `updater` (moteur de l'issue n°5), indisponible tant qu'il n'est pas livré.
 */
export function UpdatesSection({ settings, onChange, updater }: SettingsSectionProps) {
  const uid = useId();
  /** `undefined` : lecture en cours ; `null` : hors application installée. */
  const [version, setVersion] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getAppVersion()
      .then((v) => {
        if (alive) setVersion(v);
      })
      .catch(() => {
        if (alive) setVersion(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const versionText = version === undefined ? '…' : (version ?? 'version de développement');
  const state = updater.available ? updater.state : null;
  const statusText = state ? describeUpdateState(state, version ?? null) : null;
  const checkDisabled = !updater.available || !canCheckForUpdate(updater.state);

  return (
    <>
      <div className="form__field">
        <span className="form__label">Version installée</span>
        <span className="settings__value">{versionText}</span>
      </div>

      <fieldset className="settings__group">
        <legend className="form__label">Mode de mise à jour</legend>
        {MODE_OPTIONS.map((o) => {
          const hintId = `${uid}-${o.mode}-hint`;
          return (
            <label key={o.mode} className="form__check settings__option">
              <input
                type="radio"
                name={`${uid}-mode`}
                value={o.mode}
                checked={settings.updates.mode === o.mode}
                aria-describedby={hintId}
                onChange={() => onChange({ updates: { mode: o.mode } })}
              />
              <span>{o.label}</span>
              <span className="form__hint settings__option-hint" id={hintId}>
                {o.hint}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="settings__actions">
        <button
          type="button"
          className="btn"
          disabled={checkDisabled}
          aria-describedby={!updater.available || statusText ? `${uid}-status` : undefined}
          onClick={updater.available ? updater.check : undefined}
        >
          Rechercher des mises à jour
        </button>
        {state && canInstallUpdate(state) && updater.available && (
          <button type="button" className="btn btn--primary" onClick={updater.install}>
            Installer et redémarrer
          </button>
        )}
      </div>
      {!updater.available && (
        <p className="form__hint" id={`${uid}-status`}>
          {updater.reason}
        </p>
      )}
      {statusText && (
        <p
          className={state?.status === 'error' ? 'form__error' : 'form__hint'}
          id={`${uid}-status`}
          role={state?.status === 'error' ? 'alert' : 'status'}
        >
          {statusText}
        </p>
      )}
      {state?.status === 'available' && state.notes.trim() !== '' && (
        <p className="form__hint settings__notes">{state.notes}</p>
      )}
    </>
  );
}
