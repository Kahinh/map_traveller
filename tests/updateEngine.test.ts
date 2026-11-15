import { describe, expect, it } from 'vitest';
import type { UpdateState } from '../src/features/updates/types';
import {
  describeUpdateError,
  installedUpdateMessage,
  installedUpdateNotice,
  isVisibleUpdateChange,
  shouldAutoInstall,
  shouldCheckOnStartup,
  STARTUP_CHECK_MIN_INTERVAL_MS,
  UPDATE_ERROR_MESSAGES,
  updateReducer,
  UpdateTimeoutError,
  type UpdateEvent,
} from '../src/features/updates/updates';

const V = '9.0.0';

const S = {
  idle: { status: 'idle' },
  checking: { status: 'checking' },
  upToDate: { status: 'up-to-date', checkedAt: 1 },
  available: { status: 'available', version: V, notes: 'Notes.' },
  downloading: { status: 'downloading', version: V, received: 10, total: 100 },
  ready: { status: 'ready', version: V },
  installing: { status: 'installing', version: V },
  error: { status: 'error', message: 'Hors ligne.', retryable: true },
} satisfies Record<string, UpdateState>;

const ALL_STATES: UpdateState[] = Object.values(S);

const ALL_EVENTS: UpdateEvent[] = [
  { type: 'check-started' },
  { type: 'check-found', version: V, notes: '' },
  { type: 'check-none', at: 5 },
  { type: 'download-started', version: V },
  { type: 'download-length', total: 200 },
  { type: 'download-chunk', bytes: 5 },
  { type: 'downloaded' },
  { type: 'install-started' },
  { type: 'failed', message: 'x', retryable: false },
];

describe('updateReducer : chemin nominal', () => {
  it('recherche → disponible → téléchargement → prête → installation', () => {
    let s: UpdateState = S.idle;
    s = updateReducer(s, { type: 'check-started' });
    expect(s).toEqual({ status: 'checking' });
    s = updateReducer(s, { type: 'check-found', version: V, notes: 'Correctifs.' });
    expect(s).toEqual({ status: 'available', version: V, notes: 'Correctifs.' });
    s = updateReducer(s, { type: 'download-started', version: V });
    expect(s).toEqual({ status: 'downloading', version: V, received: 0, total: null });
    s = updateReducer(s, { type: 'download-length', total: 1000 });
    s = updateReducer(s, { type: 'download-chunk', bytes: 300 });
    s = updateReducer(s, { type: 'download-chunk', bytes: 200 });
    expect(s).toEqual({ status: 'downloading', version: V, received: 500, total: 1000 });
    s = updateReducer(s, { type: 'downloaded' });
    expect(s).toEqual({ status: 'ready', version: V });
    s = updateReducer(s, { type: 'install-started' });
    expect(s).toEqual({ status: 'installing', version: V });
  });

  it('recherche sans nouveauté → à jour, avec la date', () => {
    expect(updateReducer(S.checking, { type: 'check-none', at: 42 })).toEqual({ status: 'up-to-date', checkedAt: 42 });
  });

  it('nouvelle recherche possible depuis repos, à jour, disponible et erreur', () => {
    for (const s of [S.idle, S.upToDate, S.available, S.error]) {
      expect(updateReducer(s, { type: 'check-started' })).toEqual({ status: 'checking' });
    }
  });

  it('échec pendant une opération → erreur, avec message et caractère réessayable', () => {
    for (const s of [S.checking, S.downloading, S.ready, S.installing]) {
      expect(updateReducer(s, { type: 'failed', message: 'Oups.', retryable: false })).toEqual({
        status: 'error',
        message: 'Oups.',
        retryable: false,
      });
    }
  });
});

describe('updateReducer : évènements inattendus', () => {
  it('ne lève jamais, quel que soit le couple état / évènement', () => {
    for (const s of ALL_STATES) {
      for (const e of ALL_EVENTS) {
        expect(() => updateReducer(s, e)).not.toThrow();
      }
    }
  });

  it('un évènement hors de propos renvoie le MÊME état', () => {
    const ignored: [UpdateState, UpdateEvent][] = [
      [S.checking, { type: 'check-started' }],
      [S.downloading, { type: 'check-started' }],
      [S.ready, { type: 'check-started' }],
      [S.installing, { type: 'check-started' }],
      [S.idle, { type: 'check-found', version: V, notes: '' }],
      [S.available, { type: 'check-none', at: 1 }],
      [S.idle, { type: 'download-started', version: V }],
      [S.checking, { type: 'download-started', version: V }],
      [S.downloading, { type: 'download-started', version: V }],
      [S.idle, { type: 'download-chunk', bytes: 10 }],
      [S.available, { type: 'download-length', total: 10 }],
      [S.available, { type: 'downloaded' }],
      [S.available, { type: 'install-started' }],
      [S.downloading, { type: 'install-started' }],
      [S.idle, { type: 'failed', message: 'x', retryable: true }],
      [S.upToDate, { type: 'failed', message: 'x', retryable: true }],
      [S.available, { type: 'failed', message: 'x', retryable: true }],
      [S.error, { type: 'failed', message: 'autre', retryable: false }],
    ];
    for (const [s, e] of ignored) expect(updateReducer(s, e)).toBe(s);
  });

  it('téléchargement d’une autre version que celle proposée : ignoré', () => {
    expect(updateReducer(S.available, { type: 'download-started', version: '8.0.0' })).toBe(S.available);
  });

  it('progression : taille et morceaux invalides sans effet nuisible', () => {
    expect(updateReducer(S.downloading, { type: 'download-length', total: null })).toMatchObject({ total: null });
    expect(updateReducer(S.downloading, { type: 'download-length', total: 0 })).toMatchObject({ total: null });
    expect(updateReducer(S.downloading, { type: 'download-length', total: -5 })).toMatchObject({ total: null });
    expect(updateReducer(S.downloading, { type: 'download-length', total: Number.NaN })).toMatchObject({ total: null });
    for (const bytes of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(updateReducer(S.downloading, { type: 'download-chunk', bytes })).toBe(S.downloading);
    }
  });

  it('ne modifie pas l’état reçu', () => {
    const s: UpdateState = { status: 'downloading', version: V, received: 1, total: 10 };
    updateReducer(s, { type: 'download-chunk', bytes: 4 });
    expect(s).toEqual({ status: 'downloading', version: V, received: 1, total: 10 });
  });
});

describe('isVisibleUpdateChange', () => {
  const d = (received: number, total: number | null): UpdateState => ({ status: 'downloading', version: V, received, total });

  it('changement de statut : toujours visible', () => {
    expect(isVisibleUpdateChange(S.checking, S.available)).toBe(true);
    expect(isVisibleUpdateChange(d(100, 100), S.ready)).toBe(true);
  });

  it('même pourcentage entier : pas de rendu ; pourcentage suivant : rendu', () => {
    expect(isVisibleUpdateChange(d(1000, 100_000), d(1500, 100_000))).toBe(false);
    expect(isVisibleUpdateChange(d(1500, 100_000), d(2000, 100_000))).toBe(true);
  });

  it('taille annoncée qui change : visible ; taille inconnue : par tranche de 256 Kio', () => {
    expect(isVisibleUpdateChange(d(0, null), d(0, 100))).toBe(true);
    expect(isVisibleUpdateChange(d(0, null), d(1000, null))).toBe(false);
    expect(isVisibleUpdateChange(d(0, null), d(300 * 1024, null))).toBe(true);
  });

  it('même objet : rien à afficher', () => {
    expect(isVisibleUpdateChange(S.idle, S.idle)).toBe(false);
  });
});

describe('describeUpdateError', () => {
  it('délai dépassé (moteur ou plugin)', () => {
    expect(describeUpdateError(new UpdateTimeoutError())).toEqual({ message: UPDATE_ERROR_MESSAGES.timeout, retryable: true });
    expect(describeUpdateError('error sending request for url (https://x.invalid/latest.json): operation timed out')).toEqual({
      message: UPDATE_ERROR_MESSAGES.timeout,
      retryable: true,
    });
  });

  it('hors ligne', () => {
    for (const raw of [
      'error sending request for url (https://x.invalid/latest.json)',
      'dns error: failed to lookup address information',
      'tcp connect error: Connection refused (os error 10061)',
    ]) {
      expect(describeUpdateError(raw)).toEqual({ message: UPDATE_ERROR_MESSAGES.offline, retryable: true });
    }
  });

  it('GitHub indisponible ou index introuvable', () => {
    for (const raw of [
      'Could not fetch a valid release JSON from the remote',
      '`Download request failed with status: 503 Service Unavailable`',
      'the platform `windows-x86_64` was not found in the response `platforms` object',
    ]) {
      expect(describeUpdateError(raw)).toEqual({ message: UPDATE_ERROR_MESSAGES.unavailable, retryable: true });
    }
  });

  it('signature refusée : jamais réessayable, jamais confondue avec le réseau', () => {
    for (const raw of [
      'The signature verification failed',
      'The signature was created with a different key than the one provided',
      'Invalid encoding in minisign data',
      'The update was signed for version 1.0.0 but the update endpoint announced version 2.0.0.',
    ]) {
      expect(describeUpdateError(raw)).toEqual({ message: UPDATE_ERROR_MESSAGES.signature, retryable: false });
    }
  });

  it('erreur inconnue : message générique avec le détail, réessayable', () => {
    const r = describeUpdateError(new Error('Quelque chose d’imprévu'));
    expect(r.retryable).toBe(true);
    expect(r.message).toContain('Quelque chose d’imprévu');
    expect(describeUpdateError({ message: 'objet' }).message).toContain('objet');
    expect(describeUpdateError(undefined).message).toContain('La mise à jour a échoué');
    expect(describeUpdateError('').message).toBe('La mise à jour a échoué.');
  });

  it('détail long tronqué, jamais d’exception sur une valeur exotique', () => {
    expect(describeUpdateError('x'.repeat(1000)).message.length).toBeLessThan(220);
    const hostile = {
      toString() {
        throw new Error('non');
      },
    };
    expect(() => describeUpdateError(hostile)).not.toThrow();
    expect(() => describeUpdateError(Symbol('s'))).not.toThrow();
  });
});

describe('shouldCheckOnStartup', () => {
  const now = 10_000_000_000;

  it('manuel : jamais, quelle que soit la date', () => {
    expect(shouldCheckOnStartup('manual', undefined, now)).toBe(false);
    expect(shouldCheckOnStartup('manual', 0, now)).toBe(false);
  });

  it('automatique : oui au lancement', () => {
    expect(shouldCheckOnStartup('auto', undefined, now)).toBe(true);
    expect(shouldCheckOnStartup('auto', now - STARTUP_CHECK_MIN_INTERVAL_MS, now)).toBe(true);
    expect(shouldCheckOnStartup('auto', now - 86_400_000, now)).toBe(true);
  });

  it('automatique : pas deux fois en moins de l’intervalle minimal (boucle de redémarrages)', () => {
    expect(shouldCheckOnStartup('auto', now - 1000, now)).toBe(false);
  });

  it('date dans le futur ou invalide : vérification quand même', () => {
    expect(shouldCheckOnStartup('auto', now + 60_000, now)).toBe(true);
    expect(shouldCheckOnStartup('auto', Number.NaN, now)).toBe(true);
  });
});

describe('shouldAutoInstall', () => {
  it('oui pour une version jamais tentée automatiquement', () => {
    expect(shouldAutoInstall('9.0.0', undefined)).toBe(true);
    expect(shouldAutoInstall('9.0.1', '9.0.0')).toBe(true);
  });

  it('non si cette version a déjà été lancée automatiquement sans succès', () => {
    expect(shouldAutoInstall('9.0.0', '9.0.0')).toBe(false);
  });
});

describe('installedUpdateNotice', () => {
  it('annonce la version courante si elle diffère de la dernière vue', () => {
    expect(installedUpdateNotice('9.0.1', '9.0.0')).toBe('9.0.1');
    expect(installedUpdateMessage('9.0.1')).toBe('Mise à jour 9.0.1 installée.');
  });

  it('rien au premier lancement, à version égale ou version inconnue', () => {
    expect(installedUpdateNotice('9.0.1', undefined)).toBeNull();
    expect(installedUpdateNotice('9.0.1', '9.0.1')).toBeNull();
    expect(installedUpdateNotice(null, '9.0.0')).toBeNull();
  });
});
