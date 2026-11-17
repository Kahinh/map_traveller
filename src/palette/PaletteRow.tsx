import { memo, type MouseEvent } from 'react';
import { MarkIcon, StarIcon, TravelIcon, ZaapIcon } from '../components/icons';
import { CardVisual } from '../components/Thumb';
import type { Category } from '../features/catalog/schema';
import { variantLabel, type PaletteEntry, type PaletteVariantKind } from '../features/palette/entries';

interface Props {
  entry: PaletteEntry;
  /** Catégorie de la destination : icône de la vignette sans image (`null` si inconnue). */
  category: Category | null;
  index: number;
  /** Identifiant DOM, référencé par `aria-activedescendant` du champ. */
  id: string;
  selected: boolean;
  /** Variante active ; transmise seulement à la ligne sélectionnée (sinon `null`). */
  activeChoice: number | null;
  /**
   * Survol : sélectionne la ligne, et la variante survolée s'il y en a une. La position écran du
   * pointeur permet au parent d'ignorer un évènement sans déplacement réel.
   */
  onHover: (index: number, choice: number | null, screenX: number, screenY: number) => void;
  /**
   * Clic gauche (Entrée) : la variante active, ou celle de la case cliquée. Clic droit
   * (Ctrl+Entrée) sur la ligne : l'autre variante ; sur une case : celle de la case.
   */
  onActivate: (index: number, choice: number, alternate: boolean) => void;
}

function VariantIcon({ kind }: { kind: PaletteVariantKind }) {
  if (kind === 'withoutZaap') return <TravelIcon />;
  if (kind === 'zaapOnly') return <MarkIcon />;
  return <ZaapIcon />;
}

/** Case visée par un évènement souris (`data-choice` d'une case de variante), ou `null`. */
function choiceFromTarget(target: EventTarget): number | null {
  const el = target instanceof Element ? target.closest<HTMLElement>('[data-choice]') : null;
  const n = el ? Number(el.dataset.choice) : NaN;
  return Number.isInteger(n) ? n : null;
}

/**
 * Une ligne de résultat (issue n°11) : une destination, ou une étape d'une destination à
 * plusieurs étapes (« — Étape 2 »). Deux cases à droite seulement si la ligne a deux variantes
 * (avec / sans Zaap) : actives sur la ligne sélectionnée, atténuées ailleurs. Composant
 * d'affichage mémoïsé : la variante active vient du réducteur de navigation du parent. Ni la
 * ligne ni les cases ne prennent le focus : il reste dans le champ.
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
  const { variants } = entry;
  const two = variants.length === 2;
  const current = selected && activeChoice !== null && activeChoice < variants.length ? activeChoice : 0;
  const preview = variants[current]?.text ?? null;
  const empty = preview === null;

  // Sélection sur `mousemove` et non `mouseenter` : une liste qui défile au clavier sous un
  // pointeur immobile ne doit pas déplacer la sélection.
  const onMouseMove = (e: MouseEvent) => onHover(index, choiceFromTarget(e.target), e.screenX, e.screenY);
  const onClick = (e: MouseEvent) => onActivate(index, choiceFromTarget(e.target) ?? current, false);
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault(); // jamais de menu contextuel
    const box = choiceFromTarget(e.target);
    // Sur une case : sa propre variante. Sur la ligne : l'autre variante.
    onActivate(index, box ?? current, box === null);
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
          {entry.step && <span className="palette__step-tag">— Étape {entry.step.index}</span>}
          {entry.favorite && (
            <span className="palette__fav" title="Favori">
              <StarIcon filled />
              <span className="palette__sr">favori</span>
            </span>
          )}
        </span>
        <span className="palette__subtitle">{entry.subtitle}</span>
      </span>
      <span className="palette__preview" title={preview ?? undefined}>
        {preview ?? (entry.kind === 'farm-step' ? 'fin de parcours, rien à copier' : 'rien à copier')}
      </span>
      {two && (
        <span className="palette__variants" aria-hidden={selected ? undefined : true}>
          {variants.map((v, i) =>
            selected ? (
              <button
                key={v.kind}
                type="button"
                tabIndex={-1}
                data-choice={i}
                className={`palette__variant${i === current ? ' is-active' : ''}`}
                aria-pressed={i === current}
                aria-label={variantLabel(entry, v.kind)}
                title={variantLabel(entry, v.kind)}
              >
                <VariantIcon kind={v.kind} />
              </button>
            ) : (
              <span key={v.kind} className="palette__variant is-idle">
                <VariantIcon kind={v.kind} />
              </span>
            ),
          )}
        </span>
      )}
    </li>
  );
});
