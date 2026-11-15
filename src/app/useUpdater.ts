import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Settings, SettingsPatch } from '../features/settings/settings';
import { canCheckForUpdate, type UpdateState, type UpdaterBinding } from '../features/updates/types';
import {
  describeUpdateError,
  installedUpdateMessage,
  installedUpdateNotice,
  isVisibleUpdateChange,
  shouldAutoInstall,
  shouldCheckOnStartup,
  updateReducer,
  type UpdateEvent,
} from '../features/updates/updates';
import { getAppVersion } from '../lib/tauri/app';
import {
  canUseUpdater,
  checkForUpdate,
  downloadAndInstall,
  relaunchApp,
  releaseUpdate,
  UPDATER_BROWSER_MESSAGE,
  type AvailableUpdate,
} from '../lib/tauri/updater';
import type { FeedbackKind } from './useCopyFeedback';

/** Délai entre le lancement et la vérification automatique : la fenêtre s'ouvre d'abord. */
export const STARTUP_CHECK_DELAY_MS = 5_000;
/** Durée d'affichage de « Mise à jour X.Y.Z installée ». */
const INSTALLED_NOTICE_MS = 4_000;

const IDLE: UpdateState = { status: 'idle' };

type Origin = 'manual' | 'auto';

interface Options {
  settings: Settings;
  /** Vrai une fois `settings.json` lu : rien n'est décidé sur les valeurs par défaut. */
  settingsLoaded: boolean;
  /** Applique et enregistre un changement ; la promesse est résolue une fois écrit, ne rejette jamais. */
  updateSettings: (patch: SettingsPatch) => Promise<void>;
  /** Vrai tant qu'un formulaire de destination est ouvert : l'installation attend sa fermeture. */
  installBlocked: boolean;
  notify: (text: string, kind?: FeedbackKind, durationMs?: number) => void;
}

/**
 * Moteur de mise à jour (issue n°5), monté au niveau de l'application pour que le mode
 * automatique fonctionne panneau Paramètres fermé. Renvoie le `UpdaterBinding` de la rubrique
 * « Mises à jour » et l'état courant (bulle d'état pendant un téléchargement).
 *
 * Garanties :
 * - Manuel : AUCUNE requête tant que l'utilisateur n'a pas cliqué.
 * - Automatique : une vérification `STARTUP_CHECK_DELAY_MS` après le lancement (mode relu à ce
 *   moment-là), puis téléchargement et installation sans question ; en cas d'erreur ou s'il n'y
 *   a rien de nouveau, rien n'est affiché hors des Paramètres.
 * - Une seule opération à la fois ; un appel hors de propos est ignoré.
 * - Délai maximal sur la vérification et le téléchargement (pont `lib/tauri/updater`).
 * - Aucune exception ne s'échappe : toute erreur devient l'état `error`.
 * - L'installation (qui ferme l'application) n'est lancée qu'avec le formulaire de destination
 *   fermé et les réglages écrits sur le disque.
 * - Après une mise à jour, « Mise à jour X.Y.Z installée » est affiché une seule fois.
 */
export function useUpdater({ settings, settingsLoaded, updateSettings, installBlocked, notify }: Options) {
  const available = canUseUpdater();
  const [state, setState] = useState<UpdateState>(IDLE);
  /** État courant, lu de façon synchrone par les garde-fous (l'état React arrive plus tard). */
  const stateRef = useRef<UpdateState>(IDLE);
  /** Une opération (vérification ou téléchargement-installation) est en cours. */
  const busyRef = useRef(false);
  /** Mise à jour trouvée par la dernière vérification (ressource native). */
  const pendingRef = useRef<AvailableUpdate | null>(null);
  const blockedRef = useRef(installBlocked);
  const unblockWaitersRef = useRef<(() => void)[]>([]);
  const startupDoneRef = useRef(false);
  const noticeDoneRef = useRef(false);
  const optionsRef = useRef({ settings, updateSettings, notify });

  // Déclaré en premier : les effets suivants lisent les options à jour.
  useEffect(() => {
    optionsRef.current = { settings, updateSettings, notify };
  });

  useEffect(() => {
    blockedRef.current = installBlocked;
    if (!installBlocked) {
      const waiters = unblockWaitersRef.current;
      unblockWaitersRef.current = [];
      for (const resolve of waiters) resolve();
    }
  }, [installBlocked]);

  /** Applique un évènement ; l'état React (rendu) ne suit que les changements visibles. */
  const send = useCallback((event: UpdateEvent) => {
    const prev = stateRef.current;
    const next = updateReducer(prev, event);
    if (next === prev) return;
    stateRef.current = next;
    if (isVisibleUpdateChange(prev, next)) setState(next);
  }, []);

  /** Résolue dès qu'aucun formulaire de destination n'est ouvert. */
  const waitUntilUnblocked = useCallback(
    () =>
      blockedRef.current
        ? new Promise<void>((resolve) => {
            unblockWaitersRef.current.push(resolve);
          })
        : Promise.resolve(),
    [],
  );

  const runInstall = useCallback(
    async (origin: Origin) => {
      const pending = pendingRef.current;
      const current = stateRef.current;
      if (!available || busyRef.current || pending === null) return;
      if (current.status !== 'available' || current.version !== pending.version) return;
      busyRef.current = true;
      try {
        send({ type: 'download-started', version: pending.version });
        await downloadAndInstall(
          pending,
          (p) => send(p.kind === 'length' ? { type: 'download-length', total: p.total } : { type: 'download-chunk', bytes: p.bytes }),
          async () => {
            send({ type: 'downloaded' });
            // Le formulaire peut s'ouvrir pendant l'écriture des réglages : on revérifie après.
            for (;;) {
              await waitUntilUnblocked();
              // Garde-fou anti-boucle (automatique) ; en manuel, simple attente des écritures en cours.
              await optionsRef.current.updateSettings(
                origin === 'auto' ? { updates: { lastAutoInstallVersion: pending.version } } : {},
              );
              if (!blockedRef.current) break;
            }
            send({ type: 'install-started' });
          },
        );
        // Atteint seulement si le plugin n'a pas terminé le processus (hors Windows).
        await relaunchApp();
      } catch (e) {
        send({ type: 'failed', ...describeUpdateError(e) });
      } finally {
        busyRef.current = false;
      }
    },
    [available, send, waitUntilUnblocked],
  );

  const runCheck = useCallback(
    async (origin: Origin) => {
      if (!available || busyRef.current || !canCheckForUpdate(stateRef.current)) return;
      busyRef.current = true;
      let found: AvailableUpdate | null = null;
      try {
        send({ type: 'check-started' });
        const previous = pendingRef.current;
        pendingRef.current = null;
        void releaseUpdate(previous);
        found = await checkForUpdate();
        void optionsRef.current.updateSettings({ updates: { lastCheckedAt: Date.now() } });
        if (found === null) {
          send({ type: 'check-none', at: Date.now() });
        } else {
          pendingRef.current = found;
          send({ type: 'check-found', version: found.version, notes: found.notes });
        }
      } catch (e) {
        send({ type: 'failed', ...describeUpdateError(e) });
      } finally {
        busyRef.current = false;
      }
      // Seule la vérification du lancement installe sans demander ; un clic sur « Rechercher »
      // propose toujours la version (bouton « Installer et redémarrer »).
      const updates = optionsRef.current.settings.updates;
      if (origin === 'auto' && found !== null && updates.mode === 'auto' && shouldAutoInstall(found.version, updates.lastAutoInstallVersion)) {
        await runInstall('auto');
      }
    },
    [available, send, runInstall],
  );

  // Mode automatique : une vérification par lancement, après un court délai. Le drapeau est posé
  // dans le minuteur (et non à la planification) : le double montage de `StrictMode` ne l'annule pas.
  useEffect(() => {
    if (!available || !settingsLoaded || startupDoneRef.current) return;
    const timer = setTimeout(() => {
      if (startupDoneRef.current) return;
      startupDoneRef.current = true;
      const updates = optionsRef.current.settings.updates;
      if (shouldCheckOnStartup(updates.mode, updates.lastCheckedAt, Date.now())) {
        runCheck('auto').catch(() => undefined);
      }
    }, STARTUP_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [available, settingsLoaded, runCheck]);

  // Après une mise à jour : annonce unique, puis mémorisation de la version lancée.
  useEffect(() => {
    if (!available || !settingsLoaded || noticeDoneRef.current) return;
    getAppVersion()
      .then((current) => {
        if (noticeDoneRef.current || current === null) return;
        noticeDoneRef.current = true;
        const { settings: s, updateSettings: save, notify: show } = optionsRef.current;
        const lastSeen = s.updates.lastSeenVersion;
        const announced = installedUpdateNotice(current, lastSeen);
        if (announced !== null) show(installedUpdateMessage(announced), 'copied', INSTALLED_NOTICE_MS);
        if (lastSeen !== current) void save({ updates: { lastSeenVersion: current } });
      })
      .catch(() => undefined);
  }, [available, settingsLoaded]);

  const check = useCallback(() => {
    runCheck('manual').catch(() => undefined);
  }, [runCheck]);

  const install = useCallback(() => {
    runInstall('manual').catch(() => undefined);
  }, [runInstall]);

  const binding = useMemo<UpdaterBinding>(
    () => (available ? { available: true, state, check, install } : { available: false, reason: UPDATER_BROWSER_MESSAGE }),
    [available, state, check, install],
  );

  return { binding, state };
}
