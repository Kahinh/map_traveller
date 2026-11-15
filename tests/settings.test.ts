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
    expect(merged).toEqual({ ...raw, alwaysOnTop: false });
    // L'objet lu n'est pas modifié.
    expect(raw.alwaysOnTop).toBe(true);
  });

  it("n'écrit jamais les raccourcis connus de l'interface (ils appartiennent à Rust)", () => {
    const settings: Settings = {
      alwaysOnTop: true,
      updates: { mode: 'manual' },
      shortcuts: { toggleMain: 'Ctrl+Alt+Z', palette: 'Ctrl+Alt+Y' },
    };
    expect(mergeSettings({ alwaysOnTop: false }, settings)).toEqual({ alwaysOnTop: true, updates: { mode: 'manual' } });
    expect(mergeSettings({ shortcuts: { palette: 'Ctrl+Alt+P' } }, settings)).toEqual({
      shortcuts: { palette: 'Ctrl+Alt+P' },
      alwaysOnTop: true,
      updates: { mode: 'manual' },
    });
  });

  it('fichier absent ou illisible : seules les clés de l’interface', () => {
    for (const raw of [undefined, null, 'texte', [1]]) {
      expect(mergeSettings(raw, DEFAULT_SETTINGS)).toEqual({ alwaysOnTop: true, updates: { mode: 'manual' } });
    }
  });

  it('relecture : ce qui est écrit se relit à l’identique', () => {
    const raw = { alwaysOnTop: true, shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P' } };
    const written = mergeSettings(raw, { ...parseSettings(raw), alwaysOnTop: false });
    expect(parseSettings(written)).toEqual({
      alwaysOnTop: false,
      updates: { mode: 'manual' },
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

describe('applySettingsPatch', () => {
  const base: Settings = {
    alwaysOnTop: true,
    updates: { mode: 'manual' },
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
    expect(base).toEqual({
      alwaysOnTop: true,
      updates: { mode: 'manual' },
      shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P' },
    });
    expect(next.shortcuts).toEqual(base.shortcuts);
  });
});
