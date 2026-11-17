interface Props {
  /** Message affiché ; `null` : aucune bulle. */
  text: string | null;
  warning?: boolean;
}

/**
 * Bulle d'état (copie, enregistrement, téléchargement d'une mise à jour). La région `status`
 * existe en permanence : un message qui y apparaît est annoncé par les lecteurs d'écran, ce
 * qui n'est pas garanti pour une région insérée avec son contenu.
 */
export function StatusBubble({ text, warning = false }: Props) {
  return (
    <div role="status">{text !== null && <div className={`status${warning ? ' is-warning' : ''}`}>{text}</div>}</div>
  );
}
