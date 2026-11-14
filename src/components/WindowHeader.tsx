import { closeWindow, minimizeWindow } from '../lib/tauri/window';

interface Props {
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
}

/** Barre de titre personnalisée (fenêtre sans décorations) : zone de déplacement + actions. */
export function WindowHeader({ alwaysOnTop, onToggleAlwaysOnTop }: Props) {
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
        title={alwaysOnTop ? 'Toujours au premier plan : activé' : 'Toujours au premier plan : désactivé'}
        aria-pressed={alwaysOnTop}
        onClick={onToggleAlwaysOnTop}
      >
        📌
      </button>
      <button type="button" className="icon-btn" title="Réduire" onClick={() => void minimizeWindow()}>
        –
      </button>
      <button type="button" className="icon-btn" title="Fermer" onClick={() => void closeWindow()}>
        ✕
      </button>
    </header>
  );
}
