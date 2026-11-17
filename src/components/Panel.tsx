import { useEffect, useRef, type ReactNode } from 'react';
import { BackIcon } from './icons';

interface Props {
  /** Nom accessible du panneau. */
  label: string;
  title: string;
  /** Zone d'informations ou d'actions à droite de l'en-tête. */
  aside?: ReactNode;
  /** Info-bulle du bouton retour. */
  backTitle?: string;
  /** Focus sur le bouton retour à l'ouverture ; faux si un champ du contenu le prend (formulaire). */
  focusBack?: boolean;
  onBack: () => void;
  children: ReactNode;
}

/**
 * Panneau recouvrant la zone sous la barre de titre (parcours Farm, formulaire, Paramètres) :
 * en-tête avec bouton retour, titre et zone à droite ; le contenu gère son propre défilement.
 * Le reste de la fenêtre devient inerte : le focus doit entrer dans le panneau.
 */
export function Panel({ label, title, aside, backTitle = 'Retour (Échap)', focusBack = true, onBack, children }: Props) {
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusBack) backRef.current?.focus();
    // Au montage seulement : un nouveau rendu ne doit pas reprendre le focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="panel" aria-label={label}>
      <div className="panel__header">
        <button ref={backRef} type="button" className="icon-btn" title={backTitle} aria-label="Retour" onClick={onBack}>
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
