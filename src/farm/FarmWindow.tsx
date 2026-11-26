import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useCopyFeedback } from '../app/useCopyFeedback';
import { useFarmProgress } from '../app/useFarmProgress';
import { farmProgressText, FarmSteps } from '../components/FarmSteps';
import { CloseIcon, MarkIcon } from '../components/icons';
import type { Destination } from '../features/catalog/schema';
import { farmNextCopy, farmStartCommand, farmStepCommand, parseFarmRoute } from '../features/farm/farmRoute';
import { errorText } from '../lib/errors';
import { getFarmId, hideFarm, onFarmNext, onFarmOpen } from '../lib/tauri/farm';
import { onStoreChanged } from '../lib/tauri/palette';
import { parseCatalogText, readStoreText } from '../lib/tauri/storeRead';

const NOTHING_TO_COPY = 'Aucune commande à copier';

type Catalog = { status: 'loading' } | { status: 'ready'; destinations: readonly Destination[] } | { status: 'error'; text: string };

/** Catalogue lu en lecture seule, relu à chaque écriture (`store:changed`). */
function useCatalogRead(): Catalog {
  const [catalog, setCatalog] = useState<Catalog>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    const load = () =>
      readStoreText('catalog')
        .then((text) => {
          const result = parseCatalogText(text);
          if (!active) return;
          setCatalog(
            result.ok
              ? { status: 'ready', destinations: result.catalog.destinations }
              : { status: 'error', text: 'Catalogue illisible' },
          );
        })
        .catch((e: unknown) => {
          if (active) setCatalog({ status: 'error', text: `Chargement impossible : ${errorText(e)}` });
        });
    void load();
    const unsubscribe = onStoreChanged((name) => {
      if (name === 'catalog') void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return catalog;
}

/** Le menu contextuel du navigateur n'a pas sa place ici : le clic droit copie aussi. */
const blockContextMenu = (e: MouseEvent) => e.preventDefault();

/**
 * Fenêtre d'un parcours Farm, toujours au premier plan : une case par position, chacune copie
 * son seul `/travel` (invariant 3). La dernière position cliquée de chaque parcours reste en
 * évidence pour la session : la fenêtre est masquée, jamais détruite.
 */
export function FarmWindow() {
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const catalog = useCatalogRead();
  const progress = useFarmProgress();
  const { feedback, copy } = useCopyFeedback();

  useEffect(() => {
    let active = true;
    getFarmId()
      .then((first) => {
        if (active && first !== null) setId((current) => current ?? first);
      })
      .catch((e: unknown) => setError(`Parcours introuvable : ${errorText(e)}`));
    const unsubscribe = onFarmOpen(setId);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const close = useCallback(() => {
    hideFarm().catch((e: unknown) => setError(`Fermeture impossible : ${errorText(e)}`));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const farm = useMemo(
    () => (catalog.status === 'ready' ? (catalog.destinations.find((d) => d.id === id && d.category === 'farm') ?? null) : null),
    [catalog, id],
  );
  const route = useMemo(() => (farm ? parseFarmRoute(farm.command) : null), [farm]);
  const step = farm ? progress.stepOf(farm.id) : -1;
  const currentStep = step >= 0 ? step : null;
  const start = route ? farmStartCommand(route) : null;

  // Raccourci global « position suivante » (Rust n'émet `farm:next` que fenêtre affichée) : la
  // position qui suit la dernière cliquée devient la position courante et se copie. Lu par une
  // référence : l'abonnement est pris une seule fois.
  const nextRef = useRef<() => void>(() => undefined);
  const { setStep } = progress;
  useEffect(() => {
    nextRef.current = () => {
      if (!farm || !route) return;
      const next = farmNextCopy(route, step);
      if (next === null) {
        void copy('next', null, NOTHING_TO_COPY);
        return;
      }
      setStep(farm.id, next.step);
      void copy(next.start ? 'start' : String(next.step), next.text, NOTHING_TO_COPY);
    };
  }, [farm, route, step, setStep, copy]);
  useEffect(() => onFarmNext(() => nextRef.current()), []);

  let message: string | null = error;
  if (!message) {
    if (catalog.status === 'loading') message = 'Chargement…';
    else if (catalog.status === 'error') message = catalog.text;
    else if (!farm) message = id === null ? 'Aucun parcours ouvert' : 'Parcours introuvable';
  }
  const warning = feedback?.kind === 'warning' ? feedback.text : null;

  return (
    <div className="app farm-window" onContextMenu={blockContextMenu}>
      <header className="titlebar" data-tauri-drag-region>
        <MarkIcon className="titlebar__mark" dragRegion />
        <span className="titlebar__title" data-tauri-drag-region title={farm?.name}>
          {farm?.name ?? 'Parcours Farm'}
        </span>
        {route && (
          <span className={`farm-panel__progress${warning ? ' is-warning' : ''}`} data-tauri-drag-region>
            {warning ?? farmProgressText(route, currentStep)}
          </span>
        )}
        <button type="button" className="icon-btn icon-btn--close" title="Fermer (Échap)" aria-label="Fermer" onClick={close}>
          <CloseIcon />
        </button>
      </header>

      {message !== null || !farm || !route ? (
        <div className="empty">
          <p className="empty__title">{message}</p>
        </div>
      ) : (
        <FarmSteps
          route={route}
          hasStart={start !== null}
          currentStep={currentStep}
          feedbackKey={feedback && feedback.kind === 'copied' ? feedback.key : null}
          onStart={() => {
            // « Début » mène à la première position : c'est elle qui devient la position courante.
            progress.setStep(farm.id, 0);
            void copy('start', start, NOTHING_TO_COPY);
          }}
          onStep={(i) => {
            progress.setStep(farm.id, i);
            void copy(String(i), farmStepCommand(route, i), NOTHING_TO_COPY);
          }}
        />
      )}
    </div>
  );
}
