import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartIndex } from '../features/commands/cardParts';
import { copyText } from '../lib/tauri/clipboard';

export type FeedbackKind = 'copied' | 'warning';

export interface CopyFeedback {
  /** Identifie l'élément cliqué (id de destination, `farm:start`, `farm:<indice>`). */
  key: string;
  kind: FeedbackKind;
  /** Message affiché dans la bulle d'état. */
  text: string;
  /** Zone cliquée d'une carte à deux étapes ; absente pour une carte classique ou Farm. */
  part?: PartIndex;
}

const COPIED_MS = 800;
const WARNING_MS = 1500;

/**
 * Copie dans le presse-papiers avec un retour visuel bref et non bloquant.
 * `copy` est stable : il peut être passé à des composants mémoïsés.
 */
export function useCopyFeedback() {
  const [feedback, setFeedback] = useState<CopyFeedback | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = useCallback((next: CopyFeedback) => {
    window.clearTimeout(timer.current);
    setFeedback(next);
    timer.current = window.setTimeout(() => setFeedback(null), next.kind === 'copied' ? COPIED_MS : WARNING_MS);
  }, []);

  /**
   * Copie `text`, ou signale `emptyMessage` s'il n'y a rien à copier (`text === null`).
   * `part` désigne la zone cliquée d'une carte à deux étapes, pour n'animer qu'elle.
   */
  const copy = useCallback(
    async (key: string, text: string | null, emptyMessage: string, part?: PartIndex) => {
      if (text === null) return flash({ key, part, kind: 'warning', text: emptyMessage });
      try {
        await copyText(text);
        flash({ key, part, kind: 'copied', text: `Copié : ${text}` });
      } catch (e) {
        flash({ key, part, kind: 'warning', text: `Copie impossible : ${String(e)}` });
      }
    },
    [flash],
  );

  return { feedback, copy };
}
