import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { enableThumbnails } from './lib/tauri/thumbnails';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root introuvable');

// Fenêtre principale : fabrique les vignettes manquantes (la palette ne le fait pas).
enableThumbnails();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
