import { describe, expect, it } from 'vitest';
import { textFingerprint } from '../src/features/palette/fingerprint';
import { heightToSend, PALETTE_BAR_HEIGHT } from '../src/features/palette/windowHeight';
import { parsePaletteSettings } from '../src/features/settings/paletteSettings';
import { parseSettings } from '../src/features/settings/settings';

describe('hauteur de la fenêtre palette', () => {
  it('même hauteur que la fenêtre : rien à envoyer', () => {
    expect(heightToSend(PALETTE_BAR_HEIGHT, PALETTE_BAR_HEIGHT)).toBeNull();
    expect(heightToSend(200, 200)).toBeNull();
  });

  it('hauteur différente ou inconnue : envoyée', () => {
    expect(heightToSend(200, PALETTE_BAR_HEIGHT)).toBe(200);
    expect(heightToSend(PALETTE_BAR_HEIGHT, 200)).toBe(PALETTE_BAR_HEIGHT);
    expect(heightToSend(PALETTE_BAR_HEIGHT, null)).toBe(PALETTE_BAR_HEIGHT);
  });

  it('mesure impossible : rien à envoyer', () => {
    expect(heightToSend(undefined, null)).toBeNull();
    expect(heightToSend(0, null)).toBeNull();
    expect(heightToSend(Number.NaN, 48)).toBeNull();
  });

  it('cycle masquage puis affichage : un seul envoi, fenêtre masquée ; aucun à l\'affichage', () => {
    // Ouverte avec des résultats (fenêtre à 300), puis masquée : remise à zéro, hauteur inconnue.
    let known: number | null = 300;
    const sent: number[] = [];
    const render = (measured: number) => {
      const h = heightToSend(measured, known);
      if (h !== null) {
        known = h;
        sent.push(h);
      }
    };
    known = null; // palette:hidden
    render(PALETTE_BAR_HEIGHT); // rendu de la barre seule, fenêtre masquée
    known = PALETTE_BAR_HEIGHT; // palette:shown : Rust a déjà réduit la fenêtre à la barre
    render(PALETTE_BAR_HEIGHT); // mesure à l'affichage : rien
    expect(sent).toEqual([PALETTE_BAR_HEIGHT]);
    render(250); // première frappe : un envoi
    render(250); // frappe suivante, même hauteur : rien
    expect(sent).toEqual([PALETTE_BAR_HEIGHT, 250]);
  });
});

describe('empreinte des fichiers relus par la palette', () => {
  it('FNV-1a 32 bits et longueur', () => {
    expect(textFingerprint('')).toBe('0:811c9dc5');
    expect(textFingerprint('a')).toBe('1:e40c292c');
  });

  it('fichier absent distinct du texte vide ; un caractère changé change l\'empreinte', () => {
    expect(textFingerprint(null)).not.toBe(textFingerprint(''));
    const text = JSON.stringify({ destinations: [{ id: 'a', command: '/travel 1 1' }] });
    expect(textFingerprint(text)).toBe(textFingerprint(`${text}`));
    expect(textFingerprint(text.replace('1 1', '1 2'))).not.toBe(textFingerprint(text));
  });
});

describe('réglage de la palette lu seul', () => {
  it('valeur valide, sinon défaut ; même résultat que le modèle complet', () => {
    const cases: unknown[] = [
      undefined,
      null,
      [],
      { palette: 'x' },
      { palette: { defaultVariant: 'withZaap', futur: 1 } },
      { palette: { defaultVariant: 'zaapOnly' } },
      { shortcuts: { palette: 'Ctrl+Alt+P' }, palette: { defaultVariant: 'withoutZaap' } },
    ];
    for (const input of cases) {
      expect(parsePaletteSettings(input)).toEqual(parseSettings(input).palette);
    }
    expect(parsePaletteSettings({ palette: { defaultVariant: 'withZaap' } })).toEqual({ defaultVariant: 'withZaap' });
    expect(parsePaletteSettings({ palette: { defaultVariant: 'zaapOnly' } })).toEqual({ defaultVariant: 'withoutZaap' });
  });
});
