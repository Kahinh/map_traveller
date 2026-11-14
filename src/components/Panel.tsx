import type { ReactNode } from 'react';
import { BackIcon } from './icons';

interface Props {
  /** Nom accessible du panneau. */
  label: string;
  title: string;
  /** Zone d'informations ou d'actions à droite de l'en-tête. */
  aside?: ReactNode;
  /** Info-bulle du bouton retour. */
  backTitle?: string;
  onBack: () => void;
  children: ReactNode;
}

/**
 * Panneau recouvrant la zone sous la barre de titre (parcours Farm, formulaire) :
 * en-tête avec bouton retour, titre et zone à droite ; le contenu gère son propre défilement.
 */
export function Panel({ label, title, aside, backTitle = 'Retour (Échap)', onBack, children }: Props) {
  return (
    <section className="panel" aria-label={label}>
      <div className="panel__header">
        <button type="button" className="icon-btn" title={backTitle} aria-label="Retour" onClick={onBack}>
          <BackIcon />
        </button>
        <span className="panel__title" title={title}>
          {title}
        </span>
        {aside}
      </div>
      {children}
    </section>
  );
}
