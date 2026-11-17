import { useEffect, useEffectEvent, type RefObject } from 'react';

/** Vrai si la cible d'un évènement clavier est un champ de saisie (l'application n'a que des champs de texte). */
function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

interface Options {
  /** Formulaire ouvert : il gère son propre clavier, rien ici. */
  disabled: boolean;
  /** Un panneau (Farm, Paramètres) est ouvert. */
  panelOpen: boolean;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  closePanel: () => void;
  /** Ferme le panneau ouvert s'il y en a un, puis met le focus dans la recherche (texte sélectionné). */
  focusSearch: () => void;
  clearQuery: () => void;
  exitManageMode: () => void;
}

/**
 * Clavier de la fenêtre principale : Échap (retour / effacer / quitter le mode gestion), Ctrl+F
 * (recherche), frappe directe → recherche. Un seul abonnement pour toute la vie de l'application :
 * `useEffectEvent` lit l'état courant sans réabonner à chaque frappe.
 *
 * Paramètres : Échap ferme le panneau ; pendant la capture d'un raccourci, le champ arrête la
 * propagation de toutes les touches, donc Échap n'annule que la capture.
 */
export function useAppKeyboard(options: Options) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const { disabled, panelOpen, query, searchRef, closePanel, focusSearch, clearQuery, exitManageMode } = options;
    if (disabled) return;
    const search = searchRef.current;
    // Une saisie dans un champ (autre que la recherche) ne doit jamais être détournée.
    if (isEditableTarget(e.target) && e.target !== search) return;
    if (e.key === 'Escape') {
      if (panelOpen) closePanel();
      else if (query !== '') clearQuery();
      else exitManageMode();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      focusSearch();
      return;
    }
    const printable = e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (printable && !panelOpen && document.activeElement !== search) search?.focus();
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
