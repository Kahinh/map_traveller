/**
 * Contrôles dessinés (issue n°13, E1 à E3) : aucun contrôle natif teinté. Rendu et clavier
 * uniquement ; la valeur appartient au parent.
 */
import type { ReactNode } from 'react';
import { INSTALLED_ONLY } from '../lib/tauri/env';
import { useRovingFocus } from './useRovingFocus';

interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Écriture en cours : reste focalisable (`aria-disabled`) mais ne bascule pas. */
  busy?: boolean;
  /** Nom accessible, si aucun `<label htmlFor>` ni `labelledBy` ne le donne. */
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  title?: string;
}

/**
 * Interrupteur : bouton `role="switch"`. Espace et Entrée le basculent (comportement natif du
 * bouton) ; un `<label htmlFor>` qui le vise le bascule aussi au clic.
 */
export function Switch({ id, checked, onChange, disabled, busy, label, labelledBy, describedBy, title }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      title={title}
      disabled={disabled}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onChange(!checked);
      }}
    >
      <span className="switch__thumb" aria-hidden />
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}

/**
 * Contrôle segmenté : `role="radiogroup"` de boutons `role="radio"`. Une seule tabulation pour
 * le groupe (l'option choisie) ; les flèches, Début et Fin déplacent le choix, comme un groupe
 * de boutons radio.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  labelledBy,
  describedBy,
  disabled,
}: SegmentedProps<T>) {
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const itemProps = useRovingFocus(
    options.length,
    current,
    (i) => {
      const option = options[i];
      if (option) onChange(option.value);
    },
    'both',
  );

  return (
    <div className="segmented" role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {options.map((o, i) => {
        const checked = i === current;
        return (
          <button
            key={o.value}
            {...itemProps(i)}
            type="button"
            role="radio"
            aria-checked={checked}
            className={`segmented__item${checked ? ' is-active' : ''}`}
            title={o.title}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface SettingRowProps {
  /** Libellé ; `htmlFor` le relie au contrôle (clic sur le libellé = clic sur le contrôle). */
  label: ReactNode;
  htmlFor?: string;
  labelId?: string;
  /** Description d'une ligne sous le libellé ; le détail va dans `title`. */
  description?: ReactNode;
  descriptionId?: string;
  title?: string;
  /** Contrôle, aligné à droite (passe sous le texte si la fenêtre est trop étroite). */
  children?: ReactNode;
}

/** Ligne de réglage : libellé et description courte à gauche, contrôle à droite. */
export function SettingRow({ label, htmlFor, labelId, description, descriptionId, title, children }: SettingRowProps) {
  return (
    <div className="setting" title={title}>
      <div className="setting__text">
        {htmlFor ? (
          <label className="setting__label" htmlFor={htmlFor} id={labelId}>
            {label}
          </label>
        ) : (
          <span className="setting__label" id={labelId}>
            {label}
          </span>
        )}
        {description && (
          <span className="setting__description" id={descriptionId}>
            {description}
          </span>
        )}
      </div>
      {children && <div className="setting__control">{children}</div>}
    </div>
  );
}

/** Mention unique d'une fonction absente du mode navigateur (`npm run dev`), même style partout. */
export function InstalledOnly({ block = false }: { block?: boolean }) {
  return block ? (
    <p className="form__hint installed-only">{INSTALLED_ONLY}</p>
  ) : (
    <span className="installed-only">{INSTALLED_ONLY}</span>
  );
}
