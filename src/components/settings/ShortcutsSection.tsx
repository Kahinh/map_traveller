import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import {
  captureAccelerator,
  formatAccelerator,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  type ShortcutAction,
  type ShortcutsState,
} from '../../features/settings/accelerator';
import { errorText } from '../../lib/errors';
import { IS_TAURI } from '../../lib/tauri/env';
import { getShortcuts, resetShortcuts, setShortcut } from '../../lib/tauri/shortcuts';
import { InstalledOnly } from '../controls';

const NOT_REGISTERED =
  "Ce raccourci n'est pas actif : il est sans doute déjà utilisé par une autre application. Choisissez-en un autre.";

type Errors = Partial<Record<ShortcutAction, string>>;

/**
 * Rubrique « Raccourcis » : saisie par capture (clic sur le champ, appui sur la combinaison,
 * `Échap` annule). Rust valide, enregistre et mémorise ; son message d'erreur s'affiche sous
 * le champ et l'ancien raccourci reste actif.
 *
 * Sans props : les réglages en mémoire ne servent pas ici, les raccourcis appartiennent à Rust
 * et sont relus à chaque ouverture. Compatible avec `ComponentType<SettingsSectionProps>`.
 */
export function ShortcutsSection() {
  const uid = useId();
  const available = IS_TAURI;
  const [state, setState] = useState<ShortcutsState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);
  /** Indication pendant la capture (combinaison refusée avant envoi à Rust). */
  const [hint, setHint] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [resetError, setResetError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getShortcuts()
      .then((s) => {
        if (alive) setState(s);
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const stopCapture = () => {
    setCapturing(null);
    setHint(null);
  };

  const apply = async (action: ShortcutAction, accelerator: string) => {
    stopCapture();
    setBusy(true);
    try {
      setState(await setShortcut(action, accelerator));
      setErrors((prev) => ({ ...prev, [action]: undefined }));
      setResetError(null);
    } catch (e) {
      setErrors((prev) => ({ ...prev, [action]: errorText(e) }));
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    if (busy) return;
    stopCapture();
    setBusy(true);
    try {
      setState(await resetShortcuts());
      setErrors({});
      setResetError(null);
    } catch (e) {
      setResetError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const onFieldClick = (action: ShortcutAction) => {
    if (busy) return;
    if (capturing === action) {
      stopCapture();
      return;
    }
    setCapturing(action);
    setHint(null);
    setErrors((prev) => ({ ...prev, [action]: undefined }));
  };

  const onFieldKeyDown = (action: ShortcutAction, e: KeyboardEvent<HTMLButtonElement>) => {
    if (capturing !== action) return; // bouton ordinaire : Entrée / Espace lancent la capture
    // Tab sans modificateur : quitter le champ normalement (la perte de focus annule).
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) return;
    // Rien ne remonte à la fenêtre : `Échap` annule la capture sans fermer le panneau.
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    const result = captureAccelerator(e);
    switch (result.kind) {
      case 'cancel':
        stopCapture();
        return;
      case 'pending':
        return;
      case 'invalid':
        setHint(result.message);
        return;
      case 'ok':
        void apply(action, result.accelerator);
    }
  };

  return (
    <>
      <p className="form__hint">
        Raccourcis actifs dans tout Windows, même quand une autre fenêtre a le focus. Cliquez sur un champ puis appuyez
        sur la combinaison voulue (Ctrl ou Alt, plus une lettre, un chiffre, F1 à F12 ou Espace).
      </p>
      {!available && <InstalledOnly block />}
      {loadError && (
        <p className="form__error" role="alert">
          {loadError}
        </p>
      )}

      <div className="settings__block">
        {SHORTCUT_ACTIONS.map((action) => {
          const status = state?.[action];
          const isCapturing = capturing === action;
          const label = SHORTCUT_LABELS[action];
          const labelId = `${uid}-${action}-label`;
          const messageId = `${uid}-${action}-message`;
          const error = errors[action];
          const warning = available && status && !status.registered && !error ? NOT_REGISTERED : null;
          const message = isCapturing ? (hint ?? 'Échap pour annuler') : (error ?? warning);
          return (
            <div key={action} className="setting setting--stacked">
              <div className="setting__line">
                <span className="setting__label" id={labelId}>
                  {label}
                </span>
                <button
                  type="button"
                  className={`shortcut-field${isCapturing ? ' is-capturing' : ''}`}
                  aria-labelledby={labelId}
                  aria-describedby={message ? messageId : undefined}
                  aria-pressed={isCapturing}
                  title={isCapturing ? 'Échap pour annuler' : 'Cliquer pour changer'}
                  disabled={!available || !status}
                  // Pendant l'enregistrement, le champ garde le focus : le résultat s'annonce sous lui.
                  aria-disabled={busy || undefined}
                  onClick={() => onFieldClick(action)}
                  onKeyDown={(e) => onFieldKeyDown(action, e)}
                  onBlur={() => {
                    if (isCapturing) stopCapture();
                  }}
                >
                  {isCapturing
                    ? 'Appuyez sur la combinaison'
                    : status
                      ? formatAccelerator(status.accelerator)
                      : '…'}
                </button>
              </div>
              {message && (
                <p id={messageId} className={isCapturing ? 'form__hint' : 'form__error'} role={isCapturing ? undefined : 'alert'}>
                  {message}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="settings__actions">
        <button
          type="button"
          className="btn"
          disabled={!available || !state}
          aria-disabled={busy || undefined}
          onClick={() => void onReset()}
        >
          Rétablir par défaut
        </button>
      </div>
      {resetError && (
        <p className="form__error" role="alert">
          {resetError}
        </p>
      )}
    </>
  );
}
