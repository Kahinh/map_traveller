import { closeWindow, minimizeWindow } from '../lib/tauri/window';
import { CloseIcon, MinimizeIcon, PinIcon } from './icons';

interface Props {
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
}

/** Barre de titre personnalisée (fenêtre sans décorations) : zone de déplacement + actions. */
export function WindowHeader({ alwaysOnTop, onToggleAlwaysOnTop }: Props) {
  const pinLabel = `Toujours au premier plan : ${alwaysOnTop ? 'activé' : 'désactivé'}`;
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
