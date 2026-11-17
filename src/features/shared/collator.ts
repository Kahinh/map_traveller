/**
 * Comparaison de noms commune à toute l'application : insensible à la casse et aux accents,
 * nombres dans l'ordre numérique (« Zone 2 » avant « Zone 10 »). Un seul collateur : en créer
 * un coûte cher.
 */
export const frCollator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
