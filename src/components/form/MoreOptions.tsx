import type { DestinationDraft, DraftField } from '../../features/catalog/editor';
import { ChevronIcon } from '../icons';
import { controlProps, FormField, TEXT_ATTRS } from './FormField';
import type { DraftSetter, FieldBinding } from './useDestinationDraft';

interface Props {
  id: string;
  open: boolean;
  onToggle: () => void;
  draft: DestinationDraft;
  set: DraftSetter;
  field: (name: DraftField) => FieldBinding;
}

/** Bloc repliable « Plus d'options » : zone, alias de la fiche, tags, ordre d'affichage. */
export function MoreOptions({ id, open, onToggle, draft, set, field }: Props) {
  const zone = field('zone');
  const aliases = field('aliases');
  const tags = field('tags');
  const sortOrder = field('sortOrder');
  return (
    <>
      <button type="button" className="form__more" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <ChevronIcon className="form__more-chevron" />
        {open ? "Moins d'options" : "Plus d'options"}
        <span className="form__hint">zone, alias, tags, ordre</span>
      </button>

      {open && (
        <div id={id} className="form__more-body">
          <FormField field={zone} label="Zone">
            <input
              {...controlProps(zone)}
              {...TEXT_ATTRS}
              value={draft.zone}
              onChange={(e) => set('zone', e.target.value)}
            />
          </FormField>
          <FormField field={aliases} label="Alias" hint="séparés par des virgules">
            <input
              {...controlProps(aliases)}
              {...TEXT_ATTRS}
              value={draft.aliases}
              onChange={(e) => set('aliases', e.target.value)}
            />
          </FormField>
          <FormField field={tags} label="Tags" hint="séparés par des virgules">
            <input
              {...controlProps(tags)}
              {...TEXT_ATTRS}
              value={draft.tags}
              onChange={(e) => set('tags', e.target.value)}
            />
          </FormField>
          <FormField field={sortOrder} label="Ordre d'affichage" hint="entier, plus petit = plus haut">
            <input
              {...controlProps(sortOrder)}
              {...TEXT_ATTRS}
              className="form__input form__input--short"
              inputMode="numeric"
              value={draft.sortOrder}
              onChange={(e) => set('sortOrder', e.target.value)}
              placeholder="0"
            />
          </FormField>
        </div>
      )}
    </>
  );
}
