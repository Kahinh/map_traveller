// Coordonnées FICTIVES : elles illustrent les règles, ce ne sont pas des trajets réels.
import { describe, expect, it } from 'vitest';
import {
  farmResumeCommand,
  farmStartCommand,
  isValidFarmRoute,
  parseFarmRoute,
} from '../src/features/farm/farmRoute';

const ROUTE = '/travel 1 1;/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6';

describe('parcours Farm (invariant 3)', () => {
  const route = parseFarmRoute(ROUTE);

  it('test 7 : toutes les positions, dans l\'ordre', () => {
    expect(route.steps.map((s) => s.label)).toEqual(['1,1', '2,2', '3,3', '4,4', '5,5', '6,6']);
    expect(route.steps.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(isValidFarmRoute(route)).toBe(true);
  });

  it('test 9 : Démarrer depuis le début copie le parcours complet', () => {
    expect(farmStartCommand(route)).toBe(ROUTE);
  });

  it('table de référence', () => {
    expect(farmResumeCommand(route, 0)).toBe('/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6');
    expect(farmResumeCommand(route, 1)).toBe('/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6');
    expect(farmResumeCommand(route, 2)).toBe('/travel 4 4;/travel 5 5;/travel 6 6'); // test 8
    expect(farmResumeCommand(route, 3)).toBe('/travel 5 5;/travel 6 6');
    expect(farmResumeCommand(route, 4)).toBe('/travel 6 6');
  });

  it('test 10 : dernière étape → rien à copier', () => {
    expect(farmResumeCommand(route, 5)).toBeNull();
  });

  it('indice invalide → rien à copier', () => {
    expect(farmResumeCommand(route, -1)).toBeNull();
    expect(farmResumeCommand(route, 99)).toBeNull();
    expect(farmResumeCommand(route, 1.5)).toBeNull();
  });

  it('test 11 : coordonnées répétées, reprise par indice', () => {
    const r = parseFarmRoute('/travel 1 1;/travel 2 2;/travel 1 1;/travel 3 3');
    expect(r.steps.map((s) => s.label)).toEqual(['1,1', '2,2', '1,1', '3,3']);
    expect(farmResumeCommand(r, 0)).toBe('/travel 2 2;/travel 1 1;/travel 3 3');
    expect(farmResumeCommand(r, 2)).toBe('/travel 3 3');
  });

  it('Zaap initial : Démarrer copie tout, la reprise uniquement les /travel suivants', () => {
    const cmd = '/zaap 5 -18;/travel 1 1;/travel 2 2;/travel 3 3';
    const r = parseFarmRoute(cmd);
    expect(r.zaapPrefix).toBe('/zaap 5 -18');
    expect(r.steps.map((s) => s.label)).toEqual(['1,1', '2,2', '3,3']);
    expect(farmStartCommand(r)).toBe(cmd);
    expect(farmResumeCommand(r, 0)).toBe('/travel 2 2;/travel 3 3');
    expect(isValidFarmRoute(r)).toBe(true);
  });

  it('segments originaux conservés (espaces, virgules, négatifs)', () => {
    const r = parseFarmRoute('/travel  -3 7;/travel 4,-2; /travel 0 0');
    expect(r.steps.map((s) => s.label)).toEqual(['-3,7', '4,-2', '0,0']);
    expect(farmResumeCommand(r, 0)).toBe('/travel 4,-2; /travel 0 0');
  });

  it('test 12 : segment non reconnu signalé, jamais supprimé en silence', () => {
    const r = parseFarmRoute('/travel 1 1;/foo bar;/travel 2 2');
    expect(isValidFarmRoute(r)).toBe(false);
    expect(r.issues).toEqual([{ segmentIndex: 1, segment: '/foo bar', reason: 'not-travel' }]);
    expect(r.steps).toHaveLength(2);
  });

  it('segment vide au milieu signalé, ; final toléré', () => {
    expect(parseFarmRoute('/travel 1 1;/travel 2 2;').issues).toEqual([]);
    expect(parseFarmRoute('/travel 1 1;;/travel 2 2').issues[0]?.reason).toBe('empty-segment');
  });

  it('reprise : un segment non reconnu entre deux étapes est copié tel quel', () => {
    const r = parseFarmRoute('/travel 1 1;/emote salut;/travel 2 2;/travel 3 3');
    expect(farmResumeCommand(r, 0)).toBe('/emote salut;/travel 2 2;/travel 3 3');
    expect(farmResumeCommand(r, 1)).toBe('/travel 3 3');
  });

  it('reprise : espaces originaux conservés après la coupe', () => {
    const r = parseFarmRoute('/travel 1 1;  /travel 2 2 ;/travel  3,3  ');
    expect(farmResumeCommand(r, 0)).toBe('/travel 2 2 ;/travel  3,3  ');
    expect(farmResumeCommand(r, 1)).toBe('/travel  3,3  ');
  });

  it('reprise : `;` final conservé, dernière étape → rien', () => {
    const r = parseFarmRoute('/zaap 9 9;/travel 1 1;/travel 2 2;');
    expect(farmResumeCommand(r, 0)).toBe('/travel 2 2;');
    expect(farmResumeCommand(r, 1)).toBeNull();
  });

  it('reprise : retours à la ligne conservés', () => {
    const r = parseFarmRoute('/travel 1 1;\n/travel 2 2;\n/travel 3 3');
    expect(farmResumeCommand(r, 0)).toBe('/travel 2 2;\n/travel 3 3');
  });

  it('commande vide : aucun parcours', () => {
    const r = parseFarmRoute('');
    expect(r.steps).toEqual([]);
    expect(isValidFarmRoute(r)).toBe(false);
    expect(farmStartCommand(r)).toBeNull();
  });
});
