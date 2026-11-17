import { useEffect, useRef } from 'react';
import type { AliasRow } from '../../features/aliases/aliases';
import { Switch } from '../controls';

function countLabel(count: number): string {
  if (count === 0) return 'aucune destination';
  return count === 1 ? '1 destination' : `${count} destinations`;
}

interface Props {
  row: AliasRow;
  /** Destinations trouvées par l'alias ; absent si l'alias est désactivé. */
  count: number | undefined;
  /** La suppression de cet alias attend une confirmation. */
  confirming: boolean;
  /** Modification impossible (chargement, fichier illisible). */
  blocked: boolean;
  /** Écriture en cours : les boutons gardent le focus (`aria-disabled`). */
  busy: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
  onRemove: () => void;
  onCancelRemove: () => void;
  onToggle: (enabled: boolean) => void;
}

/**
 * Un alias : terme et significations, origine, nombre de destinations trouvées, actions.
 * Confirmation de suppression dans la ligne, comme dans le formulaire (Supprimer / Annuler) ;
 * annulée, elle rend le focus au bouton « Supprimer ».
 */
export function AliasRowItem({
  row,
  count,
  confirming,
  blocked,
  busy,
  onEdit,
  onAskRemove,
  onRemove,
  onCancelRemove,
  onToggle,
}: Props) {
  const deleteRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (confirming || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    deleteRef.current?.focus();
  }, [confirming]);

  const busyAttr = busy || undefined;
  const origin =
    row.origin === 'default'
      ? 'fourni'
      : row.overridesDefault
        ? "personnalisé, remplace l'alias fourni"
        : 'personnalisé';

  let actions;
  if (row.origin === 'default') {
    actions = (
      <>
        {row.enabled && (
          <button
            type="button"
            className="btn"
            disabled={blocked}
            aria-disabled={busyAttr}
            aria-label={`Personnaliser l'alias ${row.term}`}
            onClick={() => !busy && onEdit()}
          >
            Personnaliser
          </button>
        )}
        <Switch
          checked={row.enabled}
          disabled={blocked}
          busy={busy}
          label={`Alias ${row.term} actif`}
          title={row.enabled ? 'Désactiver' : 'Réactiver'}
          onChange={onToggle}
        />
      </>
    );
  } else if (confirming) {
    actions = (
      <>
        <span className="aliases__confirm">Supprimer « {row.term} » ?</span>
        <button
          type="button"
          className="btn btn--danger"
          disabled={blocked}
          aria-disabled={busyAttr}
          onClick={() => !busy && onRemove()}
        >
          Supprimer
        </button>
        <button
          type="button"
          className="btn"
          autoFocus
          aria-disabled={busyAttr}
          onClick={() => {
            if (busy) return;
            restoreFocusRef.current = true;
            onCancelRemove();
          }}
        >
          Annuler
        </button>
      </>
    );
  } else {
    actions = (
      <>
        <button
          type="button"
          className="btn"
          disabled={blocked}
          aria-disabled={busyAttr}
          aria-label={`Modifier l'alias ${row.term}`}
          onClick={() => !busy && onEdit()}
        >
          Modifier
        </button>
        <button
          ref={deleteRef}
          type="button"
          className="btn btn--danger-ghost"
          disabled={blocked}
          aria-disabled={busyAttr}
          aria-label={`Supprimer l'alias ${row.term}`}
          onClick={onAskRemove}
        >
          Supprimer
        </button>
      </>
    );
  }

  return (
    <li className={`setting aliases__row${row.enabled ? '' : ' is-off'}`}>
      <span className="setting__text">
        <span className="aliases__head">
          <span className="aliases__name">{row.term}</span>
          <span className="aliases__meanings">{row.expansions.join(' · ')}</span>
        </span>
        <span className="setting__description">
          {origin}
          {' · '}
          {row.enabled && count !== undefined ? countLabel(count) : 'désactivé'}
        </span>
      </span>
      <span className="setting__control">{actions}</span>
    </li>
  );
}
