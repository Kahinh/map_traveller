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
  /** Nombre total de lignes (lecteurs d'écran : toutes ne sont pas forcément rendues). */
  count: number;
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
  if (kind === 'zaapOnly') return <MarkIcon />;
  if (kind === 'withZaap') return <ZaapIcon />;
  return <TravelIcon />;
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
 * d'affichage mémoïsé : la ligne (`entry`) et les rappels sont des objets stables, seule une
 * ligne dont la sélection ou la position change est redessinée.
 *
 * Accessibilité : l'option est nommée par son titre et son sous-titre ; la variante active est
 * sa description, mise à jour par ←/→. Les cases ne sont que des cibles pour la souris : ni
 * focalisables ni annoncées (le focus reste dans le champ, ←/→ les remplacent au clavier).
 */
export const PaletteRow = memo(function PaletteRow({
  entry,
  category,
  index,
  count,
  id,
  selected,
  activeChoice,
  onHover,
  onActivate,
}: Props) {
  const { variants } = entry;
  const two = variants.length === 2;
  const current = selected && activeChoice !== null && activeChoice < variants.length ? activeChoice : 0;
  const active = variants[current];
  const preview = active?.text ?? null;
  // Une ligne Farm n'a rien à copier mais reste active : elle ouvre la fenêtre du parcours.
  const empty = preview === null && entry.kind !== 'farm';

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
      aria-setsize={count}
      aria-posinset={index + 1}
      aria-labelledby={`${id}-title ${id}-sub`}
      aria-describedby={two ? `${id}-variant` : undefined}
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
        <span className="palette__title" id={`${id}-title`}>
          <span className="palette__title-text">{entry.title}</span>
          {entry.step && <span className="palette__step-tag">— Étape {entry.step.index}</span>}
          {entry.favorite && (
            <span className="palette__fav" title="Favori">
              <StarIcon filled />
              <span className="palette__sr">favori</span>
            </span>
          )}
        </span>
        <span className="palette__subtitle" id={`${id}-sub`}>
          {entry.subtitle}
        </span>
      </span>
      <span className="palette__preview" title={preview ?? undefined}>
        {preview ?? (entry.kind === 'farm' ? 'ouvrir le parcours' : 'rien à copier')}
      </span>
      {two && active && (
        <>
          <span className="palette__sr" id={`${id}-variant`}>
            {variantLabel(active.kind)}
          </span>
          <span className="palette__variants" aria-hidden>
            {variants.map((v, i) => (
              <span
                key={v.kind}
                data-choice={selected ? i : undefined}
                className={`palette__variant${!selected ? ' is-idle' : i === current ? ' is-active' : ''}`}
                title={selected ? variantLabel(v.kind) : undefined}
              >
                <VariantIcon kind={v.kind} />
              </span>
            ))}
          </span>
        </>
      )}
    </li>
  );
});
