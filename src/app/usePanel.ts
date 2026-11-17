import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Panneau unique de la fenêtre principale (Farm, formulaire, Paramètres) et retour du focus.
 *
 * À l'ouverture (aucun panneau ouvert avant), l'élément qui a le focus est retenu ; à la
 * fermeture, il le retrouve. S'il a quitté le DOM (carte supprimée, ou sortie de la fenêtre de
 * la grille), `fallbackRef` (la recherche) le prend. `open`, `close` et `closeAndFocus` sont stables.
 */
export function usePanel<P>(fallbackRef: RefObject<HTMLElement | null>) {
  const [panel, setPanel] = useState<P | null>(null);
  const panelRef = useRef<P | null>(null);
  const returnFocusRef = useRef<Element | null>(null);

  const open = useCallback((next: P) => {
    if (panelRef.current === null) returnFocusRef.current = document.activeElement;
    panelRef.current = next;
    setPanel(next);
  }, []);

  const close = useCallback(() => {
    panelRef.current = null;
    setPanel(null);
  }, []);

  /** Ferme le panneau et donne ensuite le focus à `target` plutôt qu'à l'élément retenu (Ctrl+F). */
  const closeAndFocus = useCallback(
    (target: HTMLElement | null) => {
      returnFocusRef.current = target;
      close();
    },
    [close],
  );

  // Après le rendu sans panneau : la grille et la barre d'outils ne sont plus inertes.
  useEffect(() => {
    if (panel !== null) return;
    const origin = returnFocusRef.current;
    if (origin === null) return;
    returnFocusRef.current = null;
    if (origin instanceof HTMLElement && origin.isConnected) origin.focus();
    else fallbackRef.current?.focus();
  }, [panel, fallbackRef]);

  return { panel, open, close, closeAndFocus };
}
