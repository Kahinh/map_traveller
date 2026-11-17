import { CATEGORIES, CATEGORY_LABELS } from '../features/catalog/schema';
import type { ViewFilter } from '../features/catalog/search';
import { StarIcon } from './icons';
import { useRovingFocus } from './useRovingFocus';

export const VIEWS: { id: ViewFilter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  ...CATEGORIES.map((c) => ({ id: c as ViewFilter, label: CATEGORY_LABELS[c] })),
  { id: 'favorites', label: 'Favoris' },
];

interface Props {
  value: ViewFilter;
  onChange: (v: ViewFilter) => void;
  /** Nombre de destinations de chaque onglet, hors recherche ; absent tant que le catalogue charge. */
  counts?: Readonly<Record<ViewFilter, number>>;
  /** Identifiant de la zone affichée (la grille). */
  controls: string;
}

/**
 * Onglets en texte seul : l'onglet actif est souligné d'un trait d'accent (issue n°13, B3).
 * Une seule tabulation pour la rangée ; les flèches changent d'onglet.
 */
export function CategoryTabs({ value, onChange, counts, controls }: Props) {
  const current = Math.max(
    0,
    VIEWS.findIndex((v) => v.id === value),
  );
  const itemProps = useRovingFocus(
    VIEWS.length,
    current,
    (i) => {
      const v = VIEWS[i];
      if (v) onChange(v.id);
    },
    'horizontal',
  );
  return (
    <div className="tabs" role="tablist" aria-label="Catégories">
      {VIEWS.map((v, i) => (
        <button
          key={v.id}
          {...itemProps(i)}
          type="button"
          role="tab"
          aria-selected={i === current}
          aria-controls={controls}
          className={`tab${i === current ? ' is-active' : ''}`}
          onClick={() => onChange(v.id)}
        >
          {v.id === 'favorites' && <StarIcon filled={false} />}
          {v.label}
          {counts && <span className="tab__count">{counts[v.id]}</span>}
        </button>
      ))}
    </div>
  );
}
