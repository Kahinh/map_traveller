/**
 * Point d'entrée de la fenêtre d'un parcours Farm (`farm.html`) : petite fenêtre toujours au
 * premier plan. N'importe ni la grille, ni le formulaire, ni les Paramètres.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FarmWindow } from './FarmWindow';
import '../styles/app.css';
import '../styles/farm.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root introuvable');

createRoot(root).render(
  <StrictMode>
    <FarmWindow />
  </StrictMode>,
);
