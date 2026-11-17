import { useCallback, useEffect, useRef, useState } from 'react';
import { applySettingsPatch, DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../features/settings/settings';
import { errorText } from '../lib/errors';
import { readSettings, saveSettings } from '../lib/tauri/storage';
import { setAlwaysOnTop } from '../lib/tauri/window';
import { createWriteGate } from '../lib/writeGate';

/**
 * Réglages de l'interface (`settings.json`) : chargement au démarrage, puis `update(patch)`
 * qui applique ET enregistre aussitôt (pas de bouton « Enregistrer »).
 *
 * - L'état est mis à jour tout de suite (l'épingle doit réagir sans attendre le disque) ;
 *   un échec d'écriture est signalé par `onError`, jamais levé.
 * - Écritures à la file (`createWriteGate`) : la dernière écrite est toujours la plus récente.
 * - Avant la fin du chargement, `update` ne fait rien : écrire à ce moment remplacerait les
 *   réglages du fichier par les valeurs par défaut.
 * - Fichier illisible ou lecture échouée : valeurs par défaut en mémoire, `error` renseignée, et
 *   plus AUCUNE écriture (le fichier, qui porte aussi les raccourcis de Rust, reste tel quel).
 * - `update` est stable. Il renvoie une promesse résolue une fois CE changement écrit (ou son
 *   échec signalé) : elle ne rejette jamais. Le moteur de mise à jour l'attend avant de lancer
 *   l'installateur, qui ferme l'application.
 * - `loaded` passe à `true` une fois la lecture terminée : avant, `settings` vaut les valeurs par défaut.
 */
export function useSettings(onError: (message: string) => void) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Derniers réglages connus ; `null` tant qu'ils ne sont pas chargés. */
  const settingsRef = useRef<Settings | null>(null);
  const [gate] = useState(() => createWriteGate('Réglages non chargés'));
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  });

  /** Échec de la fenêtre native : signalé, sans bloquer le réglage. */
  const applyAlwaysOnTop = useCallback((value: boolean) => {
    setAlwaysOnTop(value).catch((e: unknown) => onErrorRef.current(`Premier plan impossible : ${errorText(e)}`));
  }, []);

  useEffect(() => {
    let alive = true;
    readSettings()
      .catch((e: unknown) => ({ value: DEFAULT_SETTINGS, error: `Réglages non lus : ${errorText(e)}` }))
      .then((result) => {
        if (!alive) return;
        if (result.error === null) gate.open();
        else {
          const message = `${result.error} : réglages par défaut, rien n'est enregistré`;
          gate.refuse(message);
          setError(message);
          onErrorRef.current(message);
        }
        settingsRef.current = result.value;
        setSettings(result.value);
        setLoaded(true);
        applyAlwaysOnTop(result.value.alwaysOnTop);
      });
    return () => {
      alive = false;
    };
  }, [gate, applyAlwaysOnTop]);

  const update = useCallback(
    (patch: SettingsPatch): Promise<void> => {
      const current = settingsRef.current;
      if (current === null) return Promise.resolve();
      const next = applySettingsPatch(current, patch);
      settingsRef.current = next;
      setSettings(next);
      if (patch.alwaysOnTop !== undefined) applyAlwaysOnTop(next.alwaysOnTop);
      // Lecture seule : le changement vaut pour la session, l'erreur est déjà affichée.
      if (!gate.writable) return Promise.resolve();
      return gate
        .run(() => saveSettings(next))
        .catch((e: unknown) => onErrorRef.current(`Réglages non enregistrés : ${errorText(e)}`));
    },
    [gate, applyAlwaysOnTop],
  );

  return { settings, loaded, error, update };
}
