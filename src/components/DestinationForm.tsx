import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CATEGORY_FORM_LABELS,
  draftIsTwoStep,
  draftPreview,
  isDraftDirty,
  validateDraft,
  type DestinationDraft,
  type DraftField,
  type DraftPreview,
} from '../features/catalog/editor';
import { CATEGORIES, TWO_STEP_CATEGORIES, type Category } from '../features/catalog/schema';
import { canImportImages, pickAndImportImage } from '../lib/tauri/imageImport';
import { CardName } from './CompactCard';
import { Segmented, Switch, type SegmentedOption } from './controls';
import { ChevronIcon } from './icons';
import { CardVisual } from './Thumb';
import { Panel } from './Panel';
import { SplitCardArt } from './SplitCardArt';

/** Options du contrôle segmenté « Catégorie », dans l'ordre du schéma. */
const CATEGORY_OPTIONS: readonly SegmentedOption<Category>[] = CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_FORM_LABELS[c],
}));

interface Props {
  /** Brouillon d'ouverture : sert aussi de référence pour détecter les modifications. */
  initial: DestinationDraft;
  /** Enregistre ; doit rejeter (message lisible) si l'écriture échoue. */
  onSave: (draft: DestinationDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}

type Busy = null | 'save' | 'delete' | 'image';
type Confirm = null | 'discard' | 'delete';

/** Ordre de parcours des champs, pour donner le focus au premier champ en erreur. */
const FIELD_ORDER: readonly DraftField[] = ['name', 'image', 'command', 'command2', 'zone', 'aliases', 'tags', 'sortOrder'];
/** Champs du bloc « Plus d'options ». */
const OPTIONAL_FIELDS: readonly DraftField[] = ['zone', 'aliases', 'tags', 'sortOrder'];

/** Attributs communs des champs de commande : aucune correction automatique du texte saisi. */
const COMMAND_ATTRS = {
  rows: 3,
  spellCheck: false,
  autoCapitalize: 'off',
  autoCorrect: 'off',
  autoComplete: 'off',
} as const;

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Valeur copiée affichée telle quelle (jamais réécrite), ou mention « rien à copier ». */
function Copied({ value }: { value: string | null }) {
  return value === null ? (
    <span className="form__preview-none">rien à copier</span>
  ) : (
    <code className="form__preview-value">{value}</code>
  );
}

function PreviewRows({ preview }: { preview: DraftPreview }) {
  if (preview.kind === 'farm') {
    const { steps, issues, zaapPrefix } = preview.route;
    return (
      <>
        <div className="form__preview-row">
          <span className="form__preview-label">
            {steps.length} étape{steps.length > 1 ? 's' : ''}
          </span>
          {steps.length > 0 ? (
            <span className="form__preview-steps">{steps.map((s) => s.label).join(' · ')}</span>
          ) : (
            <span className="form__preview-none">aucune étape /travel reconnue</span>
          )}
        </div>
        {zaapPrefix !== null && (
          <div className="form__preview-row">
            <span className="form__preview-label">Zaap initial (copié par « Début » seulement)</span>
            <Copied value={zaapPrefix} />
          </div>
        )}
        {issues.length > 0 && (
          <div className="form__preview-row is-warning">
            <span className="form__preview-label">
              {issues.length} segment{issues.length > 1 ? 's' : ''} non reconnu{issues.length > 1 ? 's' : ''}
            </span>
            <span>{issues.map((i) => `« ${i.segment.trim() || '(vide)'} »`).join(', ')}</span>
          </div>
        )}
      </>
    );
  }
  const several = preview.parts.length > 1;
  return (
    <>
      {preview.parts.flatMap((p) => {
        const prefix = several ? `Étape ${p.index} · ` : '';
        const rows =
          p.left === p.right
            ? [{ key: 'both', label: 'clics gauche et droit', value: p.left }]
            : [
                { key: 'left', label: 'clic gauche', value: p.left },
                { key: 'right', label: 'clic droit', value: p.right },
              ];
        return rows.map((r) => (
          <div key={`${p.index}-${r.key}`} className="form__preview-row">
            <span className="form__preview-label">
              {prefix}
              {several ? r.label : r.label.charAt(0).toUpperCase() + r.label.slice(1)}
            </span>
            <Copied value={r.value} />
          </div>
        ));
      })}
    </>
  );
}

/**
 * Formulaire de création / modification d'une destination (CdC §6.1). Rendu et interactions
 * uniquement : validation, aperçu et construction du catalogue sont dans `features/catalog/editor.ts`.
 * L'état est local : la frappe ne re-rend pas la grille.
 */
export function DestinationForm({ initial, onSave, onDelete, onDuplicate, onClose }: Props) {
  const uid = useId();
  const fieldId = (f: DraftField) => `${uid}-${f}`;
  const errorId = (f: DraftField) => `${uid}-${f}-error`;

  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState<ReadonlySet<DraftField>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const fieldRefs = useRef<Partial<Record<DraftField, HTMLElement | null>>>({});

  const isEdit = initial.id !== null;
  const twoStepAvailable = TWO_STEP_CATEGORIES.includes(draft.category);
  const twoStep = draftIsTwoStep(draft);
  const dirty = isDraftDirty(initial, draft);
  const errors = useMemo(() => validateDraft(draft), [draft]);

  // L'aperçu ne dépend que de la catégorie et des commandes.
  const { category, command, twoStep: twoStepChecked, command2 } = draft;
  const preview = useMemo(
    () => draftPreview({ ...initial, category, command, twoStep: twoStepChecked, command2 }),
    [initial, category, command, twoStepChecked, command2],
  );

  const set = <K extends DraftField>(field: K, value: DestinationDraft[K]) =>
    setDraft((d) => ({ ...d, [field]: value }));
  const touch = (field: DraftField) => setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
  const shownError = (field: DraftField) => (submitted || touched.has(field) ? errors[field] : undefined);
  const registerRef = (field: DraftField) => (el: HTMLElement | null) => {
    fieldRefs.current[field] = el;
  };

  /** Attributs d'accessibilité et de validation communs à un champ. */
  const fieldProps = (field: DraftField) => {
    const error = shownError(field);
    return {
      id: fieldId(field),
      ref: registerRef(field),
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId(field) : undefined,
      onBlur: () => touch(field),
    };
  };

  const errorLine = (field: DraftField): ReactNode => {
    const error = shownError(field);
    return error ? (
      <p id={errorId(field)} className="form__error">
        {error}
      </p>
    ) : null;
  };

  const requestClose = () => {
    if (busy !== null) return;
    if (dirty) setConfirm('discard');
    else onClose();
  };

  const submit = async () => {
    if (busy !== null) return;
    setSubmitted(true);
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (first) {
      if (OPTIONAL_FIELDS.includes(first)) setMoreOpen(true);
      // Après le rendu : le champ peut se trouver dans le bloc qui vient de s'ouvrir.
      requestAnimationFrame(() => fieldRefs.current[first]?.focus());
      return;
    }
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
      // L'image existante est conservée.
      setImageError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  // Clavier du formulaire (le raccourci global de l'application est inactif pendant ce temps) :
  // Échap = annuler / fermer la confirmation, Ctrl+Entrée = enregistrer.
  // Réabonné à chaque rendu pour toujours voir l'état courant.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (busy !== null) return;
        if (confirm !== null) setConfirm(null);
        else requestClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (confirm === null) void submit();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault(); // la recherche est masquée par le formulaire
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const imageAvailable = canImportImages();
  const title = isEdit ? `Modifier « ${initial.name} »` : 'Nouvelle destination';

  return (
    <Panel label={title} title={title} onBack={requestClose}>
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="form__body">
          <div className="form__field">
            <label className="form__label" htmlFor={fieldId('name')}>
              Nom
            </label>
            <input
              {...fieldProps('name')}
              className="form__input"
              type="text"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            {errorLine('name')}
          </div>

          <div className="form__field">
            <span className="form__label" id={`${uid}-category-label`}>
              Catégorie
            </span>
            <Segmented
              value={draft.category}
              options={CATEGORY_OPTIONS}
              onChange={(c) => set('category', c)}
              labelledBy={`${uid}-category-label`}
            />
          </div>

          <div className="form__field">
            <span className="form__label">Image et aperçu</span>
            <div className="form__image">
              <div
                className={`card form__card${twoStep ? ' card--split' : ''}`}
                aria-hidden
                title={draft.image ?? undefined}
              >
                {twoStep ? (
                  <SplitCardArt key={draft.image ?? ''} category={draft.category} image={draft.image} />
                ) : (
                  <CardVisual key={draft.image ?? ''} category={draft.category} image={draft.image} />
                )}
                {draft.category === 'farm' && <span className="card__badge">Farm</span>}
                <CardName name={draft.name.trim() || 'Sans nom'} />
              </div>
              <div className="form__image-actions">
                <button
                  {...fieldProps('image')}
                  type="button"
                  className="btn"
                  disabled={!imageAvailable || busy !== null}
                  onClick={() => void chooseImage()}
                >
                  {busy === 'image' ? 'Import…' : draft.image ? 'Remplacer…' : 'Choisir…'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={draft.image === null || busy !== null}
                  onClick={() => {
                    setImageError(null);
                    set('image', null); // aucun fichier n'est supprimé
                  }}
                >
                  Retirer
                </button>
                {!imageAvailable && (
                  <p className="form__hint">Import d'images disponible dans l'application installée</p>
                )}
                {imageAvailable && !imageError && (
                  <p className="form__hint">PNG, JPEG ou WebP, 10 Mo au plus · sans image : icône de la catégorie</p>
                )}
              </div>
            </div>
            {imageError && (
              <p className="form__error" role="alert">
                {imageError}
              </p>
            )}
            {errorLine('image')}
          </div>

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

          <div className="form__field">
            <label className="form__label" htmlFor={fieldId('command')}>
              {twoStep ? 'Commande 1' : 'Commande'}
            </label>
            <textarea
              {...fieldProps('command')}
              {...COMMAND_ATTRS}
              className="form__input form__input--mono"
              value={draft.command}
              onChange={(e) => set('command', e.target.value)}
              placeholder={draft.category === 'farm' ? '/travel 1 1;/travel 2 2;…' : '/zaap 1 1;/travel 2 2'}
            />
            {errorLine('command')}
          </div>

          {twoStep && (
            <div className="form__field">
              <label className="form__label" htmlFor={fieldId('command2')}>
                Commande 2
              </label>
              <textarea
                {...fieldProps('command2')}
                {...COMMAND_ATTRS}
                className="form__input form__input--mono"
                value={draft.command2}
                onChange={(e) => set('command2', e.target.value)}
              />
              {errorLine('command2')}
            </div>
          )}

          <div className="form__preview" role="group" aria-label="Aperçu de ce que copieront les clics">
            <PreviewRows preview={preview} />
          </div>

          <button
            type="button"
            className="form__more"
            aria-expanded={moreOpen}
            aria-controls={`${uid}-more`}
            onClick={() => setMoreOpen((o) => !o)}
          >
            <ChevronIcon className="form__more-chevron" />
            {moreOpen ? 'Moins d\'options' : 'Plus d\'options'}
            <span className="form__hint">zone, alias, tags, ordre</span>
          </button>

          {moreOpen && (
            <div id={`${uid}-more`} className="form__more-body">
              <div className="form__field">
                <label className="form__label" htmlFor={fieldId('zone')}>
                  Zone
                </label>
                <input
                  {...fieldProps('zone')}
                  className="form__input"
                  type="text"
                  value={draft.zone}
                  onChange={(e) => set('zone', e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="form__field">
                <label className="form__label" htmlFor={fieldId('aliases')}>
                  Alias <span className="form__hint">séparés par des virgules</span>
                </label>
                <input
                  {...fieldProps('aliases')}
                  className="form__input"
                  type="text"
                  value={draft.aliases}
                  onChange={(e) => set('aliases', e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="form__field">
                <label className="form__label" htmlFor={fieldId('tags')}>
                  Tags <span className="form__hint">séparés par des virgules</span>
                </label>
                <input
                  {...fieldProps('tags')}
                  className="form__input"
                  type="text"
                  value={draft.tags}
                  onChange={(e) => set('tags', e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="form__field">
                <label className="form__label" htmlFor={fieldId('sortOrder')}>
                  Ordre d'affichage <span className="form__hint">entier, plus petit = plus haut</span>
                </label>
                <input
                  {...fieldProps('sortOrder')}
                  className="form__input form__input--short"
                  type="text"
                  inputMode="numeric"
                  value={draft.sortOrder}
                  onChange={(e) => set('sortOrder', e.target.value)}
                  placeholder="0"
                  autoComplete="off"
                />
                {errorLine('sortOrder')}
              </div>
            </div>
          )}
        </div>

        <div className="form__actions">
          {actionError && (
            <p className="form__alert" role="alert">
              {actionError}
            </p>
          )}
          {confirm === 'discard' && (
            <>
              <span className="form__confirm">Abandonner les modifications ?</span>
              <button type="button" className="btn btn--danger" onClick={onClose}>
                Abandonner
              </button>
              <button type="button" className="btn" autoFocus onClick={() => setConfirm(null)}>
                Continuer
              </button>
            </>
          )}
          {confirm === 'delete' && (
            <>
              <span className="form__confirm" title={initial.name}>
                Supprimer « {initial.name} » ?
              </span>
              <button
                type="button"
                className="btn btn--danger"
                disabled={busy !== null}
                onClick={() => void confirmDelete()}
              >
                {busy === 'delete' ? 'Suppression…' : 'Supprimer'}
              </button>
              <button type="button" className="btn" autoFocus disabled={busy !== null} onClick={() => setConfirm(null)}>
                Annuler
              </button>
            </>
          )}
          {confirm === null && (
            <>
              {isEdit && (
                <button
                  type="button"
                  className="btn btn--danger-ghost"
                  disabled={busy !== null}
                  onClick={() => setConfirm('delete')}
                >
                  Supprimer
                </button>
              )}
              {isEdit && (
                <button
                  type="button"
                  className="btn"
                  disabled={busy !== null || dirty}
                  title={dirty ? 'Enregistrez ou annulez d\'abord les modifications' : 'Créer une copie de cette destination'}
                  onClick={() => initial.id !== null && onDuplicate(initial.id)}
                >
                  Dupliquer
                </button>
              )}
              <span className="form__spacer" />
              <button type="button" className="btn" disabled={busy !== null} onClick={requestClose}>
                Annuler
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy !== null} title="Enregistrer (Ctrl+Entrée)">
                {busy === 'save' ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </>
          )}
        </div>
      </form>
    </Panel>
  );
}
