import { describe, expect, it } from 'vitest';
import {
  boundedPrefixDistance,
  contentTokens,
  isWordlessQuery,
  maxTypos,
  normalizeText,
  queryTokens,
  tokenize,
} from '../src/features/catalog/searchText';

describe('normalisation du texte de recherche', () => {
  it('casse, accents et espaces', () => {
    expect(normalizeText('  Mériana  ÎLE ')).toBe('meriana ile');
    expect(normalizeText('HÔTEL des Ventes')).toBe('hotel des ventes');
  });

  it('ligatures dépliées, y compris en majuscules', () => {
    expect(normalizeText('Cœur immaculé')).toBe('coeur immacule');
    expect(normalizeText('ŒUVRE Ex Æquo Straße')).toBe('oeuvre ex aequo strasse');
    expect(normalizeText('Søren Łódź')).toBe('soren lodz');
  });
});

describe('découpe en mots', () => {
  it('tirets, apostrophes droites et courbes, ponctuation, espaces multiples', () => {
    expect(tokenize('Bonta - Atelier des bijoutiers')).toEqual(['bonta', 'atelier', 'des', 'bijoutiers']);
    expect(tokenize("L'atelier d’Astrub")).toEqual(['l', 'atelier', 'd', 'astrub']);
    expect(tokenize('  lieu-dit ;  zone   2, (nord) ')).toEqual(['lieu', 'dit', 'zone', '2', 'nord']);
    expect(tokenize('   ')).toEqual([]);
    // Autres alphabets : les lettres au sens d'Unicode restent des mots.
    expect(tokenize('東京 - Αθήνα')).toEqual(['東京', 'αθηνα']);
  });

  it('requête : mots de liaison et doublons retirés', () => {
    expect(queryTokens('donjon de la Meulou')).toEqual(['donjon', 'meulou']);
    expect(queryTokens("l'atelier d'astrub")).toEqual(['atelier', 'astrub']);
    expect(queryTokens('bonta BONTA bonta')).toEqual(['bonta']);
  });

  it('requête faite seulement de mots de liaison : ils sont gardés', () => {
    expect(queryTokens('la')).toEqual(['la']);
    expect(queryTokens('de la')).toEqual(['de', 'la']);
    expect(queryTokens('')).toEqual([]);
  });

  it('requête sans aucun mot (ponctuation seule) : distinguée d\'une requête vide', () => {
    expect(isWordlessQuery('---')).toBe(true);
    expect(isWordlessQuery(' ? ')).toBe(true);
    expect(isWordlessQuery('')).toBe(false);
    expect(isWordlessQuery('   ')).toBe(false);
    expect(isWordlessQuery('a-b')).toBe(false);
  });

  it('mots utiles d\'un texte : sans mot de liaison', () => {
    expect(contentTokens('hôtel des ventes')).toEqual(['hotel', 'ventes']);
  });
});

describe('distance d\'édition bornée, au meilleur préfixe', () => {
  it('identique ou préfixe : 0', () => {
    expect(boundedPrefixDistance('meulou', 'meulou', 1)).toBe(0);
    expect(boundedPrefixDistance('meul', 'meulou', 1)).toBe(0);
  });

  it('une lettre oubliée, en trop, remplacée ou deux lettres inversées : 1', () => {
    expect(boundedPrefixDistance('melou', 'meulou', 1)).toBe(1);
    expect(boundedPrefixDistance('meuulou', 'meulou', 1)).toBe(1);
    expect(boundedPrefixDistance('meolou', 'meulou', 1)).toBe(1);
    expect(boundedPrefixDistance('muelou', 'meulou', 1)).toBe(1);
  });

  it('pendant la frappe : « melo » est déjà à une faute de « meulou »', () => {
    expect(boundedPrefixDistance('melo', 'meulou', 1)).toBe(1);
  });

  it('au-delà de la borne : borne + 1, sans chercher plus loin', () => {
    expect(boundedPrefixDistance('tremble', 'meulou', 1)).toBe(2);
    expect(boundedPrefixDistance('abcdefgh', 'zzzzzzzz', 2)).toBe(3);
  });

  it('fautes tolérées selon la longueur', () => {
    expect(maxTypos('rdv')).toBe(0);
    expect(maxTypos('melo')).toBe(1);
    expect(maxTypos('bijouti')).toBe(1);
    expect(maxTypos('bijoutie')).toBe(2);
    // Jamais sur un nombre : « 1236 » ne doit pas trouver « 1234 ».
    expect(maxTypos('1236')).toBe(0);
    expect(maxTypos('123456789')).toBe(0);
  });
});
