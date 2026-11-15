import { closeWindow, minimizeWindow } from '../lib/tauri/window';
import { CloseIcon, GearIcon, MinimizeIcon, PinIcon } from './icons';

interface Props {
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  /** Panneau Paramètres ouvert (bouton enfoncé). */
  settingsOpen: boolean;
  /** Vrai pendant l'édition d'une destination : ouvrir les paramètres perdrait la saisie. */
  settingsDisabled: boolean;
  onToggleSettings: () => void;
}

/** Barre de titre personnalisée (fenêtre sans décorations) : zone de déplacement + actions. */
export function WindowHeader({ alwaysOnTop, onToggleAlwaysOnTop, settingsOpen, settingsDisabled, onToggleSettings }: Props) {
  const pinLabel = `Toujours au premier plan : ${alwaysOnTop ? 'activé' : 'désactivé'}`;
  const settingsTitle = settingsDisabled
    ? "Paramètres (indisponibles pendant l'édition)"
    : settingsOpen
      ? 'Fermer les paramètres (Échap)'
      : 'Paramètres';
  return (
    <header className="titlebar" data-tauri-drag-region>
      <span className="titlebar__logo" aria-hidden>
        MT
      </span>
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
      <button type="button" className="icon-btn" title="Réduire" aria-label="Réduire" onClick={() => void minimizeWindow()}>
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--close"
        title="Fermer"
        aria-label="Fermer"
        onClick={() => void closeWindow()}
      >
        <CloseIcon />
      </button>
    </header>
  );
}
