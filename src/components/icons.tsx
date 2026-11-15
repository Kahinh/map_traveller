/** Icônes SVG originales, héritent de `currentColor` (rendu net à 100 % et 150 %). */
import type { ReactNode } from 'react';

function Icon({
  children,
  filled = false,
  strokeWidth = 1.5,
}: {
  children: ReactNode;
  filled?: boolean;
  strokeWidth?: number;
}) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const PinIcon = ({ filled }: { filled: boolean }) => (
  <Icon filled={filled}>
    <path d="M6 2h4l-.6 4 2.1 2v1.5h-7V8l2.1-2L6 2z" />
    <path d="M8 9.5V14" />
  </Icon>
);

/**
 * Roue dentée du bouton « Paramètres » : contour à six dents trapézoïdales (des dents
 * pleines, pas des rayons, pour ne pas se lire comme un soleil) et moyeu creux.
 */
export const GearIcon = () => (
  <Icon>
    <path d="M6.71 3.17L6.84 1.4L9.16 1.4L9.29 3.17A5 5 0 0 1 11.54 4.46L13.13 3.69L14.3 5.71L12.83 6.71A5 5 0 0 1 12.83 9.29L14.3 10.29L13.13 12.31L11.54 11.54A5 5 0 0 1 9.29 12.83L9.16 14.6L6.84 14.6L6.71 12.83A5 5 0 0 1 4.46 11.54L2.87 12.31L1.7 10.29L3.17 9.29A5 5 0 0 1 3.17 6.71L1.7 5.71L2.87 3.69L4.46 4.46A5 5 0 0 1 6.71 3.17Z" />
    <circle cx="8" cy="8" r="2" />
  </Icon>
);

export const MinimizeIcon = () => (
  <Icon>
    <path d="M3.5 8h9" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);

export const BackIcon = () => (
  <Icon>
    <path d="M9.5 3.5L5 8l4.5 4.5" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);

export const PencilIcon = () => (
  <Icon>
    <path d="M10.5 2.5l3 3-8 8H2.5v-3l8-8z" />
    <path d="M9 4l3 3" />
  </Icon>
);

/** Loupe du champ de recherche de la palette. */
export const SearchIcon = () => (
  <Icon>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.2 10.2L13.5 13.5" />
  </Icon>
);

/** Coche du retour de copie. */
export const CheckIcon = () => (
  <Icon strokeWidth={2.2}>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
);

const STAR_PATH = 'M8 1.8l1.85 3.9 4.25.55-3.1 2.95.8 4.2L8 11.35 4.2 13.4l.8-4.2-3.1-2.95 4.25-.55z';

/**
 * Étoile de favori. Un premier tracé épais, coloré par la feuille de style (`.icon-halo`),
 * détoure l'étoile pour qu'elle reste lisible sur une image claire comme sombre.
 */
export const StarIcon = ({ filled }: { filled: boolean }) => (
  <Icon filled={filled}>
    <path className="icon-halo" d={STAR_PATH} />
    <path d={STAR_PATH} />
  </Icon>
);
