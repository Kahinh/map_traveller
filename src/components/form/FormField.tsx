import type { ReactNode } from 'react';
import type { FieldBinding } from './useDestinationDraft';

/** Attributs communs des champs de texte d'une ligne. */
export const TEXT_ATTRS = { className: 'form__input', type: 'text', autoComplete: 'off' } as const;

/** Attributs à poser sur le contrôle d'un champ (`<input>`, `<textarea>`, bouton). */
export function controlProps(f: FieldBinding) {
  return {
    id: f.id,
    ref: f.ref,
    'aria-invalid': f.error ? true : undefined,
    'aria-describedby': f.error ? f.errorId : undefined,
    onBlur: f.onBlur,
  } as const;
}

/** Ligne d'erreur d'un champ, reliée au contrôle par `aria-describedby`. */
export function FieldError({ field }: { field: FieldBinding }) {
  return field.error ? (
    <p id={field.errorId} className="form__error">
      {field.error}
    </p>
  ) : null;
}

interface Props {
  field: FieldBinding;
  label: ReactNode;
  /** Précision en texte secondaire après le libellé. */
  hint?: string;
  children: ReactNode;
}

/** Bloc d'un champ : libellé relié au contrôle, contrôle (`children`), erreur éventuelle. */
export function FormField({ field, label, hint, children }: Props) {
  return (
    <div className="form__field">
      <label className="form__label" htmlFor={field.id}>
        {label}
        {hint && <span className="form__hint"> {hint}</span>}
      </label>
      {children}
      <FieldError field={field} />
    </div>
  );
}
