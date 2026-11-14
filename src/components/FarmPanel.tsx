import type { MouseEvent } from 'react';
import type { FarmRoute } from '../features/farm/farmRoute';
import { BackIcon } from './icons';

interface Props {
  name: string;
  route: FarmRoute;
  /** Indice de la dernière position cliquée dans cette session, ou `null`. */
  currentStep: number | null;
  /** Clé de la carte ayant reçu un retour visuel : `start` ou indice d'étape. */
  feedbackKey: string | null;
  onStart: () => void;
  onStep: (index: number) => void;
  onClose: () => void;
}

/** Clic gauche et clic droit déclenchent la même action (CdC §5.3). */
const bothClicks = (fn: () => void) => ({
  onClick: fn,
  onContextMenu: (e: MouseEvent) => {
    e.preventDefault();
    fn();
  },
});

/**
 * Parcours Farm : une carte par position. Un clic sur une étape copie IMMÉDIATEMENT
 * la suite du parcours — aucun second clic (CdC §5.2). La dernière position cliquée
 * reste mise en évidence et les précédentes sont estompées, pour se repérer d'un coup d'œil.
 */
export function FarmPanel({ name, route, currentStep, feedbackKey, onStart, onStep, onClose }: Props) {
  const total = route.steps.length;
  const current = currentStep === null ? undefined : route.steps[currentStep];

  return (
    <section className="farm-panel" aria-label={`Parcours ${name}`}>
      <div className="farm-panel__header">
        <button type="button" className="icon-btn" title="Retour (Échap)" aria-label="Retour" onClick={onClose}>
          <BackIcon />
        </button>
        <span className="farm-panel__title" title={name}>
          {name}
        </span>
        <span className="farm-panel__progress">
          {current ? `Position ${current.label} · ${current.index + 1}/${total}` : `${total} étape${total > 1 ? 's' : ''}`}
        </span>
      </div>

      {route.issues.length > 0 && (
        <div className="farm-panel__issues">
          {route.issues.length} segment(s) non reconnu(s), absents des étapes :{' '}
          {route.issues.map((i) => `« ${i.segment.trim() || '(vide)'} »`).join(', ')}
        </div>
      )}

      <div className="grid-scroll">
        {total === 0 ? (
          <p className="empty">Aucune étape /travel reconnue dans ce parcours.</p>
        ) : (
          <div className="grid grid--steps">
            <button
              type="button"
              className={`step step--start${feedbackKey === 'start' ? ' is-copied' : ''}`}
              title="Copier le parcours complet"
              {...bothClicks(onStart)}
            >
              ▶ Début
            </button>
            {route.steps.map((s) => {
              const cls = [
                'step',
                currentStep !== null && s.index < currentStep && 'is-done',
                s.index === currentStep && 'is-current',
                feedbackKey === String(s.index) && (s.index === total - 1 ? 'is-warning' : 'is-copied'),
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={s.index}
                  type="button"
                  className={cls}
                  title={
                    s.index === total - 1 ? `${s.label} : dernière étape, rien à copier` : `Je suis en ${s.label} : copier la suite`
                  }
                  aria-current={s.index === currentStep ? 'step' : undefined}
                  {...bothClicks(() => onStep(s.index))}
                >
                  <span className="step__index">{s.index + 1}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
