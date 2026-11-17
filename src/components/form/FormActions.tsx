export type Busy = null | 'save' | 'delete' | 'image';
export type Confirm = null | 'discard' | 'delete';

/** Attribut des boutons qui ouvrent une confirmation : le focus leur revient quand elle est annulée. */
export const FOCUS_KEY_ATTR = 'data-focus-key';

interface Props {
  /** Modification d'une destination existante (Supprimer, Dupliquer). */
  isEdit: boolean;
  name: string;
  dirty: boolean;
  busy: Busy;
  confirm: Confirm;
  error: string | null;
  onAskDelete: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onDiscard: () => void;
  /** Ferme la confirmation en cours. */
  onBack: () => void;
}

/**
 * Barre d'actions fixée en bas du formulaire. Les confirmations (abandon, suppression) s'y
 * affichent à la place des actions, jamais dans un dialogue natif ; « Continuer » et « Annuler »
 * y prennent le focus.
 */
export function FormActions({
  isEdit,
  name,
  dirty,
  busy,
  confirm,
  error,
  onAskDelete,
  onDelete,
  onDuplicate,
  onCancel,
  onDiscard,
  onBack,
}: Props) {
  const locked = busy !== null;
  return (
    <div className="form__actions">
      {error && (
        <p className="form__alert" role="alert">
          {error}
        </p>
      )}
      {confirm === 'discard' && (
        <>
          <span className="form__confirm">Abandonner les modifications ?</span>
          <button type="button" className="btn btn--danger" onClick={onDiscard}>
            Abandonner
          </button>
          <button type="button" className="btn" autoFocus onClick={onBack}>
            Continuer
          </button>
        </>
      )}
      {confirm === 'delete' && (
        <>
          <span className="form__confirm" title={name}>
            Supprimer « {name} » ?
          </span>
          <button type="button" className="btn btn--danger" disabled={locked} onClick={onDelete}>
            {busy === 'delete' ? 'Suppression…' : 'Supprimer'}
          </button>
          <button type="button" className="btn" autoFocus disabled={locked} onClick={onBack}>
            Annuler
          </button>
        </>
      )}
      {confirm === null && (
        <>
          {isEdit && (
            <button
              type="button"
              className="btn btn--danger-ghost"
              data-focus-key="delete"
              disabled={locked}
              onClick={onAskDelete}
            >
              Supprimer
            </button>
          )}
          {isEdit && (
            <button
              type="button"
              className="btn"
              disabled={locked || dirty}
              title={
                dirty ? "Enregistrez ou annulez d'abord les modifications" : 'Créer une copie de cette destination'
              }
              onClick={onDuplicate}
            >
              Dupliquer
            </button>
          )}
          <span className="form__spacer" />
          <button type="button" className="btn" data-focus-key="cancel" disabled={locked} onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="btn btn--primary" disabled={locked} title="Enregistrer (Ctrl+Entrée)">
            {busy === 'save' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      )}
    </div>
  );
}
