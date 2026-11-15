import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, parseSettings } from '../src/features/settings/settings';

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
    const settings = { alwaysOnTop: true, shortcuts: { toggleMain: 'Ctrl+Alt+Z', palette: 'Ctrl+Alt+Y' } };
    expect(mergeSettings({ alwaysOnTop: false }, settings)).toEqual({ alwaysOnTop: true });
    expect(mergeSettings({ shortcuts: { palette: 'Ctrl+Alt+P' } }, settings)).toEqual({
      shortcuts: { palette: 'Ctrl+Alt+P' },
      alwaysOnTop: true,
    });
  });

  it('fichier absent ou illisible : seules les clés de l’interface', () => {
    for (const raw of [undefined, null, 'texte', [1]]) {
      expect(mergeSettings(raw, DEFAULT_SETTINGS)).toEqual({ alwaysOnTop: true });
    }
  });

  it('relecture : ce qui est écrit se relit à l’identique', () => {
    const raw = { alwaysOnTop: true, shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P' } };
    const written = mergeSettings(raw, { ...parseSettings(raw), alwaysOnTop: false });
    expect(parseSettings(written)).toEqual({
      alwaysOnTop: false,
      shortcuts: { toggleMain: 'Ctrl+Alt+M', palette: 'Ctrl+Alt+P' },
    });
  });
});
