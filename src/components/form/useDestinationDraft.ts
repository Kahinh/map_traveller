import { useId, useMemo, useRef, useState } from 'react';
import {
  draftIsTwoStep,
  draftPreview,
  isDraftDirty,
  validateDraft,
  type DestinationDraft,
  type DraftField,
} from '../../features/catalog/editor';
import { TWO_STEP_CATEGORIES } from '../../features/catalog/schema';

/** Ordre de parcours des champs, pour donner le focus au premier champ en erreur. */
const FIELD_ORDER: readonly DraftField[] = [
  'name',
  'image',
  'command',
  'command2',
  'zone',
  'aliases',
  'tags',
  'sortOrder',
];
/** Champs du bloc « Plus d'options ». */
const OPTIONAL_FIELDS: readonly DraftField[] = ['zone', 'aliases', 'tags', 'sortOrder'];

/** Modification d'un champ du brouillon. */
export type DraftSetter = <K extends DraftField>(field: K, value: DestinationDraft[K]) => void;

/** Attributs d'accessibilité et de validation d'un champ, posés par `FormField` sur son contrôle. */
export interface FieldBinding {
  id: string;
  errorId: string;
  error: string | undefined;
  ref: (el: HTMLElement | null) => void;
  onBlur: () => void;
}

/**
 * Brouillon du formulaire : valeurs, validation (affichée après la sortie d'un champ ou une
 * première tentative d'enregistrement), aperçu de la copie, focus du premier champ en erreur.
 * L'état est local au formulaire : la frappe ne re-rend pas la grille.
 */
export function useDestinationDraft(initial: DestinationDraft) {
  const uid = useId();
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState<ReadonlySet<DraftField>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const fieldRefs = useRef<Partial<Record<DraftField, HTMLElement | null>>>({});

  const errors = useMemo(() => validateDraft(draft), [draft]);
  const dirty = isDraftDirty(initial, draft);

  // L'aperçu ne dépend que de la catégorie et des commandes.
  const { category, command, twoStep: twoStepChecked, command2 } = draft;
  const preview = useMemo(
    () => draftPreview({ ...initial, category, command, twoStep: twoStepChecked, command2 }),
    [initial, category, command, twoStepChecked, command2],
  );

  const set: DraftSetter = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const field = (name: DraftField): FieldBinding => ({
    id: `${uid}-${name}`,
    errorId: `${uid}-${name}-error`,
    error: submitted || touched.has(name) ? errors[name] : undefined,
    ref: (el) => {
      fieldRefs.current[name] = el;
    },
    onBlur: () => setTouched((t) => (t.has(name) ? t : new Set(t).add(name))),
  });

  /**
   * Marque le formulaire comme soumis. Renvoie vrai s'il est valide ; sinon, ouvre au besoin
   * « Plus d'options » et donne le focus au premier champ en erreur.
   */
  const validate = (): boolean => {
    setSubmitted(true);
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (!first) return true;
    if (OPTIONAL_FIELDS.includes(first)) setMoreOpen(true);
    // Après le rendu : le champ peut se trouver dans le bloc qui vient de s'ouvrir.
    requestAnimationFrame(() => fieldRefs.current[first]?.focus());
    return false;
  };

  return {
    uid,
    draft,
    set,
    field,
    validate,
    dirty,
    preview,
    twoStepAvailable: TWO_STEP_CATEGORIES.includes(draft.category),
    twoStep: draftIsTwoStep(draft),
    moreOpen,
    setMoreOpen,
  };
}
