import { describe, expect, it } from 'vitest';
import {
  canCheckForUpdate,
  canInstallUpdate,
  describeUpdateState,
  UPDATER_NOT_AVAILABLE,
  type UpdateState,
} from '../src/features/updates/types';

const STATES: UpdateState[] = [
  { status: 'idle' },
  { status: 'checking' },
  { status: 'up-to-date', checkedAt: 0 },
  { status: 'available', version: '9.0.0', notes: '' },
  { status: 'downloading', version: '9.0.0', received: 0, total: null },
  { status: 'ready', version: '9.0.0' },
  { status: 'installing', version: '9.0.0' },
  { status: 'error', message: 'Hors ligne.', retryable: true },
];

describe('UPDATER_NOT_AVAILABLE', () => {
  it('indisponible par défaut, avec la mention attendue', () => {
    expect(UPDATER_NOT_AVAILABLE.available).toBe(false);
    if (!UPDATER_NOT_AVAILABLE.available) {
      expect(UPDATER_NOT_AVAILABLE.reason.toLowerCase()).toContain('disponible dans une prochaine version');
    }
  });
});

describe('canCheckForUpdate / canInstallUpdate', () => {
  it('recherche impossible pendant une opération en cours', () => {
    expect(STATES.filter(canCheckForUpdate).map((s) => s.status)).toEqual(['idle', 'up-to-date', 'available', 'error']);
  });

  it('installation seulement quand une version est trouvée', () => {
    expect(STATES.filter(canInstallUpdate).map((s) => s.status)).toEqual(['available']);
  });
});

describe('describeUpdateState', () => {
  it('rien au repos', () => {
    expect(describeUpdateState({ status: 'idle' }, '1.0.0')).toBeNull();
  });

  it('un message pour chaque autre état', () => {
    for (const s of STATES.filter((x) => x.status !== 'idle')) {
      expect(describeUpdateState(s, '1.0.0')).toBeTruthy();
    }
  });

  it('à jour : version installée citée si connue', () => {
    expect(describeUpdateState({ status: 'up-to-date', checkedAt: 0 }, '1.2.3')).toContain('1.2.3');
    expect(describeUpdateState({ status: 'up-to-date', checkedAt: 0 }, null)).toBe('Vous utilisez la dernière version');
  });

  it('téléchargement : pourcentage borné, absent si la taille est inconnue', () => {
    const d = (received: number, total: number | null) =>
      describeUpdateState({ status: 'downloading', version: '9.0.0', received, total }, null);
    expect(d(50, 200)).toContain('25 %');
    expect(d(300, 200)).toContain('100 %');
    expect(d(-5, 200)).toContain('0 %');
    expect(d(50, null)).not.toContain('%');
    expect(d(50, 0)).not.toContain('%');
  });

  it('prête : version citée, attente du formulaire expliquée', () => {
    const text = describeUpdateState({ status: 'ready', version: '9.0.0' }, null);
    expect(text).toContain('9.0.0');
    expect(text).toContain('formulaire');
  });

  it('erreur : message du moteur tel quel', () => {
    expect(describeUpdateState({ status: 'error', message: 'Hors ligne.', retryable: true }, null)).toBe('Hors ligne.');
  });
});
