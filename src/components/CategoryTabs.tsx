import { CATEGORIES, CATEGORY_LABELS } from '../features/catalog/schema';
import type { ViewFilter } from '../features/catalog/search';
import { StarIcon } from './icons';

const VIEWS: { id: ViewFilter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  ...CATEGORIES.map((c) => ({ id: c as ViewFilter, label: CATEGORY_LABELS[c] })),
  { id: 'favorites', label: 'Favoris' },
];

interface Props {
  value: ViewFilter;
  onChange: (v: ViewFilter) => void;
}

export function CategoryTabs({ value, onChange }: Props) {
  return (
    <nav className="tabs" role="tablist">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={value === v.id}
          className={`tab${value === v.id ? ' is-active' : ''}`}
          onClick={() => onChange(v.id)}
        >
          {v.id === 'favorites' && <StarIcon filled={false} />}
          {v.label}
        </button>
      ))}
    </nav>
  );
}
