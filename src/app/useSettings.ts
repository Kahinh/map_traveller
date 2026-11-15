import { useCallback, useEffect, useRef, useState } from 'react';
import { applySettingsPatch, DEFAULT_SETTINGS, type Settings, type SettingsPatch } from '../features/settings/settings';
import { loadSettings, saveSettings } from '../lib/tauri/storage';
import { setAlwaysOnTop } from '../lib/tauri/window';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Réglages de l'interface (`settings.json`) : chargement au démarrage, puis `update(patch)`
 * qui applique ET enregistre aussitôt (pas de bouton « Enregistrer »).
 *
 * - L'état est mis à jour tout de suite (l'épingle doit réagir sans attendre le disque) ;
 *   un échec d'écriture est signalé par `onSaveError`, jamais levé.
 * - Les écritures sont faites l'une après l'autre, dans l'ordre des changements : la dernière
 *   écrite est toujours la plus récente.
 * - Avant la fin du chargement, `update` ne fait rien : écrire à ce moment remplacerait les
 *   réglages du fichier par les valeurs par défaut.
 * - `update` est stable. Il renvoie une promesse résolue une fois CE changement écrit (ou son
 *   échec signalé) : elle ne rejette jamais. Le moteur de mise à jour l'attend avant de lancer
 *   l'installateur, qui ferme l'application.
 * - `loaded` passe à `true` une fois le fichier lu : avant, `settings` vaut les valeurs par défaut.
 */
export function useSettings(onSaveError?: (message: string) => void) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  /** Derniers réglages connus ; `null` tant qu'ils ne sont pas chargés. */
  const settingsRef = useRef<Settings | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const onSaveErrorRef = useRef(onSaveError);

  useEffect(() => {
    onSaveErrorRef.current = onSaveError;
  });

  useEffect(() => {
    let alive = true;
    void loadSettings().then((loaded) => {
      if (!alive) return;
      settingsRef.current = loaded;
      setSettings(loaded);
      setLoaded(true);
      void setAlwaysOnTop(loaded.alwaysOnTop);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((patch: SettingsPatch): Promise<void> => {
    const current = settingsRef.current;
    if (current === null) return Promise.resolve();
    const next = applySettingsPatch(current, patch);
    settingsRef.current = next;
    setSettings(next);
    if (patch.alwaysOnTop !== undefined) void setAlwaysOnTop(next.alwaysOnTop);
    saveQueue.current = saveQueue.current
      .then(() => saveSettings(next))
      .catch((e: unknown) => onSaveErrorRef.current?.(`Réglages non enregistrés : ${errorText(e)}`));
    return saveQueue.current;
  }, []);

  return { settings, loaded, update };
}
