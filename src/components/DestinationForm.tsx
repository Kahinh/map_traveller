import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { CATEGORY_FORM_LABELS, type DestinationDraft } from '../features/catalog/editor';
import { CATEGORIES, type Category, type Destination } from '../features/catalog/schema';
import { errorText } from '../lib/errors';
import { pickAndImportImage } from '../lib/tauri/imageImport';
import { Segmented, type SegmentedOption } from './controls';
import { CommandFields } from './form/CommandFields';
import { DraftPreview } from './form/DraftPreview';
import { FOCUS_KEY_ATTR, FormActions, type Busy, type Confirm } from './form/FormActions';
import { controlProps, FormField, TEXT_ATTRS } from './form/FormField';
import { ImageField } from './form/ImageField';
import { MoreOptions } from './form/MoreOptions';
import { useDestinationDraft } from './form/useDestinationDraft';
import { Panel } from './Panel';

/** Options du contrôle segmenté « Catégorie », dans l'ordre du schéma. */
const CATEGORY_OPTIONS: readonly SegmentedOption<Category>[] = CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_FORM_LABELS[c],
}));

interface Props {
  /** Brouillon d'ouverture : sert aussi de référence pour détecter les modifications. */
  initial: DestinationDraft;
  /** Catalogue actuel : un alias déjà porté par une autre destination est refusé. */
  destinations: readonly Destination[];
  /** Enregistre ; doit rejeter (message lisible) si l'écriture échoue. */
  onSave: (draft: DestinationDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}

/**
 * Formulaire de création / modification d'une destination (CdC §6.1). Rendu et interactions
 * uniquement : validation, aperçu et construction du catalogue sont dans `features/catalog/editor.ts`.
 */
export function DestinationForm({ initial, destinations, onSave, onDelete, onDuplicate, onClose }: Props) {
  const { uid, draft, set, field, validate, dirty, preview, twoStepAvailable, twoStep, moreOpen, setMoreOpen } =
    useDestinationDraft(initial, destinations);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** Ce qui avait le focus à l'ouverture d'une confirmation : bouton (par sa clé) ou champ. */
  const confirmOriginRef = useRef<string | Element | null>(null);

  const isEdit = initial.id !== null;

  const askConfirm = (kind: NonNullable<Confirm>) => {
    const active = document.activeElement;
    // Le bouton d'origine est démonté pendant la confirmation : on le retrouve par sa clé.
    confirmOriginRef.current = active?.getAttribute(FOCUS_KEY_ATTR) ?? active;
    setConfirm(kind);
  };

  /** Ferme la confirmation sans l'appliquer ; le focus revient à son origine (effet ci-dessous). */
  const dismissConfirm = () => setConfirm(null);

  useEffect(() => {
    const origin = confirmOriginRef.current;
    if (confirm !== null || origin === null) return;
    confirmOriginRef.current = null;
    const target =
      typeof origin === 'string' ? formRef.current?.querySelector(`[${FOCUS_KEY_ATTR}="${origin}"]`) : origin;
    if (target instanceof HTMLElement && target.isConnected) target.focus();
  }, [confirm]);

  const requestClose = () => {
    if (busy !== null) return;
    if (dirty) askConfirm('discard');
    else onClose();
  };

  const submit = async () => {
    if (busy !== null || !validate()) return;
    setBusy('save');
    setActionError(null);
    try {
      await onSave(draft); // en cas de succès, le panneau est fermé par l'application
    } catch (e) {
      setActionError(`Enregistrement impossible : ${errorText(e)}`);
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (initial.id === null || busy !== null) return;
    setBusy('delete');
    setActionError(null);
    try {
      await onDelete(initial.id);
    } catch (e) {
      setActionError(`Suppression impossible : ${errorText(e)}`);
      setConfirm(null);
      setBusy(null);
    }
  };

  const chooseImage = async () => {
    if (busy !== null) return;
    setBusy('image');
    setImageError(null);
    try {
      const relative = await pickAndImportImage();
      if (relative !== null) set('image', relative);
    } catch (e) {
      setImageError(errorText(e)); // l'image existante est conservée
    } finally {
      setBusy(null);
    }
  };

  // Clavier du formulaire (le clavier de l'application est inactif pendant ce temps) :
  // Échap = annuler / fermer la confirmation, Ctrl+Entrée = enregistrer. Un seul abonnement.
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (busy !== null) return;
      if (confirm !== null) dismissConfirm();
      else requestClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (confirm === null) void submit();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault(); // la recherche est masquée par le formulaire
    }
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const title = isEdit ? `Modifier « ${initial.name} »` : 'Nouvelle destination';
  const categoryLabelId = `${uid}-category-label`;
  const name = field('name');

  return (
    <Panel label={title} title={title} onBack={requestClose} focusBack={false}>
      <form
        ref={formRef}
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="form__body">
          <FormField field={name} label="Nom">
            <input
              {...controlProps(name)}
              {...TEXT_ATTRS}
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
              spellCheck={false}
            />
          </FormField>

          <div className="form__field">
            <span className="form__label" id={categoryLabelId}>
              Catégorie
            </span>
            <Segmented
              value={draft.category}
              options={CATEGORY_OPTIONS}
              onChange={(c) => set('category', c)}
              labelledBy={categoryLabelId}
            />
          </div>

          <ImageField
            field={field('image')}
            category={draft.category}
            name={draft.name}
            image={draft.image}
            twoStep={twoStep}
            busy={busy !== null}
            importing={busy === 'image'}
            importError={imageError}
            onChoose={() => void chooseImage()}
            onRemove={() => {
              setImageError(null);
              set('image', null); // aucun fichier n'est supprimé
            }}
          />

          <CommandFields
            uid={uid}
            draft={draft}
            set={set}
            field={field}
            twoStepAvailable={twoStepAvailable}
            twoStep={twoStep}
          />

          <DraftPreview preview={preview} />

          <MoreOptions
            id={`${uid}-more`}
            open={moreOpen}
            onToggle={() => setMoreOpen((o) => !o)}
            draft={draft}
            set={set}
            field={field}
          />
        </div>

        <FormActions
          isEdit={isEdit}
          name={initial.name}
          dirty={dirty}
          busy={busy}
          confirm={confirm}
          error={actionError}
          onAskDelete={() => askConfirm('delete')}
          onDelete={() => void confirmDelete()}
          onDuplicate={() => initial.id !== null && onDuplicate(initial.id)}
          onCancel={requestClose}
          onDiscard={onClose}
          onBack={dismissConfirm}
        />
      </form>
    </Panel>
  );
}
