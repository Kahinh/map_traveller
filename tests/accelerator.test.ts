import { describe, expect, it } from 'vitest';
import {
  captureAccelerator,
  defaultShortcutsState,
  DEFAULT_SHORTCUTS,
  acceleratorKeys,
  formatAccelerator,
  normalizeAccelerator,
  parseShortcutsState,
  type KeyLike,
} from '../src/features/settings/accelerator';

/** Événement clavier minimal : touche principale par son code de touche virtuelle. */
function key(keyName: string, keyCode: number, mods: Partial<KeyLike> = {}, code = ''): KeyLike {
  return { key: keyName, keyCode, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods };
}

const CTRL_ALT = { ctrlKey: true, altKey: true };

describe('normalizeAccelerator', () => {
  it('normalise ordre, casse et espaces', () => {
    expect(normalizeAccelerator(' alt + ctrl + t ')).toBe('Ctrl+Alt+T');
    expect(normalizeAccelerator('Control+Alt+space')).toBe('Ctrl+Alt+Space');
    expect(normalizeAccelerator('Shift+Ctrl+f12')).toBe('Ctrl+Shift+F12');
    expect(normalizeAccelerator('Alt+7')).toBe('Alt+7');
  });

  it('les valeurs par défaut sont valides et déjà normalisées', () => {
    expect(normalizeAccelerator(DEFAULT_SHORTCUTS.toggleMain)).toBe(DEFAULT_SHORTCUTS.toggleMain);
    expect(normalizeAccelerator(DEFAULT_SHORTCUTS.palette)).toBe(DEFAULT_SHORTCUTS.palette);
  });

  it('refuse les chaînes invalides (mêmes cas que Rust)', () => {
    for (const input of [
      '',
      '   ',
      'T',
      'Shift+T',
      'Ctrl+Alt',
      'Ctrl+',
      'Ctrl++T',
      'Ctrl+Alt+T+U',
      'Ctrl+Alt+F13',
      'Ctrl+Alt+Enter',
      'Ctrl+Alt+é',
      'Super+T',
      'Ctrl+Win+T',
      'Ctrl+Alt+TT',
      42,
      null,
      undefined,
    ]) {
      expect(normalizeAccelerator(input), String(input)).toBeNull();
    }
  });
});

describe('captureAccelerator', () => {
  it('Ctrl ou Alt + lettre, chiffre, F1–F12, Espace', () => {
    expect(captureAccelerator(key('t', 84, CTRL_ALT))).toEqual({ kind: 'ok', accelerator: 'Ctrl+Alt+T' });
    expect(captureAccelerator(key(' ', 32, CTRL_ALT))).toEqual({ kind: 'ok', accelerator: 'Ctrl+Alt+Space' });
    expect(captureAccelerator(key('F5', 116, { ctrlKey: true, shiftKey: true }))).toEqual({
      kind: 'ok',
      accelerator: 'Ctrl+Shift+F5',
    });
    expect(captureAccelerator(key('&', 49, { altKey: true }))).toEqual({ kind: 'ok', accelerator: 'Alt+1' });
  });

  it('suit la touche virtuelle (disposition du clavier), pas le caractère produit', () => {
    // AZERTY, AltGr+E (= Ctrl+Alt) produit « € » : la touche est bien E.
    expect(captureAccelerator(key('€', 69, CTRL_ALT, 'KeyE'))).toEqual({ kind: 'ok', accelerator: 'Ctrl+Alt+E' });
    // AZERTY, touche marquée A (position physique de Q) : A.
    expect(captureAccelerator(key('a', 65, CTRL_ALT, 'KeyQ'))).toEqual({ kind: 'ok', accelerator: 'Ctrl+Alt+A' });
  });

  it('sans code de touche virtuelle : repli sur la position physique', () => {
    expect(captureAccelerator(key('x', 0, CTRL_ALT, 'KeyK'))).toEqual({ kind: 'ok', accelerator: 'Ctrl+Alt+K' });
    expect(captureAccelerator(key('x', 0, CTRL_ALT, 'Digit3'))).toEqual({ kind: 'ok', accelerator: 'Ctrl+Alt+3' });
    expect(captureAccelerator(key('x', 0, CTRL_ALT, 'F9'))).toEqual({ kind: 'ok', accelerator: 'Ctrl+Alt+F9' });
    expect(captureAccelerator(key('x', 0, CTRL_ALT, 'Space'))).toEqual({ kind: 'ok', accelerator: 'Ctrl+Alt+Space' });
    expect(captureAccelerator(key('x', 0, CTRL_ALT, 'Numpad1')).kind).toBe('invalid');
  });

  it('touche de modification seule : en attente, jamais acceptée', () => {
    expect(captureAccelerator(key('Control', 17, { ctrlKey: true }))).toEqual({ kind: 'pending' });
    expect(captureAccelerator(key('Alt', 18, CTRL_ALT))).toEqual({ kind: 'pending' });
    expect(captureAccelerator(key('Shift', 16, { ctrlKey: true, shiftKey: true }))).toEqual({ kind: 'pending' });
    expect(captureAccelerator(key('AltGraph', 18, CTRL_ALT))).toEqual({ kind: 'pending' });
  });

  it('exige Ctrl ou Alt', () => {
    expect(captureAccelerator(key('t', 84)).kind).toBe('invalid');
    expect(captureAccelerator(key('T', 84, { shiftKey: true })).kind).toBe('invalid');
    expect(captureAccelerator(key('F5', 116)).kind).toBe('invalid');
  });

  it('Échap annule, touche Windows et touches non prises en charge refusées', () => {
    expect(captureAccelerator(key('Escape', 27))).toEqual({ kind: 'cancel' });
    expect(captureAccelerator(key('Escape', 27, CTRL_ALT))).toEqual({ kind: 'cancel' });
    expect(captureAccelerator(key('Meta', 91, { metaKey: true })).kind).toBe('invalid');
    expect(captureAccelerator(key('t', 84, { ctrlKey: true, metaKey: true })).kind).toBe('invalid');
    expect(captureAccelerator(key('Enter', 13, CTRL_ALT)).kind).toBe('invalid');
    expect(captureAccelerator(key('F13', 124, CTRL_ALT)).kind).toBe('invalid');
    expect(captureAccelerator(key('ArrowUp', 38, CTRL_ALT)).kind).toBe('invalid');
  });

  it('toute combinaison acceptée est valide pour le format commun avec Rust', () => {
    for (let code = 0; code < 256; code++) {
      for (const mods of [CTRL_ALT, { ctrlKey: true }, { altKey: true, shiftKey: true }]) {
        const result = captureAccelerator(key('x', code, mods));
        if (result.kind === 'ok') expect(normalizeAccelerator(result.accelerator)).toBe(result.accelerator);
      }
    }
  });
});

describe('acceleratorKeys', () => {
  it('donne une touche par élément, noms français', () => {
    expect(acceleratorKeys('Ctrl+Shift+Space')).toEqual(['Ctrl', 'Maj', 'Espace']);
    expect(acceleratorKeys('Alt+T')).toEqual(['Alt', 'T']);
  });
});

describe('formatAccelerator', () => {
  it('affichage en français', () => {
    expect(formatAccelerator('Ctrl+Alt+Space')).toBe('Ctrl + Alt + Espace');
    expect(formatAccelerator('Ctrl+Shift+F5')).toBe('Ctrl + Maj + F5');
    expect(formatAccelerator('Alt+T')).toBe('Alt + T');
  });
});

describe('parseShortcutsState', () => {
  it('accepte la réponse de Rust', () => {
    const state = {
      toggleMain: { accelerator: 'Ctrl+Alt+T', registered: true },
      palette: { accelerator: 'Ctrl+Alt+Space', registered: false },
      farmNext: { accelerator: 'Ctrl+Alt+N', registered: true },
    };
    expect(parseShortcutsState(state)).toEqual(state);
  });

  it('refuse une réponse inattendue', () => {
    expect(parseShortcutsState(null)).toBeNull();
    expect(parseShortcutsState({ toggleMain: { accelerator: 'Ctrl+Alt+T', registered: true } })).toBeNull();
    expect(
      parseShortcutsState({
        toggleMain: { accelerator: 'Ctrl+Alt+T', registered: 'oui' },
        palette: { accelerator: 'Ctrl+Alt+Space', registered: true },
      }),
    ).toBeNull();
  });

  it('état hors application : valeurs par défaut, non enregistrées', () => {
    expect(defaultShortcutsState()).toEqual({
      toggleMain: { accelerator: 'Ctrl+Alt+T', registered: false },
      palette: { accelerator: 'Ctrl+Alt+Space', registered: false },
      farmNext: { accelerator: 'Ctrl+Alt+N', registered: false },
    });
  });
});
