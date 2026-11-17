import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ALIAS_TERM_MAX,
  listAliases,
  removeAlias,
  setDefaultEnabled,
  splitExpansions,
  upsertAlias,
  validateAliasEntry,
  type AliasError,
  type AliasRow,
  type UserAliases,
} from '../../features/aliases/aliases';
import { getSearchIndex, searchIndexMatch } from '../../features/catalog/searchIndex';
import { Switch } from '../controls';
import type { SettingsSectionProps } from './types';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Saisie en cours ; `previous` = terme de l'alias personnalisé en cours de modification. */
interface Draft {
  term: string;
  meaning: string;
  previous: string | null;
}

const EMPTY_DRAFT: Draft = { term: '', meaning: '', previous: null };

function countLabel(count: number): string {
  if (count === 0) return 'aucune destination';
  return count === 1 ? '1 destination' : `${count} destinations`;
}

/**
 * Rubrique « Alias » : dictionnaire GLOBAL de la recherche. Un alias se saisit une fois ici et
 * vaut pour toutes les destinations (grille et palette) ; rien n'est à renseigner carte par carte.
 *
 * Les alias fournis avec l'application se désactivent ou se remplacent, sans jamais être
 * modifiés : une mise à jour ne touche pas aux personnalisations. Chaque action est enregistrée
 * aussitôt, disque d'abord (`useAliases`). Le nombre de destinations trouvées par alias rend
 * visible un alias qui ne trouve rien, ou qui en ramène trop.
 */
export function AliasesSection({ aliases, destinations }: SettingsSectionProps) {
  const uid = useId();
  const termRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  /** Erreur de saisie (avec son champ) ou d'enregistrement (`field: null`). */
  const [error, setError] = useState<{ field: AliasError['field'] | null; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Clé de l'alias dont la suppression attend une confirmation. */
  const [confirming, setConfirming] = useState<string | null>(null);

  const { defaults, user, dictionary } = aliases;
  const rows = useMemo(() => listAliases(defaults, user), [defaults, user]);
  // Même dictionnaire (même objet) que la grille : l'index de recherche est partagé, pas refait.
  // Recherche exacte seulement : un alias qui ne trouve rien doit afficher zéro, pas des approximations.
  const counts = useMemo(() => {
    const index = getSearchIndex(destinations, dictionary);
    return new Map(
      rows.filter((r) => r.enabled).map((r) => [r.key, searchIndexMatch(index, r.key, { typos: false })?.size ?? index.docs.length]),
    );
  }, [destinations, dictionary, rows]);

  const locked = !aliases.loaded || aliases.error !== null || busy;

  /** Enregistre `next` ; en cas d'échec, l'état ne change pas et le message est affiché. */
  const apply = async (next: UserAliases): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await aliases.commit(next);
      return true;
    } catch (e) {
      setError({ field: null, message: `Alias non enregistré : ${errorText(e)}` });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setError(null);
    setConfirming(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const entry = { term: draft.term, expansions: splitExpansions(draft.meaning) };
    const previous = draft.previous ?? undefined;
    const problem = validateAliasEntry(entry, user, previous);
    if (problem) {
      setError(problem);
      return;
    }
    if (await apply(upsertAlias(user, entry, previous))) {
      reset();
      termRef.current?.focus();
    }
  };

  /** Préremplit la saisie : modification d'un alias personnalisé, ou remplacement d'un alias fourni. */
  const edit = (row: AliasRow) => {
    setDraft({ term: row.term, meaning: row.expansions.join(', '), previous: row.origin === 'custom' ? row.term : null });
    setError(null);
    setConfirming(null);
    termRef.current?.focus();
  };

  /** Supprime un alias ; une saisie en cours sur un AUTRE alias est conservée. */
  const onRemove = async (row: AliasRow) => {
    const editingThis = draft.previous !== null && draft.previous === row.term;
    if (!(await apply(removeAlias(user, row.term)))) return;
    setConfirming(null);
    if (editingThis) setDraft(EMPTY_DRAFT);
  };

  const editing = draft.previous !== null;
  const errorId = `${uid}-error`;

  return (
    <>
      <p className="form__hint">
        Un alias remplace un mot de la recherche par sa signification, pour toutes les destinations : il se saisit une
        seule fois ici.
      </p>
      {aliases.error && (
        <p className="form__error" role="alert">
          {aliases.error}
        </p>
      )}

      <form className="aliases__form" onSubmit={(e) => void onSubmit(e)}>
        <input
          ref={termRef}
          className="form__input aliases__term"
          type="text"
          value={draft.term}
          onChange={(e) => setDraft((d) => ({ ...d, term: e.target.value }))}
          placeholder="Alias"
          aria-label="Alias (un seul mot)"
          aria-invalid={error?.field === 'term' || undefined}
          aria-describedby={error?.field === 'term' ? errorId : undefined}
          maxLength={ALIAS_TERM_MAX + 10}
          disabled={locked}
          spellCheck={false}
          autoComplete="off"
        />
        <input
          className="form__input aliases__meaning"
          type="text"
          value={draft.meaning}
          onChange={(e) => setDraft((d) => ({ ...d, meaning: e.target.value }))}
          placeholder="Significations, séparées par des virgules"
          aria-label="Signification, plusieurs séparées par des virgules"
          aria-invalid={error?.field === 'expansions' || undefined}
          aria-describedby={error?.field === 'expansions' ? errorId : undefined}
          disabled={locked}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="btn btn--primary" disabled={locked}>
          {editing ? 'Enregistrer' : 'Ajouter'}
        </button>
        {(editing || draft.term !== '' || draft.meaning !== '') && (
          <button type="button" className="btn" disabled={busy} onClick={reset}>
            Annuler
          </button>
        )}
      </form>
      {error && (
        <p className="form__error" id={errorId} role="alert">
          {error.message}
        </p>
      )}

      <ul className="aliases__list" aria-label="Alias de recherche">
        {rows.map((row) => {
          const count = counts.get(row.key);
          const origin = row.origin === 'default' ? 'fourni' : row.overridesDefault ? 'personnalisé, remplace l\'alias fourni' : 'personnalisé';
          return (
            <li key={row.key} className={`setting aliases__row${row.enabled ? '' : ' is-off'}`}>
              <span className="setting__text">
                <span className="aliases__head">
                  <span className="aliases__name">{row.term}</span>
                  <span className="aliases__meanings">{row.expansions.join(' · ')}</span>
                </span>
                <span className="setting__description">
                  {origin}
                  {' · '}
                  {row.enabled && count !== undefined ? countLabel(count) : 'désactivé'}
                </span>
              </span>
              <span className="setting__control">
                {row.origin === 'custom' ? (
                  confirming === row.key ? (
                    <>
                      <button type="button" className="btn btn--danger" disabled={locked} onClick={() => void onRemove(row)}>
                        Confirmer
                      </button>
                      <button type="button" className="btn" disabled={busy} onClick={() => setConfirming(null)}>
                        Annuler
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn" disabled={locked} onClick={() => edit(row)}>
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger-ghost"
                        disabled={locked}
                        aria-label={`Supprimer l'alias ${row.term}`}
                        onClick={() => setConfirming(row.key)}
                      >
                        Supprimer
                      </button>
                    </>
                  )
                ) : (
                  <>
                    {row.enabled && (
                      <button
                        type="button"
                        className="btn"
                        disabled={locked}
                        aria-label={`Personnaliser l'alias ${row.term}`}
                        onClick={() => edit(row)}
                      >
                        Personnaliser
                      </button>
                    )}
                    <Switch
                      checked={row.enabled}
                      disabled={locked}
                      label={`Alias ${row.term} actif`}
                      title={row.enabled ? 'Désactiver' : 'Réactiver'}
                      onChange={(enabled) => void apply(setDefaultEnabled(user, row.term, enabled))}
                    />
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {aliases.loaded && rows.length === 0 && <p className="form__hint">Aucun alias pour l'instant</p>}
      <p className="form__hint">
        Les alias fournis ne sont jamais modifiés : vous pouvez les désactiver ou les remplacer. Vos alias sont dans{' '}
        <code>aliases.json</code> et survivent aux mises à jour.
      </p>
    </>
  );
}
