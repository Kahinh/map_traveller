import { errorText } from '../lib/errors';
import { closeWindow, minimizeWindow } from '../lib/tauri/window';
import { CloseIcon, GearIcon, MarkIcon, MinimizeIcon, PinIcon } from './icons';

interface Props {
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  /** Panneau Paramètres ouvert (bouton enfoncé). */
  settingsOpen: boolean;
  /** Vrai pendant l'édition d'une destination : ouvrir les paramètres perdrait la saisie. */
  settingsDisabled: boolean;
  onToggleSettings: () => void;
  /** Échec d'une action de fenêtre (message court). */
  onError: (message: string) => void;
}

/** Barre de titre personnalisée (fenêtre sans décorations) : zone de déplacement + actions. */
export function WindowHeader({
  alwaysOnTop,
  onToggleAlwaysOnTop,
  settingsOpen,
  settingsDisabled,
  onToggleSettings,
  onError,
}: Props) {
  const onMinimize = () => {
    minimizeWindow().catch((e: unknown) => onError(`Réduction impossible : ${errorText(e)}`));
  };
  const onClose = () => {
    closeWindow().catch((e: unknown) => onError(`Fermeture impossible : ${errorText(e)}`));
  };
  const pinLabel = `Toujours au premier plan : ${alwaysOnTop ? 'activé' : 'désactivé'}`;
  const settingsTitle = settingsDisabled
    ? "Paramètres indisponibles pendant l'édition"
    : settingsOpen
      ? 'Fermer les paramètres (Échap)'
      : 'Paramètres';
  return (
    <header className="titlebar" data-tauri-drag-region>
      <MarkIcon className="titlebar__mark" dragRegion />
      <span className="titlebar__title" data-tauri-drag-region>
        Map Traveller
      </span>
      <button
        type="button"
        className={`icon-btn${settingsOpen ? ' is-active' : ''}`}
        title={settingsTitle}
        aria-label="Paramètres"
        aria-pressed={settingsOpen}
        disabled={settingsDisabled}
        onClick={onToggleSettings}
      >
        <GearIcon />
      </button>
      <button
        type="button"
        className={`icon-btn${alwaysOnTop ? ' is-active' : ''}`}
        title={pinLabel}
        aria-label={pinLabel}
        aria-pressed={alwaysOnTop}
        onClick={onToggleAlwaysOnTop}
      >
        <PinIcon filled={alwaysOnTop} />
      </button>
      <button type="button" className="icon-btn" title="Réduire" aria-label="Réduire" onClick={onMinimize}>
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--close"
        title="Fermer"
        aria-label="Fermer"
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </header>
  );
}
