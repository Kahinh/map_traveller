import { memo, type MouseEvent } from 'react';
import { MarkIcon, StarIcon } from '../components/icons';
import { CardVisual } from '../components/Thumb';
import type { Category } from '../features/catalog/schema';
import type { ClickButton } from '../features/commands/cardParts';
import type { PaletteEntry } from '../features/palette/entries';

interface Props {
  entry: PaletteEntry;
  /** Catégorie de la destination : icône de la vignette sans image (`null` si inconnue). */
  category: Category | null;
  index: number;
  /** Identifiant DOM, référencé par `aria-activedescendant` du champ. */
  id: string;
  selected: boolean;
  /** Case active ; transmise seulement à la ligne sélectionnée (sinon `null`). */
  activeChoice: number | null;
  /**
   * Survol : sélectionne la ligne, et la case survolée s'il y en a une. La position écran du
   * pointeur permet au parent d'ignorer un évènement sans déplacement réel.
   */
  onHover: (index: number, choice: number | null, screenX: number, screenY: number) => void;
  /** Clic gauche (Entrée) ou droit (Ctrl+Entrée) sur la ligne ou sur une case. */
  onActivate: (index: number, choice: number, button: ClickButton) => void;
}

/** Case visée par un évènement souris (`data-choice` d'une case 1 / 2), ou `null`. */
function choiceFromTarget(target: EventTarget): number | null {
  const el = target instanceof Element ? target.closest<HTMLElement>('[data-choice]') : null;
  const n = el ? Number(el.dataset.choice) : NaN;
  return Number.isInteger(n) ? n : null;
}

/**
 * Une ligne de résultat. Composant d'affichage mémoïsé : la case active vient du réducteur
 * de navigation du parent, pas d'un état local. Ni la ligne ni les cases ne prennent le
 * focus (`mousedown` sans effet par défaut, `tabIndex=-1`) : il reste dans le champ.
 */
export const PaletteRow = memo(function PaletteRow({
  entry,
  category,
  index,
  id,
  selected,
  activeChoice,
  onHover,
  onActivate,
}: Props) {
  const split = entry.choices.length > 1;
  const current = selected && activeChoice !== null ? activeChoice : 0;
  const choice = entry.choices[current] ?? entry.choices[0];
  const preview = choice?.primary ?? null;
  const empty = preview === null;
  const subtitle = selected && split && choice?.hint ? `${entry.subtitle} · ${choice.hint}` : entry.subtitle;

  // Sélection sur `mousemove` et non `mouseenter` : une liste qui défile au clavier sous un
  // pointeur immobile ne doit pas déplacer la sélection.
  const onMouseMove = (e: MouseEvent) => onHover(index, choiceFromTarget(e.target), e.screenX, e.screenY);
  const onClick = (e: MouseEvent) => onActivate(index, choiceFromTarget(e.target) ?? current, 'left');
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault(); // jamais de menu contextuel : clic droit = commande complète
    onActivate(index, choiceFromTarget(e.target) ?? current, 'right');
  };

  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={empty || undefined}
      className={`palette__row${selected ? ' is-selected' : ''}${empty ? ' is-empty' : ''}`}
      onMouseMove={onMouseMove}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="palette__thumb">
        {entry.kind === 'zaap' ? (
          <span className="card__placeholder" aria-hidden>
            <MarkIcon />
          </span>
        ) : (
          <CardVisual category={category} image={entry.image} />
        )}
      </span>
      <span className="palette__text">
        <span className="palette__title">
          <span className="palette__title-text">{entry.title}</span>
          {entry.favorite && (
            <span className="palette__fav" title="Favori">
              <StarIcon filled />
              <span className="palette__sr">favori</span>
            </span>
          )}
        </span>
        <span className="palette__subtitle">{subtitle}</span>
      </span>
      <span className="palette__preview" title={preview ?? undefined}>
        {preview ?? (entry.kind === 'farm-step' ? 'fin de parcours, rien à copier' : 'rien à copier')}
      </span>
      {split && (
        <span className="palette__steps">
          {selected ? (
            entry.choices.map((c, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                data-choice={i}
                className={`palette__step${i === current ? ' is-active' : ''}${c.primary === null ? ' is-empty' : ''}`}
                aria-pressed={i === current}
                aria-label={c.hint || `Étape ${c.label}`}
                title={c.primary === null ? `${c.hint} : rien à copier` : c.hint}
              >
                {c.label}
              </button>
            ))
          ) : (
            <span className="palette__steps-hint">2 étapes</span>
          )}
        </span>
      )}
    </li>
  );
});
