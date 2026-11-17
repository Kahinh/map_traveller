import type { DraftPreview as Preview } from '../../features/catalog/editor';

/** Valeur copiée affichée telle quelle (jamais réécrite), ou mention « rien à copier ». */
function Copied({ value }: { value: string | null }) {
  return value === null ? (
    <span className="form__preview-none">rien à copier</span>
  ) : (
    <code className="form__preview-value">{value}</code>
  );
}

function FarmRows({ preview }: { preview: Extract<Preview, { kind: 'farm' }> }) {
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

/** Aperçu de ce que copieront les clics, calculé par `draftPreview` (règles de copie inchangées). */
export function DraftPreview({ preview }: { preview: Preview }) {
  return (
    <div className="form__preview" role="group" aria-label="Aperçu de ce que copieront les clics">
      {preview.kind === 'farm' ? <FarmRows preview={preview} /> : <PartRows parts={preview.parts} />}
    </div>
  );
}

function PartRows({ parts }: { parts: Extract<Preview, { kind: 'classic' }>['parts'] }) {
  const several = parts.length > 1;
  return parts.flatMap((p) => {
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
  });
}
