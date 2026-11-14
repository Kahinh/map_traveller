import { memo, useState, type MouseEvent } from 'react';
import type { FeedbackKind } from '../app/useCopyFeedback';
import type { Destination } from '../features/catalog/schema';
import { imageSrc } from '../lib/tauri/images';

interface Props {
  destination: Destination;
  favorite: boolean;
  feedback: FeedbackKind | null;
  onLeftClick: (d: Destination) => void;
  onRightClick: (d: Destination) => void;
  onToggleFavorite: (d: Destination) => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Carte carrée compacte. Clic gauche / droit réservés à la copie (ou à l'ouverture Farm) ;
 * l'étoile est un bouton frère, pas imbriqué. Mémoïsée : seules les cartes dont les props
 * changent sont re-rendues (retour de copie, favori).
 */
export const CompactCard = memo(function CompactCard({
  destination: d,
  favorite,
  feedback,
  onLeftClick,
  onRightClick,
  onToggleFavorite,
}: Props) {
  const src = imageSrc(d.image);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const isFarm = d.category === 'farm';

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault(); // jamais de menu contextuel parasite (CdC §4)
    onRightClick(d);
  };

  const hint = isFarm ? 'ouvrir le parcours' : 'clic gauche : sans Zaap · clic droit : complet';

  return (
    <div className={`card${feedback ? ` is-${feedback}` : ''}`}>
      <button
        type="button"
        className="card__main"
        title={`${d.name} — ${hint}`}
        onClick={() => onLeftClick(d)}
        onContextMenu={handleContextMenu}
      >
        {src && src !== brokenSrc ? (
          <img
            className="card__img"
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setBrokenSrc(src)}
          />
        ) : (
          <span className="card__placeholder" aria-hidden>
            {initials(d.name)}
          </span>
        )}
        {isFarm && <span className="card__badge">Farm</span>}
        {feedback === 'copied' && (
          <span className="card__check" aria-hidden>
            ✓
          </span>
        )}
        <span className="card__name">{d.name}</span>
      </button>
      <button
        type="button"
        className={`card__star${favorite ? ' is-on' : ''}`}
        title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        aria-label={favorite ? `Retirer ${d.name} des favoris` : `Ajouter ${d.name} aux favoris`}
        aria-pressed={favorite}
        onClick={() => onToggleFavorite(d)}
      >
        {favorite ? '★' : '☆'}
      </button>
    </div>
  );
});
