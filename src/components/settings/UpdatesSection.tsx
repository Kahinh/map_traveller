import { useEffect, useId, useState } from 'react';
import type { UpdateMode } from '../../features/settings/settings';
import { canCheckForUpdate, canInstallUpdate, describeUpdateState } from '../../features/updates/types';
import { getAppVersion } from '../../lib/tauri/app';
import { Segmented, SettingRow, type SegmentedOption } from '../controls';
import type { SettingsSectionProps } from './types';

/** Description d'une ligne sous le réglage (`short`) ; le détail complet en infobulle (`detail`). */
const MODE_TEXT: Record<UpdateMode, { short: string; detail: string }> = {
  manual: {
    short: "Rien n'est contacté sans votre action",
    detail: "Rien n'est contacté sans votre action : vous lancez vous-même la recherche avec le bouton « Rechercher ».",
  },
  auto: {
    short: "Vérifie à l'ouverture de la fenêtre, puis installe",
    detail:
      "Une vérification a lieu à l'ouverture de la fenêtre (lancement, retour depuis la zone de notification, au plus une toutes les deux minutes) ; une nouvelle version est alors téléchargée puis installée. Rien n'est vérifié tant que l'application est dans la zone de notification.",
  },
};

const MODE_OPTIONS: readonly SegmentedOption<UpdateMode>[] = [
  { value: 'manual', label: 'Manuel', title: MODE_TEXT.manual.detail },
  { value: 'auto', label: 'Automatique', title: MODE_TEXT.auto.detail },
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

  const mode = settings.updates.mode;
  const statusId = `${uid}-status`;
  const isError = state?.status === 'error';

  return (
    <div className="settings__block">
      <SettingRow label="Version installée">
        <span className="settings__value settings__mono">{versionText}</span>
      </SettingRow>

      <SettingRow
        label="Mode"
        labelId={`${uid}-mode-label`}
        description={MODE_TEXT[mode].short}
        descriptionId={`${uid}-mode-hint`}
        title={MODE_TEXT[mode].detail}
      >
        <Segmented
          value={mode}
          options={MODE_OPTIONS}
          onChange={(m) => onChange({ updates: { mode: m } })}
          labelledBy={`${uid}-mode-label`}
          describedBy={`${uid}-mode-hint`}
        />
      </SettingRow>

      <SettingRow
        label="Recherche"
        description={
          // Toujours présent pour que l'état soit annoncé par les lecteurs d'écran.
          <span className={isError ? 'settings__error' : undefined} role={isError ? 'alert' : 'status'}>
            {!updater.available ? updater.reason : (statusText ?? '')}
          </span>
        }
        descriptionId={statusId}
      >
        {state && canInstallUpdate(state) && updater.available && (
          <button type="button" className="btn btn--primary" onClick={updater.install}>
            Installer et redémarrer
          </button>
        )}
        <button
          type="button"
          className="btn"
          disabled={checkDisabled}
          aria-describedby={statusId}
          onClick={updater.available ? updater.check : undefined}
        >
          Rechercher
        </button>
      </SettingRow>

      {state?.status === 'available' && state.notes.trim() !== '' && (
        <p className="form__hint settings__notes">{state.notes}</p>
      )}
    </div>
  );
}
