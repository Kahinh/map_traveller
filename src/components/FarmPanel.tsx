import type { FarmRoute } from '../features/farm/farmRoute';
import { farmProgressText, FarmSteps } from './FarmSteps';
import { Panel } from './Panel';

interface Props {
  name: string;
  route: FarmRoute;
  hasStart: boolean;
  /** Indice de la dernière position cliquée dans cette session, ou `null`. */
  currentStep: number | null;
  /** Clé de la case ayant reçu un retour visuel : `start` ou indice d'étape. */
  feedbackKey: string | null;
  onStart: () => void;
  onStep: (index: number) => void;
  onClose: () => void;
}

/**
 * Parcours Farm dans la fenêtre principale : mode navigateur seulement (`npm run dev`). Dans
 * l'application, une carte Farm ouvre sa propre fenêtre, toujours au premier plan (`src/farm/`).
 */
export function FarmPanel({ name, route, hasStart, currentStep, feedbackKey, onStart, onStep, onClose }: Props) {
  return (
    <Panel
      label={`Parcours ${name}`}
      title={name}
      onBack={onClose}
      aside={<span className="farm-panel__progress">{farmProgressText(route, currentStep)}</span>}
    >
      <FarmSteps
        route={route}
        hasStart={hasStart}
        currentStep={currentStep}
        feedbackKey={feedbackKey}
        onStart={onStart}
        onStep={onStep}
      />
    </Panel>
  );
}
