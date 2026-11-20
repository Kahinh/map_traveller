import type { MouseEvent } from 'react';
import type { FarmRoute } from '../features/farm/farmRoute';
import { MarkIcon, PlayIcon } from './icons';

interface Props {
  route: FarmRoute;
  /** Case « Début » affichée : le parcours commence par un `/zaap` (`farmStartCommand`). */
  hasStart: boolean;
  /** Indice de la dernière position cliquée, ou `null`. */
  currentStep: number | null;
  /** Clé de la case ayant reçu un retour visuel : `start` ou indice d'étape. */
  feedbackKey: string | null;
  onStart: () => void;
  onStep: (index: number) => void;
}

/** Clic gauche et clic droit déclenchent la même action (invariant 3). */
const bothClicks = (fn: () => void) => ({
  onClick: fn,
  onContextMenu: (e: MouseEvent) => {
    e.preventDefault();
    fn();
  },
});

/**
 * Cases d'un parcours Farm : « Début » (Zaap et première position) si le parcours commence par
 * un `/zaap`, puis une case par position, qui copie son seul `/travel` (invariant 3). La
 * dernière position cliquée reste mise en évidence et les précédentes sont estompées, pour se
 * repérer d'un coup d'œil.
 */
export function FarmSteps({ route, hasStart, currentStep, feedbackKey, onStart, onStep }: Props) {
  const total = route.steps.length;
  return (
    <>
      {route.issues.length > 0 && (
        <div className="farm-panel__issues">
          {route.issues.length > 1
            ? `${route.issues.length} segments non reconnus, absents des étapes : `
            : '1 segment non reconnu, absent des étapes : '}
          {route.issues.map((i) => `« ${i.segment.trim() || '(vide)'} »`).join(', ')}
        </div>
      )}

      <div className="grid-scroll">
        {total === 0 ? (
          <div className="empty">
            <p className="empty__title">Aucune étape /travel reconnue dans ce parcours</p>
          </div>
        ) : (
          <div className="grid grid--steps">
            {hasStart && (
              <button
                type="button"
                className={`step step--start${feedbackKey === 'start' ? ' is-copied' : ''}`}
                title="Copier le Zaap et la première position"
                {...bothClicks(onStart)}
              >
                <PlayIcon />
                Début
              </button>
            )}
            {route.steps.map((s) => {
              const cls = [
                'step',
                currentStep !== null && s.index < currentStep && 'is-done',
                s.index === currentStep && 'is-current',
                feedbackKey === String(s.index) && 'is-copied',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={s.index}
                  type="button"
                  className={cls}
                  title={`Copier ${s.segment.trim()}`}
                  aria-current={s.index === currentStep ? 'step' : undefined}
                  {...bothClicks(() => onStep(s.index))}
                >
                  <span className="step__index">{s.index + 1}</span>
                  {s.index === currentStep && <MarkIcon className="step__mark" />}
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/** Texte de l'en-tête : position courante et rang, ou nombre d'étapes. */
export function farmProgressText(route: FarmRoute, currentStep: number | null): string {
  const total = route.steps.length;
  const current = currentStep === null ? undefined : route.steps[currentStep];
  return current ? `Position ${current.label} · ${current.index + 1}/${total}` : `${total} étape${total > 1 ? 's' : ''}`;
}
