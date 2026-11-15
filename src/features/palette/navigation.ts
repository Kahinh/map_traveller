/**
 * Palette : sélection au clavier et à la souris. Réducteur pur, testable sans navigateur.
 *
 * `index` = ligne sélectionnée (-1 si la liste est vide) ; `choice` = case active de cette
 * ligne (0 = étape 1). Tout changement de ligne remet `choice` à 0. Quand rien ne change,
 * l'état d'entrée est renvoyé tel quel (même objet), pour éviter un rendu inutile.
 */

export interface NavState {
  index: number;
  choice: number;
}

export type NavAction =
  | { type: 'next' | 'prev' | 'first' | 'last' }
  | { type: 'set'; index: number }
  | { type: 'choice-next' | 'choice-prev' }
  | { type: 'set-choice'; choice: number }
  | { type: 'results' };

/** État après un affichage ou un changement de résultats. */
export function initialNav(count: number): NavState {
  return { index: count > 0 ? 0 : -1, choice: 0 };
}

/** Sélectionne la ligne `index` ; `choice` revient à 0 seulement si la ligne change. */
function selectRow(state: NavState, index: number): NavState {
  if (index === state.index) return state;
  return { index, choice: 0 };
}

function selectChoice(state: NavState, choice: number): NavState {
  return choice === state.choice ? state : { index: state.index, choice };
}

/** `choiceCounts[i]` = nombre de choix de la ligne i (1 ou 2). */
export function navReducer(state: NavState, action: NavAction, choiceCounts: readonly number[]): NavState {
  const count = choiceCounts.length;
  if (action.type === 'results') {
    const next = initialNav(count);
    return next.index === state.index && next.choice === state.choice ? state : next;
  }
  if (count === 0) return state.index === -1 && state.choice === 0 ? state : initialNav(0);

  // Ligne courante hors bornes (résultats changés sans `results`) : repartir de 0.
  const current = state.index >= 0 && state.index < count ? state.index : -1;
  switch (action.type) {
    case 'next':
      return selectRow(state, current === -1 ? 0 : (current + 1) % count);
    case 'prev':
      return selectRow(state, current === -1 ? count - 1 : (current - 1 + count) % count);
    case 'first':
      return selectRow(state, 0);
    case 'last':
      return selectRow(state, count - 1);
    case 'set':
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= count) return state;
      return selectRow(state, action.index);
    case 'choice-next':
    case 'choice-prev':
    case 'set-choice': {
      if (current === -1) return state;
      const max = (choiceCounts[current] ?? 1) - 1;
      if (max <= 0) return state; // ligne à un seul choix : sans effet
      const wanted =
        action.type === 'set-choice' ? action.choice : state.choice + (action.type === 'choice-next' ? 1 : -1);
      if (!Number.isInteger(wanted)) return state;
      return selectChoice(state, Math.min(max, Math.max(0, wanted)));
    }
  }
}
