import { useEffect, useRef, type ReactNode } from 'react';
import type { LoadState } from '../app/useCatalog';
import { useGridWindow } from '../app/useGridWindow';
import type { FeedbackKind } from '../app/useCopyFeedback';
import type { Destination } from '../features/catalog/schema';
import type { ViewFilter } from '../features/catalog/search';
import type { ClickButton, PartIndex } from '../features/commands/cardParts';
import { CompactCard } from './CompactCard';

/** Retour visuel en cours sur une carte (copie ou avertissement). */
interface CardFeedback {
  key: string;
  kind: FeedbackKind;
  part?: PartIndex;
}

interface Props {
  id: string;
  load: LoadState;
  /** Le catalogue contient au moins une destination (toutes vues confondues). */
  hasDestinations: boolean;
  /** Destinations de la vue courante, déjà filtrées et triées. */
  visible: readonly Destination[];
  view: ViewFilter;
  /** Recherche appliquée à `visible` (valeur différée). */
  query: string;
  favorites: ReadonlySet<string>;
  feedback: CardFeedback | null;
  manageMode: boolean;
  /** Après un enregistrement : carte à amener à l'écran dès qu'elle fait partie de la grille.
   *  Un nouvel objet par demande. */
  reveal: { id: string } | null;
  onCardAction: (d: Destination, part: PartIndex, button: ClickButton) => void;
  onToggleFavorite: (d: Destination) => void;
  onEdit: (d: Destination) => void;
  onNew: () => void;
  inert: boolean;
}

/** État vide d'une vue : un titre, et une indication quand il y a quelque chose à faire. */
function emptyMessage(view: ViewFilter, query: string): { title: string; hint?: string } {
  if (query.trim())
    return { title: `Aucun résultat pour « ${query.trim()} »`, hint: 'Échap pour effacer la recherche' };
  if (view === 'favorites') return { title: 'Aucun favori', hint: "Cliquez sur l'étoile d'une carte pour l'ajouter" };
  return { title: 'Aucune destination dans cette catégorie' };
}

function Empty({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {hint && <p className="empty__hint">{hint}</p>}
      {children}
    </div>
  );
}

/**
 * Grille de cartes à défilement vertical : états vides, fenêtrage (seules les rangées visibles
 * plus une marge sont dans le DOM) et mise à l'écran d'une carte enregistrée.
 * Les cartes sont mémoïsées : les gestionnaires reçus doivent être stables.
 */
export function CatalogGrid({
  id,
  load,
  hasDestinations,
  visible,
  view,
  query,
  favorites,
  feedback,
  manageMode,
  reveal: revealRequest,
  onCardAction,
  onToggleFavorite,
  onEdit,
  onNew,
  inert,
}: Props) {
  const { scrollRef, gridRef, start, end, style, reveal } = useGridWindow(visible.length);
  const revealedRef = useRef<{ id: string } | null>(null);

  // Par calcul de sa rangée : la carte n'est pas forcément rendue. La grille a pu recevoir la
  // nouvelle destination avant la demande, ou la recevoir après : l'effet suit les deux.
  useEffect(() => {
    if (revealRequest === null || revealedRef.current === revealRequest) return;
    const index = visible.findIndex((d) => d.id === revealRequest.id);
    if (index < 0) return;
    revealedRef.current = revealRequest;
    reveal(index);
  }, [visible, revealRequest, reveal]);

  const ready = load.status === 'ready';
  const emptyView = ready && hasDestinations && visible.length === 0 ? emptyMessage(view, query) : null;

  return (
    <main id={id} ref={scrollRef} className={`grid-scroll${manageMode ? ' is-managing' : ''}`} inert={inert}>
      {load.status === 'loading' && <Empty title="Chargement…" />}
      {load.status === 'error' && (
        <div className="empty">
          <p className="empty__title">Catalogue illisible, il n'a pas été modifié</p>
          <p className="empty__hint">
            Fermez l'application et remplacez catalog.json par catalog.json.bak (dossier : Paramètres › Données)
          </p>
          <p className="empty__hint empty__detail">{load.message}</p>
        </div>
      )}
      {ready && !hasDestinations && (
        <Empty title="Aucune destination pour l'instant">
          <button type="button" className="btn btn--primary" onClick={onNew}>
            Créer une destination
          </button>
        </Empty>
      )}
      {emptyView && <Empty title={emptyView.title} hint={emptyView.hint} />}
      <div ref={gridRef} className="grid" style={style}>
        {visible.slice(start, end).map((d) => (
          <CompactCard
            key={d.id}
            destination={d}
            favorite={favorites.has(d.id)}
            feedback={feedback?.key === d.id ? feedback.kind : null}
            feedbackPart={feedback?.key === d.id ? (feedback.part ?? null) : null}
            onAction={onCardAction}
            onToggleFavorite={onToggleFavorite}
            manage={manageMode}
            onEdit={onEdit}
          />
        ))}
      </div>
    </main>
  );
}
