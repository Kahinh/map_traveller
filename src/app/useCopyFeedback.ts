import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartIndex } from '../features/commands/cardParts';
import { errorText } from '../lib/errors';
import { copyText } from '../lib/tauri/clipboard';

export type FeedbackKind = 'copied' | 'warning';

export interface CopyFeedback {
  /** Identifie l'élément cliqué (id de destination, `farm:start`, `farm:<indice>`). */
  key: string;
  kind: FeedbackKind;
  /** Message affiché dans la bulle d'état. */
  text: string;
  /** Texte copié, affiché après le message en police à chasse fixe. */
  command?: string;
  /** Détail technique d'un échec, en infobulle. */
  detail?: string;
  /** Zone cliquée d'une carte à deux étapes ; absente pour une carte classique ou Farm. */
  part?: PartIndex;
}

interface CopyOptions {
  /** Zone cliquée d'une carte à deux étapes. */
  part?: PartIndex;
  /** Début du message de réussite ; « Copié » par défaut. */
  label?: string;
}

/** Clé des messages généraux : `:` n'apparaît jamais dans un identifiant généré. */
const NOTICE_KEY = 'app:notice';

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

  const flash = useCallback((next: CopyFeedback, durationMs?: number) => {
    window.clearTimeout(timer.current);
    setFeedback(next);
    const ms = durationMs ?? (next.kind === 'copied' ? COPIED_MS : WARNING_MS);
    timer.current = window.setTimeout(() => setFeedback(null), ms);
  }, []);

  /**
   * Copie `text`, ou signale `emptyMessage` s'il n'y a rien à copier (`text === null`).
   * `part` désigne la zone cliquée d'une carte à deux étapes, pour n'animer qu'elle ; `label`
   * remplace « Copié » (« Copié sans Zaap » quand la carte a deux variantes).
   */
  const copy = useCallback(
    async (key: string, text: string | null, emptyMessage: string, options: CopyOptions = {}) => {
      const { part, label = 'Copié' } = options;
      if (text === null) return flash({ key, part, kind: 'warning', text: emptyMessage });
      try {
        await copyText(text);
        flash({ key, part, kind: 'copied', text: label, command: text });
      } catch (e) {
        // Message court et sobre ; le détail reste lisible en infobulle et dans la console.
        console.error('Copie impossible', e);
        flash({ key, part, kind: 'warning', text: 'Copie impossible, réessayez', detail: errorText(e) });
      }
    },
    [flash],
  );

  /**
   * Message bref dans la bulle d'état, sans lien avec une carte (ex. « Destination enregistrée »).
   * `durationMs` remplace la durée par défaut du type de message.
   */
  const notify = useCallback(
    (text: string, kind: FeedbackKind = 'copied', durationMs?: number) =>
      flash({ key: NOTICE_KEY, kind, text }, durationMs),
    [flash],
  );

  return { feedback, copy, notify };
}
