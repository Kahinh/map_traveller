---
name: ui-da-pnj
description: Direction artistique et ergonomie compacte de Map Traveller (inspiration PNJ) — tokens, grille de cartes, barre de titre, onglets, panneau Farm, éditeur, états. À utiliser pour tout changement visuel dans src/components, src/app ou src/styles.
---

# ui-da-pnj

Source : cahier des charges §3, §5.1, §6, §9.

## Tokens (`src/styles/tokens.css`)

| Token | Valeur |
|---|---|
| `--mt-bg` | `#252739` |
| `--mt-titlebar-from` / `--mt-titlebar-to` | `#646392` → `#4B4D77` |
| `--mt-card-bg` / `--mt-card-border` | `#393B58` / `#505273` |
| `--mt-text` / `--mt-text-muted` | `#F1F1FF` / `#B8B9D0` |
| `--mt-accent` | `#E5F052` |
| `--mt-card-size` | `90px` |
| `--mt-radius` | `10px` |

Ne jamais écrire une couleur en dur dans un composant.

## Disposition

Barre de titre custom (drag region) : icône, « Map Traveller », épingle, paramètres, réduire, fermer → recherche compacte → onglets Tout / PNJ / Donjons / Lieux-dits / Farm / Favoris + bouton `+` → grille `auto-fill` à défilement vertical.

## Carte

- Image `object-fit: cover`, nom dans un bandeau sombre en bas, tronqué + `title`.
- Étoile favori en coin (bouton distinct, `stopPropagation`).
- Clic gauche / droit = copie (ou ouverture Farm) ; `contextmenu` toujours `preventDefault`.
- Crayon visible uniquement en mode gestion.
- Retour : classe `is-copied` ~800 ms (coche + contour accent, en calque interne `::after`), `is-warning` si commande vide.
- Structure : `.card` (div) contient `.card__main` (bouton de copie) et `.card__star` (bouton frère) — jamais de bouton imbriqué.
- Cartes mémoïsées (`memo`) : garder des gestionnaires stables (`useCallback`) dans `App`.
- Étapes Farm : classe `.step` ; `is-current` = dernière position cliquée, `is-done` = positions dépassées.
- Icônes : SVG de `src/components/icons.tsx` (pas d'emoji).
- Carte à deux étapes : `.card--split` contient une seule image, deux boutons `.card__zone--1` / `--2` découpés par `clip-path`, `.card__divider`, deux repères `.card__step`. La géométrie n'est définie **que** par `--mt-zone-1` / `--mt-zone-2` : tout calque lié à une zone (coche, contour, surbrillance) réutilise ces variables. Focus clavier des zones : fond `--mt-accent-soft` (le contour est rogné par `clip-path`).
- États : image absente (initiales), catalogue vide, recherche sans résultat, chargement.

## Vérification

`npm run dev` dans un navigateur (le presse-papiers retombe sur `navigator.clipboard`), puis `npm run tauri dev` si Rust est disponible. Vérifier 100 % et 150 %.
