import { memo, type MouseEvent } from 'react';
import type { FeedbackKind } from '../app/useCopyFeedback';
import type { Destination } from '../features/catalog/schema';
import { isTwoStep, type ClickButton, type PartIndex } from '../features/commands/cardParts';
import { CheckIcon, PencilIcon, StarIcon } from './icons';
import { SplitCardArt } from './SplitCardArt';
import { CardVisual } from './Thumb';

interface Props {
  destination: Destination;
  favorite: boolean;
  feedback: FeedbackKind | null;
  /** Zone concernée par le retour de copie (carte à deux étapes uniquement). */
  feedbackPart: PartIndex | null;
  onAction: (d: Destination, part: PartIndex, button: ClickButton) => void;
  onToggleFavorite: (d: Destination) => void;
  /** Mode gestion : affiche le crayon qui ouvre le formulaire. Les clics de copie sont inchangés. */
  manage: boolean;
  onEdit: (d: Destination) => void;
}

/** Libellés des étapes : le passage entre les deux reste manuel. */
const STEP_LABELS: Record<PartIndex, string> = {
  1: 'étape 1 : accès',
  2: 'étape 2 : sur place',
};

const COPY_HINT = 'clic gauche : sans Zaap · clic droit : complet';

/** Nom en surimpression : le conteneur porte le dégradé, le texte est coupé à deux lignes. */
export function CardName({ name }: { name: string }) {
  return (
    <span className="card__name">
      <span className="card__label">{name}</span>
    </span>
  );
}

/**
 * Carte carrée compacte. Clic gauche / droit réservés à la copie (ou à l'ouverture Farm) ;
 * l'étoile est un bouton frère, pas imbriqué. Mémoïsée : seules les cartes dont les props
 * changent sont re-rendues (retour de copie, favori).
 *
 * Carte à deux étapes : deux triangles séparés par un interstice transparent (diagonale
 * bas-gauche → haut-droite). Une seule image, dans le calque `SplitCardArt` découpé une fois ;
 * deux boutons superposés découpés chacun selon son triangle par `clip-path`. Chaque zone
 * applique les règles de copie à sa propre commande ; l'interstice n'est pas cliquable.
 */
export const CompactCard = memo(function CompactCard({
  destination: d,
  favorite,
  feedback,
  feedbackPart,
  onAction,
  onToggleFavorite,
  manage,
  onEdit,
}: Props) {
  const isFarm = d.category === 'farm';
  const split = isTwoStep(d);

  const contextMenu = (part: PartIndex) => (e: MouseEvent) => {
    e.preventDefault(); // jamais de menu contextuel parasite (CdC §4)
    onAction(d, part, 'right');
  };

  const star = (
    <button
      type="button"
      className={`card__star${favorite ? ' is-on' : ''}`}
      title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-label={favorite ? `Retirer ${d.name} des favoris` : `Ajouter ${d.name} aux favoris`}
      aria-pressed={favorite}
      onClick={() => onToggleFavorite(d)}
    >
      <StarIcon filled={favorite} />
    </button>
  );

  // Bouton frère des zones de copie (jamais imbriqué) : seul lui ouvre le formulaire.
  const edit = manage && (
    <button
      type="button"
      className="card__edit"
      title={`Modifier ${d.name}`}
      aria-label={`Modifier ${d.name}`}
      onClick={() => onEdit(d)}
    >
      <PencilIcon />
    </button>
  );

  if (split) {
    const part = feedback ? feedbackPart : null;
    return (
      <div className={`card card--split${feedback && part ? ` is-${feedback} is-part-${part}` : ''}`} data-id={d.id}>
        <SplitCardArt name={d.name} image={d.image} />
        {([1, 2] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`card__zone card__zone--${p}`}
            title={`${d.name} — ${STEP_LABELS[p]} · ${COPY_HINT}`}
            aria-label={`Copier l'étape ${p} de ${d.name}`}
            onClick={() => onAction(d, p, 'left')}
            onContextMenu={contextMenu(p)}
          />
        ))}
        <CardName name={d.name} />
        {feedback === 'copied' && part && (
          <span className={`card__check card__check--${part}`} aria-hidden>
            <span className="card__check-mark">
              <CheckIcon />
            </span>
          </span>
        )}
        {star}
        {edit}
      </div>
    );
  }

  const hint = isFarm ? 'ouvrir le parcours' : COPY_HINT;

  return (
    <div className={`card${feedback ? ` is-${feedback}` : ''}`} data-id={d.id}>
      <button
        type="button"
        className="card__main"
        title={`${d.name} — ${hint}`}
        onClick={() => onAction(d, 1, 'left')}
        onContextMenu={contextMenu(1)}
      >
        <CardVisual name={d.name} image={d.image} />
        {isFarm && !manage && <span className="card__badge">Farm</span>}
        <CardName name={d.name} />
        {feedback === 'copied' && (
          <span className="card__check" aria-hidden>
            <span className="card__check-mark">
              <CheckIcon />
            </span>
          </span>
        )}
      </button>
      {star}
      {edit}
    </div>
  );
});
