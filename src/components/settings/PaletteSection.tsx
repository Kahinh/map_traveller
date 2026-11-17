import { useId } from 'react';
import type { VariantKind } from '../../features/commands/cardParts';
import { Segmented, SettingRow, type SegmentedOption } from '../controls';
import { Keys } from '../Keys';
import type { SettingsSectionProps } from './types';

const VARIANT_TEXT: Record<VariantKind, { short: string; detail: string }> = {
  withoutZaap: {
    short: 'Entrée copie le trajet sans le /zaap initial',
    detail:
      "Sur une ligne dont la commande commence par /zaap, la première case et Entrée copient le trajet sans le /zaap initial ; Ctrl+Entrée et la seconde case copient la commande complète.",
  },
  withZaap: {
    short: 'Entrée copie la commande complète',
    detail:
      'Sur une ligne dont la commande commence par /zaap, la première case et Entrée copient la commande complète, /zaap compris ; Ctrl+Entrée et la seconde case copient le trajet sans le /zaap initial.',
  },
};

const VARIANT_OPTIONS: readonly SegmentedOption<VariantKind>[] = [
  { value: 'withoutZaap', label: 'Sans Zaap', title: VARIANT_TEXT.withoutZaap.detail },
  { value: 'withZaap', label: 'Avec Zaap', title: VARIANT_TEXT.withZaap.detail },
];

/**
 * Rubrique « Palette » (issue n°11) : variante sélectionnée par défaut sur les lignes qui ont
 * un /zaap initial. Enregistrée dès qu'elle change ; la palette la relit à sa prochaine ouverture.
 */
export function PaletteSection({ settings, onChange }: SettingsSectionProps) {
  const uid = useId();
  const value = settings.palette.defaultVariant;
  return (
    <div className="settings__block">
      <SettingRow
        label="Variante par défaut"
        labelId={`${uid}-variant-label`}
        description={VARIANT_TEXT[value].short}
        descriptionId={`${uid}-variant-hint`}
        title={VARIANT_TEXT[value].detail}
      >
        <Segmented
          value={value}
          options={VARIANT_OPTIONS}
          onChange={(v) => onChange({ palette: { defaultVariant: v } })}
          labelledBy={`${uid}-variant-label`}
          describedBy={`${uid}-variant-hint`}
        />
      </SettingRow>
      <p className="form__hint">
        Dans la palette, <Keys keys={['ArrowLeft', 'ArrowRight']} /> changent de variante ;{' '}
        <Keys keys={['Ctrl', 'Entrée']} combo /> copie l'autre
      </p>
    </div>
  );
}
