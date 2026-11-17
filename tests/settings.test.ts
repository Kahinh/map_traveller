import { describe, expect, it } from 'vitest';
import {
  applySettingsPatch,
  DEFAULT_SETTINGS,
  isUpdateMode,
  mergeSettings,
  parseSettings,
  type Settings,
} from '../src/features/settings/settings';

describe('parseSettings', () => {
  it('fichier absent, vide ou illisible → valeurs par défaut', () => {
    for (const input of [undefined, null, '', 'texte', 42, [], [1, 2], {}]) {
      expect(parseSettings(input)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('ancien format { alwaysOnTop } : toujours valide, raccourcis par défaut', () => {
    expect(parseSettings({ alwaysOnTop: false })).toEqual({ ...DEFAULT_SETTINGS, alwaysOnTop: false });
    expect(parseSettings({ alwaysOnTop: true })).toEqual(DEFAULT_SETTINGS);
  });

  it('alwaysOnTop : seul false désactive (comportement historique)', () => {
    expect(parseSettings({ alwaysOnTop: 'non' }).alwaysOnTop).toBe(true);
    expect(parseSettings({ alwaysOnTop: 0 }).alwaysOnTop).toBe(true);
  });

  it('raccourcis : valeurs valides normalisées, invalides ou absentes → défaut clé par clé', () => {
    expect(parseSettings({ shortcuts: { toggleMain: 'alt+ctrl+m', palette: 'Ctrl+Alt+Space' } }).shortcuts).toEqual({
      toggleMain: 'Ctrl+Alt+M',
      palette: 'Ctrl+Alt+Space',
    });
    expect(parseSettings({ shortcuts: { toggleMain: 42, palette: 'Ctrl+Shift+F5' } }).shortcuts).toEqual({
      toggleMain: 'Ctrl+Alt+T',
      palette: 'Ctrl+Shift+F5',
    });
    expect(parseSettings({ shortcuts: { toggleMain: 'T' } }).shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
    expect(parseSettings({ shortcuts: 'Ctrl+Alt+K' }).shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
  });

  it('deux actions sur le même raccourci → les deux reviennent aux valeurs par défaut', () => {
    expect(parseSettings({ shortcuts: { toggleMain: 'Ctrl+Alt+K', palette: 'alt+ctrl+k' } }).shortcuts).toEqual(
      DEFAULT_SETTINGS.shortcuts,
    );
  });

  it('ne modifie pas la constante par défaut', () => {
    const parsed = parseSettings({});
    parsed.shortcuts.palette = 'Ctrl+Alt+X';
    expect(DEFAULT_SETTINGS.shortcuts.palette).toBe('Ctrl+Alt+Space');
  });
});

describe('mergeSettings', () => {
  it('conserve les clés inconnues et les raccourcis du fichier, remplace alwaysOnTop', () => {
    const raw = {
      alwaysOnTop: true,
      updates: { mode: 'manual' },
      futur: [1, 2],
      shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P', autre: 'x' },
    };
    const merged = mergeSettings(raw, { ...DEFAULT_SETTINGS, alwaysOnTop: false });
    expect(merged).toEqual({ ...raw, alwaysOnTop: false, tray: { minimizeToTray: true }, palette: { defaultVariant: 'withoutZaap' } });
    // L'objet lu n'est pas modifié.
    expect(raw.alwaysOnTop).toBe(true);
  });

  it("n'écrit jamais les raccourcis connus de l'interface (ils appartiennent à Rust)", () => {
    const settings: Settings = {
      alwaysOnTop: true,
      updates: { mode: 'manual' },
      tray: { minimizeToTray: true },
      palette: { defaultVariant: 'withoutZaap' },
      shortcuts: { toggleMain: 'Ctrl+Alt+Z', palette: 'Ctrl+Alt+Y' },
    };
    expect(mergeSettings({ alwaysOnTop: false }, settings)).toEqual({
      alwaysOnTop: true,
      updates: { mode: 'manual' },
      tray: { minimizeToTray: true },
      palette: { defaultVariant: 'withoutZaap' },
    });
    expect(mergeSettings({ shortcuts: { palette: 'Ctrl+Alt+P' } }, settings)).toEqual({
      shortcuts: { palette: 'Ctrl+Alt+P' },
      alwaysOnTop: true,
      updates: { mode: 'manual' },
      tray: { minimizeToTray: true },
      palette: { defaultVariant: 'withoutZaap' },
    });
  });

  it('fichier absent ou illisible : seules les clés de l’interface', () => {
    for (const raw of [undefined, null, 'texte', [1]]) {
      expect(mergeSettings(raw, DEFAULT_SETTINGS)).toEqual({
        alwaysOnTop: true,
        updates: { mode: 'manual' },
        tray: { minimizeToTray: true },
        palette: { defaultVariant: 'withoutZaap' },
      });
    }
  });

  it('relecture : ce qui est écrit se relit à l’identique', () => {
    const raw = { alwaysOnTop: true, shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P' } };
    const written = mergeSettings(raw, { ...parseSettings(raw), alwaysOnTop: false });
    expect(parseSettings(written)).toEqual({
      alwaysOnTop: false,
      updates: { mode: 'manual' },
      tray: { minimizeToTray: true },
      palette: { defaultVariant: 'withoutZaap' },
      shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P' },
    });
  });
});

describe('réglages des mises à jour', () => {
  it('manuel par défaut : aucune connexion sans choix explicite', () => {
    expect(DEFAULT_SETTINGS.updates).toEqual({ mode: 'manual' });
    expect(parseSettings({}).updates.mode).toBe('manual');
    // Fichier d'une version antérieure, sans la clé.
    expect(parseSettings({ alwaysOnTop: false }).updates.mode).toBe('manual');
  });

  it('mode valide lu tel quel', () => {
    expect(parseSettings({ updates: { mode: 'auto' } }).updates.mode).toBe('auto');
    expect(parseSettings({ updates: { mode: 'manual' } }).updates.mode).toBe('manual');
  });

  it('mode absent ou invalide → manuel, sans erreur', () => {
    const invalid = [null, 'auto', 42, [], {}, { mode: 'AUTO' }, { mode: 'automatique' }, { mode: true }, { mode: null }];
    for (const updates of invalid) {
      expect(parseSettings({ updates }).updates.mode).toBe('manual');
    }
  });

  it('isUpdateMode', () => {
    expect(isUpdateMode('manual')).toBe(true);
    expect(isUpdateMode('auto')).toBe(true);
    expect(isUpdateMode('Auto')).toBe(false);
    expect(isUpdateMode(undefined)).toBe(false);
  });

  it('ne modifie pas la constante par défaut', () => {
    const parsed = parseSettings({});
    parsed.updates.mode = 'auto';
    expect(DEFAULT_SETTINGS.updates.mode).toBe('manual');
  });

  it('mergeSettings conserve les champs inconnus DANS updates et ne remplace que mode', () => {
    const raw = {
      alwaysOnTop: true,
      updates: { mode: 'manual', lastCheckedAt: 1700000000000, lastSeenVersion: '9.9.9', futur: { a: 1 } },
    };
    const merged = mergeSettings(raw, { ...DEFAULT_SETTINGS, updates: { mode: 'auto' } });
    expect(merged.updates).toEqual({
      mode: 'auto',
      lastCheckedAt: 1700000000000,
      lastSeenVersion: '9.9.9',
      futur: { a: 1 },
    });
    // L'objet lu n'est pas modifié.
    expect(raw.updates.mode).toBe('manual');
  });

  it('mergeSettings remplace un updates invalide du fichier par un objet propre', () => {
    for (const updates of ['auto', 3, null, [1]]) {
      expect(mergeSettings({ updates }, DEFAULT_SETTINGS).updates).toEqual({ mode: 'manual' });
    }
  });

  it('relecture : un mode écrit se relit à l’identique', () => {
    const next = applySettingsPatch(DEFAULT_SETTINGS, { updates: { mode: 'auto' } });
    const written = mergeSettings({ updates: { futur: 1 } }, next);
    expect(parseSettings(written).updates.mode).toBe('auto');
    expect(written.updates).toEqual({ futur: 1, mode: 'auto' });
  });
});

describe('réglages du moteur de mise à jour (lastCheckedAt, lastSeenVersion, lastAutoInstallVersion)', () => {
  it('absents (ancien fichier) : non définis, sans erreur', () => {
    const u = parseSettings({ updates: { mode: 'auto' } }).updates;
    expect(u).toEqual({ mode: 'auto' });
    expect('lastCheckedAt' in u).toBe(false);
    expect('lastSeenVersion' in u).toBe(false);
    expect(parseSettings({ alwaysOnTop: false }).updates).toEqual({ mode: 'manual' });
  });

  it('valeurs valides lues telles quelles', () => {
    expect(
      parseSettings({ updates: { mode: 'auto', lastCheckedAt: 1700000000000, lastSeenVersion: '9.0.0', lastAutoInstallVersion: '9.0.1' } })
        .updates,
    ).toEqual({ mode: 'auto', lastCheckedAt: 1700000000000, lastSeenVersion: '9.0.0', lastAutoInstallVersion: '9.0.1' });
  });

  it('valeurs invalides ignorées champ par champ, le mode reste lu', () => {
    for (const lastCheckedAt of ['1700000000000', -1, 1.5, Number.NaN, null, {}, 2 ** 60]) {
      expect(parseSettings({ updates: { mode: 'auto', lastCheckedAt } }).updates).toEqual({ mode: 'auto' });
    }
    for (const version of ['', 9, null, ['9.0.0'], 'a b', 'x'.repeat(65), '9.0.0\n']) {
      expect(parseSettings({ updates: { lastSeenVersion: version, lastAutoInstallVersion: version } }).updates).toEqual({
        mode: 'manual',
      });
    }
  });

  it('applySettingsPatch : change un champ sans toucher aux autres ; undefined ne remplace rien', () => {
    const base: Settings = { ...DEFAULT_SETTINGS, updates: { mode: 'auto', lastSeenVersion: '9.0.0' } };
    expect(applySettingsPatch(base, { updates: { lastCheckedAt: 5 } }).updates).toEqual({
      mode: 'auto',
      lastSeenVersion: '9.0.0',
      lastCheckedAt: 5,
    });
    expect(applySettingsPatch(base, { updates: { lastSeenVersion: undefined, mode: undefined } }).updates).toEqual(base.updates);
    expect(base.updates).toEqual({ mode: 'auto', lastSeenVersion: '9.0.0' });
  });

  it('mergeSettings : écrit les champs définis, conserve les inconnus et un champ connu non défini', () => {
    const raw = { updates: { mode: 'manual', futur: 1, lastSeenVersion: '8.0.0', lastCheckedAt: 'illisible' } };
    const settings: Settings = { ...DEFAULT_SETTINGS, updates: { mode: 'auto', lastCheckedAt: 7 } };
    expect(mergeSettings(raw, settings).updates).toEqual({
      mode: 'auto',
      futur: 1,
      lastSeenVersion: '8.0.0',
      lastCheckedAt: 7,
    });
    expect(raw.updates.lastCheckedAt).toBe('illisible');
  });

  it('relecture : ce qui est écrit se relit à l’identique', () => {
    const next = applySettingsPatch(DEFAULT_SETTINGS, {
      updates: { lastCheckedAt: 1700000000000, lastSeenVersion: '9.0.0', lastAutoInstallVersion: '9.0.1' },
    });
    expect(parseSettings(mergeSettings({ updates: { futur: true } }, next)).updates).toEqual(next.updates);
  });
});

describe('applySettingsPatch', () => {
  const base: Settings = {
    alwaysOnTop: true,
    updates: { mode: 'manual' },
    tray: { minimizeToTray: true },
    palette: { defaultVariant: 'withoutZaap' },
    shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P' },
  };

  it('change un seul réglage sans toucher aux autres', () => {
    expect(applySettingsPatch(base, { alwaysOnTop: false })).toEqual({ ...base, alwaysOnTop: false });
    expect(applySettingsPatch(base, { updates: { mode: 'auto' } })).toEqual({ ...base, updates: { mode: 'auto' } });
  });

  it('patch vide ou valeurs undefined : rien ne change', () => {
    expect(applySettingsPatch(base, {})).toEqual(base);
    expect(applySettingsPatch(base, { alwaysOnTop: undefined, updates: {} })).toEqual(base);
    expect(applySettingsPatch(base, { updates: { mode: undefined } })).toEqual(base);
  });

  it('nouvel objet, entrée intacte, raccourcis jamais modifiés', () => {
    const next = applySettingsPatch(base, { alwaysOnTop: false, updates: { mode: 'auto' } });
    expect(next).not.toBe(base);
    expect(next.updates).not.toBe(base.updates);
    expect(next.tray).not.toBe(base.tray);
    expect(base).toEqual({
      alwaysOnTop: true,
      updates: { mode: 'manual' },
      tray: { minimizeToTray: true },
      palette: { defaultVariant: 'withoutZaap' },
      shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P' },
    });
    expect(next.shortcuts).toEqual(base.shortcuts);
  });
});

describe('réglage de la zone de notification (tray.minimizeToTray)', () => {
  it('activé par défaut : fichier, clé ou objet absent', () => {
    expect(DEFAULT_SETTINGS.tray).toEqual({ minimizeToTray: true });
    expect(parseSettings({}).tray).toEqual({ minimizeToTray: true });
    expect(parseSettings({ tray: {} }).tray).toEqual({ minimizeToTray: true });
  });

  it('lecture tolérante : seul un booléen est lu, sinon activé (même règle que Rust)', () => {
    expect(parseSettings({ tray: { minimizeToTray: false } }).tray.minimizeToTray).toBe(false);
    expect(parseSettings({ tray: { minimizeToTray: true } }).tray.minimizeToTray).toBe(true);
    for (const value of ['false', 0, null, [], {}]) {
      expect(parseSettings({ tray: { minimizeToTray: value } }).tray.minimizeToTray).toBe(true);
    }
    for (const tray of ['non', 42, null, [false]]) {
      expect(parseSettings({ tray }).tray.minimizeToTray).toBe(true);
    }
  });

  it('applySettingsPatch : change le réglage sans toucher aux autres ; undefined ne remplace rien', () => {
    const next = applySettingsPatch(DEFAULT_SETTINGS, { tray: { minimizeToTray: false } });
    expect(next).toEqual({ ...DEFAULT_SETTINGS, tray: { minimizeToTray: false } });
    expect(DEFAULT_SETTINGS.tray.minimizeToTray).toBe(true);
    expect(applySettingsPatch(next, { tray: {} })).toEqual(next);
    expect(applySettingsPatch(next, { tray: { minimizeToTray: undefined } })).toEqual(next);
    expect(applySettingsPatch(next, { alwaysOnTop: false }).tray).toEqual({ minimizeToTray: false });
  });

  it('mergeSettings conserve les clés inconnues DANS tray et ne remplace que minimizeToTray', () => {
    const raw = { tray: { minimizeToTray: true, futur: 'x' }, shortcuts: { palette: 'Ctrl+Alt+P' } };
    const settings = applySettingsPatch(parseSettings(raw), { tray: { minimizeToTray: false } });
    expect(mergeSettings(raw, settings).tray).toEqual({ minimizeToTray: false, futur: 'x' });
    expect(mergeSettings(raw, settings).shortcuts).toEqual({ palette: 'Ctrl+Alt+P' });
    expect(raw.tray.minimizeToTray).toBe(true);
  });

  it('mergeSettings remplace un tray invalide du fichier par un objet propre', () => {
    expect(mergeSettings({ tray: 'cassé' }, DEFAULT_SETTINGS).tray).toEqual({ minimizeToTray: true });
  });

  it('relecture : ce qui est écrit se relit à l’identique', () => {
    const next = applySettingsPatch(DEFAULT_SETTINGS, { tray: { minimizeToTray: false } });
    expect(parseSettings(mergeSettings({ tray: { futur: 1 } }, next)).tray).toEqual(next.tray);
  });
});

describe('réglage de la palette (issue n°11)', () => {
  it('variante par défaut : sans Zaap si absente ou invalide', () => {
    expect(DEFAULT_SETTINGS.palette.defaultVariant).toBe('withoutZaap');
    expect(parseSettings({}).palette.defaultVariant).toBe('withoutZaap');
    for (const value of [null, 'avec', 1, true, {}]) {
      expect(parseSettings({ palette: { defaultVariant: value } }).palette.defaultVariant).toBe('withoutZaap');
    }
    expect(parseSettings({ palette: 'x' }).palette.defaultVariant).toBe('withoutZaap');
    expect(parseSettings({ palette: { defaultVariant: 'withZaap' } }).palette.defaultVariant).toBe('withZaap');
  });

  it('un ancien fichier reste valide, sans la clé', () => {
    expect(parseSettings({ alwaysOnTop: false, updates: { mode: 'auto' } }).palette).toEqual({
      defaultVariant: 'withoutZaap',
    });
  });

  it('écriture : clés inconnues de « palette » conservées, relecture à l’identique', () => {
    const raw = { palette: { defaultVariant: 'withoutZaap', futur: 3 }, shortcuts: { palette: 'Ctrl+Alt+P' } };
    const next = applySettingsPatch(parseSettings(raw), { palette: { defaultVariant: 'withZaap' } });
    const written = mergeSettings(raw, next);
    expect(written.palette).toEqual({ defaultVariant: 'withZaap', futur: 3 });
    expect(written.shortcuts).toEqual(raw.shortcuts);
    expect(parseSettings(written).palette.defaultVariant).toBe('withZaap');
    expect(raw.palette.defaultVariant).toBe('withoutZaap');
  });

  it('patch sans palette : réglage inchangé', () => {
    const s = applySettingsPatch(DEFAULT_SETTINGS, { palette: { defaultVariant: 'withZaap' } });
    expect(applySettingsPatch(s, { alwaysOnTop: false }).palette.defaultVariant).toBe('withZaap');
    expect(applySettingsPatch(s, { palette: {} }).palette.defaultVariant).toBe('withZaap');
  });
});
