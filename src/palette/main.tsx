/**
 * Point d'entrée de la fenêtre palette (`palette.html`). N'importe que la palette : ni la
 * grille, ni le panneau Farm, ni le formulaire, ni l'en-tête de la fenêtre principale.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Palette } from './Palette';
import '../styles/palette.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root introuvable');

createRoot(root).render(
  <StrictMode>
    <Palette />
  </StrictMode>,
);
