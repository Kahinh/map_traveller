import { Fragment } from 'react';
import { ArrowIcon } from './icons';

/** Flèches du clavier, dessinées par `ArrowIcon` (aucun caractère employé comme icône). */
const ARROWS = {
  ArrowUp: { title: 'Flèche haut', className: 'kbd__arrow' },
  ArrowDown: { title: 'Flèche bas', className: 'kbd__arrow kbd__arrow--down' },
  ArrowLeft: { title: 'Flèche gauche', className: 'kbd__arrow kbd__arrow--left' },
  ArrowRight: { title: 'Flèche droite', className: 'kbd__arrow kbd__arrow--right' },
} as const;

type Arrow = keyof typeof ARROWS;

const isArrow = (key: string): key is Arrow => Object.hasOwn(ARROWS, key);

interface Props {
  /** Touches affichées, dans l'ordre (`ArrowUp`… pour une flèche, sinon le texte de la touche). */
  keys: readonly string[];
  /** Combinaison (« Ctrl + Entrée ») : un « + » entre les touches ; sinon touches juxtaposées. */
  combo?: boolean;
}

/**
 * Touches du clavier en capsules `.kbd` (styles/kbd.css), partagées par la fenêtre principale et
 * la palette. Présentation seule : le texte lisible reste dans le libellé qui l'entoure.
 */
export function Keys({ keys, combo = false }: Props) {
  return (
    <span className="kbd-group">
      {keys.map((key, i) => (
        <Fragment key={`${i}-${key}`}>
          {combo && i > 0 && <span aria-hidden>+</span>}
          {isArrow(key) ? (
            <kbd className="kbd" title={ARROWS[key].title}>
              <ArrowIcon className={ARROWS[key].className} />
            </kbd>
          ) : (
            <kbd className="kbd">{key}</kbd>
          )}
        </Fragment>
      ))}
    </span>
  );
}
