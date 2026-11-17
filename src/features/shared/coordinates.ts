/**
 * Bornes des coordonnées TAPÉES dans une requête (palette : « proche X,Y », position d'un
 * parcours Farm) et du référentiel des zaaps. Ne s'applique jamais aux commandes saisies dans
 * le catalogue : elles sont copiées telles quelles (invariant 1).
 */

/** Valeur absolue maximale d'une coordonnée tapée (le monde connu tient dans ±150). */
export const MAX_COORDINATE = 999;

/** Vrai si `n` est une coordonnée entière dans les bornes. */
export function isCoordinate(n: unknown): n is number {
  return Number.isInteger(n) && Math.abs(n as number) <= MAX_COORDINATE;
}
