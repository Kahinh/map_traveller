import type { DestinationDraft, DraftField } from '../../features/catalog/editor';
import { Switch } from '../controls';
import { controlProps, FormField } from './FormField';
import type { DraftSetter, FieldBinding } from './useDestinationDraft';

/** Attributs communs des champs de commande : aucune correction automatique du texte saisi. */
const COMMAND_ATTRS = {
  rows: 3,
  spellCheck: false,
  autoCapitalize: 'off',
  autoCorrect: 'off',
  autoComplete: 'off',
  className: 'form__input form__input--mono',
} as const;

interface Props {
  uid: string;
  draft: DestinationDraft;
  set: DraftSetter;
  field: (name: DraftField) => FieldBinding;
  /** Catégorie à deux étapes possible (PNJ, Donjons). */
  twoStepAvailable: boolean;
  /** Deux étapes effectivement actives. */
  twoStep: boolean;
}

/** Interrupteur « deux étapes » et champs de commande, enregistrés octet pour octet. */
export function CommandFields({ uid, draft, set, field, twoStepAvailable, twoStep }: Props) {
  const command = field('command');
  const command2 = field('command2');
  return (
    <>
      {twoStepAvailable && (
        <div className="form__switch">
          <Switch
            id={`${uid}-two-step`}
            checked={draft.twoStep}
            onChange={(checked) => set('twoStep', checked)}
            describedBy={`${uid}-two-step-hint`}
          />
          <label htmlFor={`${uid}-two-step`}>Trajet en deux étapes</label>
          <span className="form__hint" id={`${uid}-two-step-hint`}>
            étape 1 : accès · étape 2 : sur place
          </span>
        </div>
      )}

      <FormField field={command} label={twoStep ? 'Commande 1' : 'Commande'}>
        <textarea
          {...controlProps(command)}
          {...COMMAND_ATTRS}
          value={draft.command}
          onChange={(e) => set('command', e.target.value)}
          placeholder={draft.category === 'farm' ? '/travel 1 1;/travel 2 2;…' : '/zaap 1 1;/travel 2 2'}
        />
      </FormField>

      {twoStep && (
        <FormField field={command2} label="Commande 2">
          <textarea
            {...controlProps(command2)}
            {...COMMAND_ATTRS}
            value={draft.command2}
            onChange={(e) => set('command2', e.target.value)}
          />
        </FormField>
      )}
    </>
  );
}
