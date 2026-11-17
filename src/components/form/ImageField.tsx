import type { Category } from '../../features/catalog/schema';
import { IS_TAURI } from '../../lib/tauri/env';
import { CardName } from '../CompactCard';
import { InstalledOnly } from '../controls';
import { SplitCardArt } from '../SplitCardArt';
import { CardVisual } from '../Thumb';
import { controlProps, FieldError } from './FormField';
import type { FieldBinding } from './useDestinationDraft';

interface Props {
  field: FieldBinding;
  category: Category;
  name: string;
  image: string | null;
  twoStep: boolean;
  /** Une action du formulaire est en cours (import, enregistrement, suppression). */
  busy: boolean;
  importing: boolean;
  /** Échec du dernier import (l'image existante est conservée). */
  importError: string | null;
  onChoose: () => void;
  onRemove: () => void;
}

/** Image et aperçu de la carte : vignette telle qu'elle apparaîtra dans la grille, choix et retrait. */
export function ImageField({
  field,
  category,
  name,
  image,
  twoStep,
  busy,
  importing,
  importError,
  onChoose,
  onRemove,
}: Props) {
  return (
    <div className="form__field">
      <span className="form__label">Image et aperçu</span>
      <div className="form__image">
        <div className={`card form__card${twoStep ? ' card--split' : ''}`} aria-hidden title={image ?? undefined}>
          {twoStep ? (
            <SplitCardArt key={image ?? ''} category={category} image={image} />
          ) : (
            <CardVisual key={image ?? ''} category={category} image={image} />
          )}
          {category === 'farm' && <span className="card__badge">Farm</span>}
          <CardName name={name.trim() || 'Sans nom'} />
        </div>
        <div className="form__image-actions">
          <button
            {...controlProps(field)}
            type="button"
            className="btn"
            disabled={!IS_TAURI || busy}
            onClick={onChoose}
          >
            {importing ? 'Import…' : image ? 'Remplacer…' : 'Choisir…'}
          </button>
          <button type="button" className="btn" disabled={image === null || busy} onClick={onRemove}>
            Retirer
          </button>
          {!IS_TAURI && <InstalledOnly block />}
          {IS_TAURI && !importError && (
            <p className="form__hint">PNG, JPEG ou WebP, 10 Mo au plus · sans image : icône de la catégorie</p>
          )}
        </div>
      </div>
      {importError && (
        <p className="form__error" role="alert">
          {importError}
        </p>
      )}
      <FieldError field={field} />
    </div>
  );
}
