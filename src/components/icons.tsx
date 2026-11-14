/** Icônes SVG originales, héritent de `currentColor` (rendu net à 100 % et 150 %). */
import type { ReactNode } from 'react';

function Icon({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
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
