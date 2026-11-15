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
 * - `update` est stable.
 */
export function useSettings(onSaveError?: (message: string) => void) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
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
      void setAlwaysOnTop(loaded.alwaysOnTop);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((patch: SettingsPatch) => {
    const current = settingsRef.current;
    if (current === null) return;
    const next = applySettingsPatch(current, patch);
    settingsRef.current = next;
    setSettings(next);
    if (patch.alwaysOnTop !== undefined) void setAlwaysOnTop(next.alwaysOnTop);
    saveQueue.current = saveQueue.current
      .then(() => saveSettings(next))
      .catch((e: unknown) => onSaveErrorRef.current?.(`Réglages non enregistrés : ${errorText(e)}`));
  }, []);

  return { settings, update };
}
