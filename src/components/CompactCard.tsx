import { useEffect, useState, type MouseEvent } from 'react';
import type { Destination } from '../features/catalog/schema';
import { resolveImageSrc } from '../lib/tauri/images';

export type Feedback = 'copied' | 'warning' | null;

interface Props {
  destination: Destination;
  favorite: boolean;
  feedback: Feedback;
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

/** Carte carrée compacte. Clic gauche / droit réservés à la copie (ou à l'ouverture Farm). */
export function CompactCard({ destination: d, favorite, feedback, onLeftClick, onRightClick, onToggleFavorite }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    resolveImageSrc(d.image).then(
      (s) => alive && setSrc(s),
      () => alive && setSrc(null),
    );
    return () => {
      alive = false;
    };
  }, [d.image]);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault(); // jamais de menu contextuel parasite (CdC §4)
    onRightClick(d);
  };

  const handleStar = (e: MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(d);
  };

  const cls = ['card', feedback === 'copied' && 'is-copied', feedback === 'warning' && 'is-warning']
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={cls} title={d.name} onClick={() => onLeftClick(d)} onContextMenu={handleContextMenu}>
      {src && src !== brokenSrc ? (
        <img className="card__img" src={src} alt="" draggable={false} onError={() => setBrokenSrc(src)} />
      ) : (
        <span className="card__placeholder" aria-hidden>
          {initials(d.name)}
        </span>
      )}
      {d.category === 'farm' && <span className="card__badge">Farm</span>}
      <span
        role="button"
        tabIndex={-1}
        className={`card__star${favorite ? ' is-on' : ''}`}
        title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        onClick={handleStar}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {favorite ? '★' : '☆'}
      </span>
      {feedback === 'copied' && (
        <span className="card__check" aria-hidden>
          ✓
        </span>
      )}
      <span className="card__name">{d.name}</span>
    </button>
  );
}
