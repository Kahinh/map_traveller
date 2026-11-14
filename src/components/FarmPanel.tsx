import { useMemo, type MouseEvent } from 'react';
import type { Destination } from '../features/catalog/schema';
import { parseFarmRoute } from '../features/farm/farmRoute';

interface Props {
  destination: Destination;
  /** Clé de la carte ayant reçu un retour visuel : `start` ou indice d'étape. */
  feedbackKey: string | null;
  onStart: () => void;
  onStep: (index: number) => void;
  onClose: () => void;
}

/**
 * Parcours Farm : une carte par position. Un clic (gauche ou droit) sur une étape
 * copie IMMÉDIATEMENT la suite du parcours — aucun second clic (CdC §5.2).
 */
export function FarmPanel({ destination, feedbackKey, onStart, onStep, onClose }: Props) {
  const route = useMemo(() => parseFarmRoute(destination.command), [destination.command]);

  const both = (fn: () => void) => ({
    onClick: fn,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      fn();
    },
  });

  return (
    <section className="farm-panel" aria-label={`Parcours ${destination.name}`}>
      <div className="farm-panel__header">
        <button type="button" className="icon-btn" title="Retour" onClick={onClose}>
          ←
        </button>
        <span className="farm-panel__title" title={destination.name}>
          {destination.name} · {route.steps.length} étape{route.steps.length > 1 ? 's' : ''}
        </span>
      </div>

      {route.issues.length > 0 && (
        <div className="farm-panel__issues">
          {route.issues.length} segment(s) non reconnu(s) ignoré(s) pour les étapes :{' '}
          {route.issues.map((i) => `« ${i.segment.trim() || '(vide)'} »`).join(', ')}
        </div>
      )}

      <div className="grid-scroll">
        <div className="grid grid--steps">
          <button
            type="button"
            className={`card card--step card--start${feedbackKey === 'start' ? ' is-copied' : ''}`}
            title="Copier le parcours complet"
            {...both(onStart)}
          >
            ▶ Début
          </button>
          {route.steps.map((s) => (
            <button
              key={s.index}
              type="button"
              className={`card card--step${feedbackKey === String(s.index) ? ' is-copied' : ''}`}
              title={`Je suis en ${s.label} : copier la suite`}
              {...both(() => onStep(s.index))}
            >
              <span className="card__index">{s.index + 1}</span>
              {s.label}
            </button>
          ))}
        </div>
        {route.steps.length === 0 && <p className="empty">Aucune étape /travel reconnue dans ce parcours.</p>}
      </div>
    </section>
  );
}
