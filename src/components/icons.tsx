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
