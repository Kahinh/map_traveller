/**
 * Icônes SVG originales : un seul jeu, grille de 16, trait de 1,5, extrémités arrondies,
 * `currentColor`. Taille d'affichage donnée par la feuille de style (`--mt-icon-*`) ; les
 * attributs `width` / `height` ne servent qu'avant le chargement des styles.
 */
import type { ReactNode } from 'react';
import type { Category } from '../features/catalog/schema';

function Icon({
  children,
  filled = false,
  strokeWidth = 1.5,
  className,
}: {
  children: ReactNode;
  filled?: boolean;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
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

/**
 * Repère de position, signature du produit : le losange et son point central de l'icône de
 * l'application, à plat, d'une seule couleur. N'apparaît qu'à deux endroits : la barre de titre
 * et l'étape courante d'un parcours Farm.
 */
export const MarkIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M8 1.75L14.25 8 8 14.25 1.75 8z" />
    <circle cx="8" cy="8" r="1.75" fill="currentColor" stroke="none" />
  </Icon>
);

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

/** Chevron de dépliage : pointe à droite ; la feuille de style le tourne quand le bloc est ouvert. */
export const ChevronIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M6.5 4L10.5 8l-4 4" />
  </Icon>
);

/** Flèche d'une touche du clavier : pointe vers le haut ; la feuille de style l'oriente. */
export const ArrowIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M8 13V3M4 7l4-4 4 4" />
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

/** Loupe des champs de recherche. */
export const SearchIcon = () => (
  <Icon>
    <circle cx="7" cy="7" r="4.25" />
    <path d="M10.2 10.2L13.5 13.5" />
  </Icon>
);

/** Lancement du parcours complet (« Début » du panneau Farm). */
export const PlayIcon = () => (
  <Icon>
    <path d="M5 3.5v9L12 8z" />
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

/** PNJ : une silhouette. */
const NpcIcon = () => (
  <Icon>
    <circle cx="8" cy="5.25" r="2.5" />
    <path d="M3 13.5c0-2.75 2.25-4.5 5-4.5s5 1.75 5 4.5" />
  </Icon>
);

/** Donjon : une tour crénelée et sa porte. */
const DungeonIcon = () => (
  <Icon>
    <path d="M3.5 14V2.5h2.25V4.5h1.5v-2h1.5v2h1.5v-2h2.25V14z" />
    <path d="M6.5 14v-2.75a1.5 1.5 0 0 1 3 0V14" />
  </Icon>
);

/** Lieu-dit : un poteau indicateur à deux panneaux. */
const PlaceIcon = () => (
  <Icon>
    <path d="M8 1.75v12.5M5.5 14.25h5" />
    <path d="M8 3h4.25l1.5 1.75-1.5 1.75H8" />
    <path d="M8 8H3.75l-1.5 1.75 1.5 1.75H8" />
  </Icon>
);

/** Farm : un parcours qui relie deux positions. */
const FarmIcon = () => (
  <Icon>
    <circle cx="3.75" cy="12.25" r="1.75" />
    <circle cx="12.25" cy="3.75" r="1.75" />
    <path d="M5.5 12.25h3.25a2 2 0 0 0 0-4h-1.5a2 2 0 0 1 0-4h3.25" />
  </Icon>
);

const CATEGORY_ICONS: Record<Category, () => ReactNode> = {
  npc: NpcIcon,
  dungeon: DungeonIcon,
  place: PlaceIcon,
  farm: FarmIcon,
};

/** Icône d'une catégorie (carte sans image, vignette de la palette). */
export function CategoryIcon({ category }: { category: Category }) {
  const Glyph = CATEGORY_ICONS[category];
  return <Glyph />;
}
