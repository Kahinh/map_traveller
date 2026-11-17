// Fabrique commune des destinations de test. Coordonnées FICTIVES uniquement.
import type { Destination } from '../../src/features/catalog/schema';

/** Destination complète et valide : chaque test ne précise que ce qu'il vérifie. */
export function makeDestination(partial: Partial<Destination> = {}): Destination {
  return {
    id: 'x',
    name: 'X',
    category: 'place',
    zone: '',
    aliases: [],
    tags: [],
    image: null,
    command: '/travel 0 0',
    sortOrder: 0,
    enabled: true,
    twoStep: false,
    command2: '',
    ...partial,
  };
}
