---
name: ui-da-pnj
description: Direction artistique et ergonomie compacte de Map Traveller (inspiration PNJ) — tokens, grille de cartes, barre de titre, onglets, panneau Farm, éditeur, états. À utiliser pour tout changement visuel dans src/components, src/app ou src/styles.
---

# ui-da-pnj

Source : cahier des charges §3, §5.1, §6, §9.

## Tokens (`src/styles/tokens.css`)

| Token | Valeur |
|---|---|
| `--dt-bg` | `#252739` |
| `--dt-titlebar-from` / `--dt-titlebar-to` | `#646392` → `#4B4D77` |
| `--dt-card-bg` / `--dt-card-border` | `#393B58` / `#505273` |
| `--dt-text` / `--dt-text-muted` | `#F1F1FF` / `#B8B9D0` |
| `--dt-accent` | `#E5F052` |
| `--dt-card-size` | `90px` |
| `--dt-radius` | `10px` |

Ne jamais écrire une couleur en dur dans un composant.

## Disposition

Barre de titre custom (drag region) : icône, « Map Traveller », épingle, paramètres, réduire, fermer → recherche compacte → onglets Tout / PNJ / Donjons / Lieux-dits / Farm / Favoris + bouton `+` → grille `auto-fill` à défilement vertical.

## Carte

- Image `object-fit: cover`, nom dans un bandeau sombre en bas, tronqué + `title`.
- Étoile favori en coin (bouton distinct, `stopPropagation`).
- Clic gauche / droit = copie (ou ouverture Farm) ; `contextmenu` toujours `preventDefault`.
- Crayon visible uniquement en mode gestion.
- Retour : classe `is-copied` ~700 ms (coche + contour accent), avertissement discret si commande vide.
- États : image absente (initiales), catalogue vide, recherche sans résultat, chargement.

## Vérification

`npm run dev` dans un navigateur (le presse-papiers retombe sur `navigator.clipboard`), puis `npm run tauri dev` si Rust est disponible. Vérifier 100 % et 150 %.
