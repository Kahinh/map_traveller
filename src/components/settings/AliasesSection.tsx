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
import { errorText } from '../../lib/errors';
import { AliasRowItem } from './AliasRowItem';
import type { SettingsSectionProps } from './types';

/** Saisie en cours ; `previous` = terme de l'alias personnalisé en cours de modification. */
interface Draft {
  term: string;
  meaning: string;
  previous: string | null;
}

const EMPTY_DRAFT: Draft = { term: '', meaning: '', previous: null };

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

  /** Modification impossible (chargement, fichier illisible) : contrôles désactivés. */
  const blocked = !aliases.loaded || aliases.error !== null;
  // Pendant une écriture, les contrôles restent focalisables (`readOnly`, `aria-disabled`) : le
  // focus ne retombe pas sur la page après « Ajouter » ou une bascule au clavier.
  const locked = blocked || busy;
  const busyAttr = busy || undefined;

  /** Enregistre `next` ; en cas d'échec, l'état ne change pas et le message est affiché. */
  const apply = async (next: UserAliases): Promise<boolean> => {
    if (locked) return false;
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
    if (locked) return;
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
    termRef.current?.focus(); // la ligne a disparu
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

      {/* Échap dans un des deux champs vide la saisie (les champs ne sont jamais détournés par
          le clavier global : invariant 11). */}
      <form
        className="aliases__form"
        onSubmit={(e) => void onSubmit(e)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape' || busy || !(editing || draft.term !== '' || draft.meaning !== '')) return;
          e.preventDefault();
          reset();
        }}
      >
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
          disabled={blocked}
          readOnly={busy}
          aria-disabled={busyAttr}
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
          disabled={blocked}
          readOnly={busy}
          aria-disabled={busyAttr}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="btn btn--primary" disabled={blocked} aria-disabled={busyAttr}>
          {editing ? 'Enregistrer' : 'Ajouter'}
        </button>
        {(editing || draft.term !== '' || draft.meaning !== '') && (
          <button type="button" className="btn" aria-disabled={busyAttr} onClick={() => !busy && reset()}>
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
        {rows.map((row) => (
          <AliasRowItem
            key={row.key}
            row={row}
            count={counts.get(row.key)}
            confirming={confirming === row.key}
            blocked={blocked}
            busy={busy}
            onEdit={() => edit(row)}
            onAskRemove={() => !locked && setConfirming(row.key)}
            onRemove={() => void onRemove(row)}
            onCancelRemove={() => setConfirming(null)}
            onToggle={(enabled) => void apply(setDefaultEnabled(user, row.term, enabled))}
          />
        ))}
      </ul>
      {aliases.loaded && rows.length === 0 && <p className="form__hint">Aucun alias pour l'instant</p>}
      <p className="form__hint">
        Les alias fournis ne sont jamais modifiés : vous pouvez les désactiver ou les remplacer. Vos alias sont dans{' '}
        <code>aliases.json</code> et survivent aux mises à jour.
      </p>
    </>
  );
}
