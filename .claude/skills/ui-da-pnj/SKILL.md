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

## Éditeur

- Barre d'outils : `.toolbar__row` = onglets (défilants) + `icon-btn` « + » (Nouvelle destination) + crayon (mode gestion, `aria-pressed`, `is-active`).
- Mode gestion : `.card__edit` (crayon, haut-gauche, bouton frère des zones de copie) ; la pastille Farm est masquée ; liseré `.grid-scroll.is-managing`. Les clics de copie ne changent pas.
- Panneaux : composant `Panel` (`.panel`, `.panel__header`, `.panel__title`), un seul ouvert à la fois (`PanelState`). Formulaire : `.form__body` défilant, `.form__actions` fixées en bas, catégorie en `.segmented`, boutons `.btn` / `.btn--primary` / `.btn--danger` / `.btn--danger-ghost`. Confirmations (abandon, suppression) dans la barre d'actions, jamais de dialogue natif.
- Pendant le formulaire, la grille et la barre d'outils sont `inert`.

## Palette et Paramètres

- Palette (`palette.html`, `src/styles/palette.css`, tokens seuls) : fenêtre fixe 560 × 380. Champ `role=combobox`, liste `role=listbox`, lignes de 40 px fixes (vignette `CardVisual`, titre + sous-titre, aperçu de ce qu'Entrée copie). Carte à deux étapes : emplacement de largeur fixe (« 2 étapes » au repos, cases 1 / 2 sur la ligne sélectionnée) : aucun saut de mise en page. Sélection souris sur `mousemove`.
- Paramètres : engrenage dans `WindowHeader` (désactivé pendant l'édition), `SettingsPanel` avec un registre `SETTINGS_SECTIONS` et une rangée d'onglets ; un fichier par rubrique dans `src/components/settings/`. Ajouter une rubrique = une entrée du registre.

## Disposition

Barre de titre custom (drag region) : icône, « Map Traveller », épingle, paramètres, réduire, fermer → recherche compacte → onglets Tout / PNJ / Donjons / Lieux-dits / Farm / Favoris + bouton `+` → grille `auto-fill` à défilement vertical.

## Carte

- Image pleine carte (`object-fit: cover`). Nom **en surimpression** : `.card__name` (dégradé `--mt-scrim-*` partant du transparent, au moins 50 % de la hauteur) contient `.card__label` (11 px en 600, `line-clamp: 2`, ombre `--mt-text-shadow`). Composant `CardName`. Jamais de bandeau opaque.
- Sans image : `.card__placeholder`, dégradé teinté. Le composant pose seulement `--card-hue` (0–359, `cardHue(name)` dans `src/features/catalog/cardHue.ts`, pure et testée) ; les tons `--mt-ph-*` sont déclarés dans `tokens.css`.
- Étoile : SVG `StarIcon` détourée (`--mt-icon-halo`), bouton distinct. Opacité 0.45 au repos, 0.9 au survol de la carte, accent si favorite.
- Pastilles (Farm, repères 1 / 2, crayon) : rondes, `--mt-chip-bg` + anneau `--mt-chip-ring`. Le repère « 1 » est à 29 % / 29 %, hors du crayon du mode gestion.
- Surbrillance au survol : voile `::after` porté par le bouton cliquable (`.card__main`, `.card__zone`), **opacité seule**, aucun JavaScript. `--mt-highlight` pour la carte, `--mt-highlight-zone` (plus marqué) pour un triangle, `--mt-press` à l'appui. Carte classique : liseré `.card__main::before` (`--mt-highlight-edge`, accent 2 px au focus). Règles `:hover` toujours sous `@media (hover: hover)`. Le survol de l'étoile ou du crayon ne surligne pas la carte.
- Empilement : image < voile < trait < pastilles et nom (1) < liseré et reflet (2) < copie (3) < étoile et crayon (4). Tout calque décoratif est en `pointer-events: none`.
- Interdits : ombre ou contour externes (`content-visibility` les rogne), `filter`, `backdrop-filter`, `will-change` permanent, `transform` au survol sur une zone ou sur la carte.
- Clic gauche / droit = copie (ou ouverture Farm) ; `contextmenu` toujours `preventDefault`.
- Crayon visible uniquement en mode gestion.
- Retour : classe `is-copied` ~800 ms (contour accent `.card::after`, lavis `--mt-copied-wash`, pastille accent avec `CheckIcon`), `is-warning` si commande vide. Sur une carte à deux zones, le tout est découpé par la zone.
- Structure : `.card` (div) contient `.card__main` (bouton de copie) et `.card__star` (bouton frère) — jamais de bouton imbriqué.
- Cartes mémoïsées (`memo`) : garder des gestionnaires stables (`useCallback`) dans `App`.
- Étapes Farm : classe `.step` ; `is-current` = dernière position cliquée, `is-done` = positions dépassées.
- Icônes : SVG de `src/components/icons.tsx` (pas d'emoji).
- Carte à deux étapes : `.card--split` contient une seule image, deux boutons `.card__zone--1` / `--2` découpés par `clip-path`, `.card__divider`, deux repères `.card__step`. La géométrie n'est définie **que** par `--mt-zone-1` / `--mt-zone-2` : tout calque lié à une zone (coche, contour, surbrillance) réutilise ces variables. Focus clavier des zones : voile `--mt-focus`, liseré accent et repère en accent (le contour est rogné par `clip-path`).
- États : image absente (initiales), catalogue vide, recherche sans résultat, chargement.

## Vérification

`npm run dev` dans un navigateur (le presse-papiers retombe sur `navigator.clipboard`), puis `npm run tauri dev` si Rust est disponible. Vérifier 100 % et 150 %.
