// Coordonnées FICTIVES : elles illustrent les règles, ce ne sont pas des trajets réels.
import { describe, expect, it } from 'vitest';
import { farmNextCopy, farmStartCommand, farmStepCommand, isValidFarmRoute, parseFarmRoute } from '../src/features/farm/farmRoute';

const ROUTE = '/travel 1 1;/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6';

describe('parcours Farm (invariant 3)', () => {
  const route = parseFarmRoute(ROUTE);

  it('toutes les positions, dans l\'ordre', () => {
    expect(route.steps.map((s) => s.label)).toEqual(['1,1', '2,2', '3,3', '4,4', '5,5', '6,6']);
    expect(route.steps.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(isValidFarmRoute(route)).toBe(true);
  });

  it('chaque étape copie son seul segment /travel, jamais la suite du parcours', () => {
    expect(route.steps.map((_, i) => farmStepCommand(route, i))).toEqual([
      '/travel 1 1',
      '/travel 2 2',
      '/travel 3 3',
      '/travel 4 4',
      '/travel 5 5',
      '/travel 6 6',
    ]);
  });

  it('dernière étape : son segment, comme les autres', () => {
    expect(farmStepCommand(route, 5)).toBe('/travel 6 6');
  });

  it('indice invalide → rien à copier', () => {
    expect(farmStepCommand(route, -1)).toBeNull();
    expect(farmStepCommand(route, 99)).toBeNull();
    expect(farmStepCommand(route, 1.5)).toBeNull();
  });

  it('coordonnées répétées : chaque occurrence est une étape distincte', () => {
    const r = parseFarmRoute('/travel 1 1;/travel 2 2;/travel 1 1;/travel 3 3');
    expect(r.steps.map((s) => s.label)).toEqual(['1,1', '2,2', '1,1', '3,3']);
    expect(farmStepCommand(r, 0)).toBe('/travel 1 1');
    expect(farmStepCommand(r, 2)).toBe('/travel 1 1');
  });

  it('sans Zaap initial : pas de case « Début »', () => {
    expect(farmStartCommand(route)).toBeNull();
  });

  it('Zaap initial : « Début » copie le Zaap et la première position, tels que saisis', () => {
    const r = parseFarmRoute('/zaap 5 -18; /travel 1 1;/travel 2 2;/travel 3 3');
    expect(r.zaapPrefix).toBe('/zaap 5 -18');
    expect(r.steps.map((s) => s.label)).toEqual(['1,1', '2,2', '3,3']);
    expect(farmStartCommand(r)).toBe('/zaap 5 -18; /travel 1 1');
    expect(farmStepCommand(r, 0)).toBe('/travel 1 1');
    expect(isValidFarmRoute(r)).toBe(true);
  });

  it('Zaap initial suivi d\'un segment non reconnu : copié tel quel jusqu\'à la première position', () => {
    const r = parseFarmRoute('/zaap 9 9;/emote salut;/travel 1 1;/travel 2 2');
    expect(farmStartCommand(r)).toBe('/zaap 9 9;/emote salut;/travel 1 1');
  });

  it('segments originaux conservés (espaces, virgules, négatifs)', () => {
    const r = parseFarmRoute('/travel  -3 7;/travel 4,-2; /travel 0 0 ');
    expect(r.steps.map((s) => s.label)).toEqual(['-3,7', '4,-2', '0,0']);
    expect(farmStepCommand(r, 0)).toBe('/travel  -3 7');
    expect(farmStepCommand(r, 1)).toBe('/travel 4,-2');
    expect(farmStepCommand(r, 2)).toBe('/travel 0 0');
  });

  it('segment non reconnu signalé, jamais supprimé en silence', () => {
    const r = parseFarmRoute('/travel 1 1;/foo bar;/travel 2 2');
    expect(isValidFarmRoute(r)).toBe(false);
    expect(r.issues).toEqual([{ segmentIndex: 1, segment: '/foo bar', reason: 'not-travel' }]);
    expect(r.steps).toHaveLength(2);
  });

  it('segment vide au milieu signalé, ; final toléré', () => {
    expect(parseFarmRoute('/travel 1 1;/travel 2 2;').issues).toEqual([]);
    expect(parseFarmRoute('/travel 1 1;;/travel 2 2').issues[0]?.reason).toBe('empty-segment');
  });

  it('retours à la ligne : le segment est copié sans eux', () => {
    const r = parseFarmRoute('/travel 1 1;\n/travel 2 2;\n/travel 3 3');
    expect(farmStepCommand(r, 1)).toBe('/travel 2 2');
  });

  it('commande vide : aucun parcours', () => {
    const r = parseFarmRoute('');
    expect(r.steps).toEqual([]);
    expect(isValidFarmRoute(r)).toBe(false);
    expect(farmStartCommand(r)).toBeNull();
    expect(farmStepCommand(r, 0)).toBeNull();
  });
});

describe('farmNextCopy (raccourci « position suivante »)', () => {
  const plain = parseFarmRoute('/travel 1 1;/travel 2,2;/travel 3 3');
  const zaap = parseFarmRoute('/zaap 0 0;/travel 1 1;/travel 2 2');

  it('après la position i : la position i + 1, segment brut', () => {
    expect(farmNextCopy(plain, 0)).toEqual({ step: 1, text: '/travel 2,2', start: false });
    expect(farmNextCopy(plain, 1)).toEqual({ step: 2, text: '/travel 3 3', start: false });
  });

  it('après la dernière : retour à la première (parcours en boucle), sans le zaap', () => {
    expect(farmNextCopy(plain, 2)).toEqual({ step: 0, text: '/travel 1 1', start: false });
    expect(farmNextCopy(zaap, 1)).toEqual({ step: 0, text: '/travel 1 1', start: false });
  });

  it('aucune position cliquée : « Début » si le parcours commence par un zaap, sinon la première', () => {
    expect(farmNextCopy(zaap, -1)).toEqual({ step: 0, text: '/zaap 0 0;/travel 1 1', start: true });
    expect(farmNextCopy(plain, -1)).toEqual({ step: 0, text: '/travel 1 1', start: false });
  });

  it('position mémorisée hors du parcours (parcours raccourci) : repart du début', () => {
    expect(farmNextCopy(plain, 7)).toEqual({ step: 0, text: '/travel 1 1', start: false });
  });

  it('une position répétée est suivie par indice, pas par coordonnées', () => {
    const loop = parseFarmRoute('/travel 1 1;/travel 2 2;/travel 1 1;/travel 3 3');
    expect(farmNextCopy(loop, 2)).toEqual({ step: 3, text: '/travel 3 3', start: false });
  });

  it('parcours sans étape : rien', () => {
    expect(farmNextCopy(parseFarmRoute(''), -1)).toBeNull();
    expect(farmNextCopy(parseFarmRoute('/zaap 0 0'), 0)).toBeNull();
  });
});
