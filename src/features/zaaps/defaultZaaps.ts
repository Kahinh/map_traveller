/**
 * Référentiel des zaaps livré avec l'application (lecture seule, embarqué dans le paquet de la
 * palette). Validé par `tests/zaaps.test.ts` : un fichier invalide ne passe pas la CI. Par
 * sûreté, un référentiel invalide donne une liste vide plutôt qu'une palette en panne.
 */
import raw from '../../../resources/zaaps.json';
import { EMPTY_ZAAPS, parseZaapCatalog } from './zaaps';

const parsed = parseZaapCatalog(raw);

export const DEFAULT_ZAAPS = parsed.ok ? parsed.catalog : EMPTY_ZAAPS;
