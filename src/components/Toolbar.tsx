import type { KeyboardEvent, RefObject } from 'react';
import type { ViewFilter } from '../features/catalog/search';
import { CategoryTabs } from './CategoryTabs';
import { Keys } from './Keys';
import { PencilIcon, PlusIcon, SearchIcon } from './icons';

interface Props {
  searchRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (query: string) => void;
  /** ↓ et Entrée dans le champ de recherche. */
  onSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  view: ViewFilter;
  onViewChange: (view: ViewFilter) => void;
  counts?: Readonly<Record<ViewFilter, number>>;
  /** Identifiant de la grille, zone pilotée par les onglets. */
  gridId: string;
  /** Catalogue chargé : création et mode gestion possibles. */
  ready: boolean;
  manageMode: boolean;
  onToggleManage: () => void;
  onNew: () => void;
  /** Un panneau recouvre la fenêtre : rien ne doit recevoir le focus ni les clics. */
  inert: boolean;
}

/** Recherche, onglets de catégorie, « Nouvelle destination » et mode gestion. */
export function Toolbar({
  searchRef,
  query,
  onQueryChange,
  onSearchKeyDown,
  view,
  onViewChange,
  counts,
  gridId,
  ready,
  manageMode,
  onToggleManage,
  onNew,
  inert,
}: Props) {
  return (
    <div className="toolbar" inert={inert}>
      {/* Loupe à gauche, rappel du raccourci à droite tant que le champ est vide (CSS seul). */}
      <label className="search">
        <SearchIcon />
        <input
          ref={searchRef}
          className="search__input"
          type="search"
          placeholder="Rechercher"
          aria-label="Rechercher une destination"
          aria-controls={gridId}
          title="Tapez directement pour rechercher · Flèche bas : aller aux cartes · Entrée : copier la première · Échap : effacer"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        <span className="search__key" aria-hidden>
          <Keys keys={['Ctrl', 'F']} combo />
        </span>
      </label>
      <div className="toolbar__row">
        <CategoryTabs value={view} onChange={onViewChange} counts={counts} controls={gridId} />
        <button
          type="button"
          className="icon-btn"
          title="Nouvelle destination"
          aria-label="Nouvelle destination"
          disabled={!ready}
          onClick={onNew}
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          className={`icon-btn${manageMode ? ' is-active' : ''}`}
          title={manageMode ? 'Quitter le mode gestion (Échap)' : 'Gérer les destinations'}
          aria-label="Gérer les destinations"
          aria-pressed={manageMode}
          disabled={!ready}
          onClick={onToggleManage}
        >
          <PencilIcon />
        </button>
      </div>
    </div>
  );
}
