/** Contenu de la bulle : message, texte copié éventuel, détail technique en infobulle. */
export interface StatusMessage {
  text: string;
  command?: string;
  detail?: string;
}

interface Props {
  /** Message affiché ; `null` : aucune bulle. */
  message: StatusMessage | null;
  warning?: boolean;
}

/**
 * Bulle d'état (copie, enregistrement, téléchargement d'une mise à jour). La région `status`
 * existe en permanence : un message qui y apparaît est annoncé par les lecteurs d'écran, ce
 * qui n'est pas garanti pour une région insérée avec son contenu.
 */
export function StatusBubble({ message, warning = false }: Props) {
  return (
    <div role="status">
      {message !== null && (
        <div className={`status${warning ? ' is-warning' : ''}`} title={message.detail}>
          {message.text}
          {message.command !== undefined && (
            <>
              {' : '}
              <code className="status__cmd">{message.command}</code>
            </>
          )}
        </div>
      )}
    </div>
  );
}
