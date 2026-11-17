---
name: ui-da-pnj
description: Direction artistique et ergonomie compacte de Map Traveller (inspiration PNJ) — tokens, grille de cartes, barre de titre, onglets, panneau Farm, éditeur, états. À utiliser pour tout changement visuel dans src/components, src/app ou src/styles.
---

# ui-da-pnj

Référence : `src/styles/tokens.css` (valeurs), ce skill (règles d'usage), invariant 8 de `CLAUDE.md`. Le cahier des charges des versions 0.x (`docs/archive/`) n'est plus qu'un historique.

## Cadre

- Fenêtre principale ~510 × 300 à l'ouverture, minimum 360 × 240 (`tauri.conf.json`) ; à 510 × 300, **deux rangées de cartes visibles** : la barre d'outils ne gagne aucun pixel. Cartes ~90 px (`--mt-card-size`), grille dense, marges courtes.
- Lisible à 100 % et 150 % de mise à l'échelle Windows.
- Inspiration ergonomique : PNJ. Ne jamais reprendre ses ressources (portraits, icônes, CSS, code).

## Tokens (`src/styles/tokens.css`)

Les valeurs vivent **uniquement** dans `tokens.css` : ne pas les recopier ici, le lire. Règles d'usage :

- **Surfaces** : `--mt-bg` (fond, ne pas l'assombrir), `--mt-bg-raised` (champs, boutons, barre de la palette `--mt-palette-bar`), `--mt-card-bg` (cartes, ligne sélectionnée de la palette, touches), `--mt-titlebar` (barre de titre en aplat, valeur fixée par l'auteur : ne pas la changer). Filets : `--mt-hairline`. Contour des cartes : `--mt-card-border`, `--mt-card-border-hover` au survol. Contour des champs de saisie seulement : `--mt-field-border`.
- **Texte** : `--mt-text`, `--mt-text-muted` (secondaire, et message « Disponible dans l'application installée » : classe `.installed-only`). Tout texte rouge en `--mt-danger-text`, `--mt-danger` réservé aux fonds ; `--mt-warning` pour les avertissements.
- **Accent** : `--mt-accent` (texte dessus : `--mt-accent-ink`), `--mt-accent-hover` au survol d'une action principale (fond et bordure, pas de bordure blanche). Usages limités, voir « Accent ».
- **Focus** : un seul anneau, `--mt-focus-ring` (accent plein), `--mt-focus-ring-w`, `--mt-focus-ring-offset` (1 px).
- **Voiles** : `--mt-highlight` (carte survolée), `--mt-highlight-zone` (triangle), `--mt-highlight-edge` (liseré), `--mt-press` (appui), `--mt-focus`, `--mt-copied-wash` (copie). Dégradés du nom : `--mt-scrim-*`, ombre `--mt-text-shadow`.
- **États** : `--mt-disabled` (contrôle indisponible : une seule opacité), `--mt-done` (étape Farm dépassée).
- **Géométrie** : espacement sur une grille de 4 px (`--mt-space-1` à `-6`, demi-pas `--mt-space-half` seulement dans un petit contrôle ; `--mt-gap`, lu par `useGridWindow`) ; rayons `--mt-radius`, `-sm`, `-xs`, `-pill`, et dans une bordure de 1 px `calc(var(--mt-radius) - 1px)` ; pastilles `--mt-chip-sm` (repères, pastille Farm) / `--mt-chip-md` (crayon, coche d'une carte à deux étapes), coche classique `--mt-control-h` ; `--mt-titlebar-h`, `--mt-titlebar-btn`, `--mt-control-h` ; icônes `--mt-icon-lg` / `-md` / `-sm`.
- **Typographie** : `--mt-font` (Segoe UI Variable Text) et `--mt-font-mono` (commandes et **coordonnées partout où elles sont affichées**). Échelle : `--mt-font-size-xs` (compteurs, repères, touches), `-sm` en 500 (onglets, boutons, nom de carte), base (corps), `-md` en 600 (titres de panneau et de ligne de palette), `-lg` (champ de la palette seulement). Deux graisses dans le courant (400, 500), 600 seulement pour les titres, jamais 700.
- **Mouvement** : `--mt-ease`, `--mt-dur-fast`, `--mt-dur-enter` ; opacité et transformation uniquement. Appui : `transform: scale(.97)` sur `.btn`, `.icon-btn`, `.segmented__item` (`:active:not(:disabled)`).
- Un token sans usage se supprime. Un nouveau token se crée dans `tokens.css` avant d'être utilisé, jamais une valeur en dur à côté.

Touches affichées : composant `Keys` (`src/components/Keys.tsx`) et classe `.kbd` (`src/styles/kbd.css`, importée par `app.css` et `palette.css`) : recherche, pied de palette, rubriques Palette et Raccourcis.

Ne jamais écrire une couleur en dur dans un composant. Aucune taille, graisse ni pile de police en dur dans `app.css` ni `palette.css` : tokens seulement, et rien sous 10 px (vérifier que le texte tient dans sa pastille, élargir la boîte s'il le faut).

## Accent

Le jaune-vert est réservé à trois usages : **sélection ou état actif** (onglet, segment, épingle, étoile favorite, étape courante), **action principale** (`.btn--primary`, « Début » du Farm), **focus**. Tout le reste est en `--mt-text` ou `--mt-text-muted` : pastille « FARM », lien « Plus d'options » (texte clair + chevron, souligné au survol), champ de la palette (il a toujours le focus : pas de cadre d'accent). Icônes de la barre de titre en `--mt-text` (contraste sur l'aplat).

## Fondations (issue n°13, lot 2)

- **Palette violette et accent jaune-vert conservés** : décision de l'auteur. Ne pas passer les surfaces en neutres sombres, même si un skill de design le recommande.
- Barre de titre en aplat `--mt-titlebar`, filet `--mt-hairline` en bas, 32 px. Pictogramme `MarkIcon` (losange et point, celui de l'icône de l'application) à la place de « MT » : c'est la **signature**, utilisée seulement là et sur l'étape Farm courante.
- Espacement sur une grille de 4 px (`--mt-space-*`) ; un demi-pas de 2 px seulement dans un petit contrôle. Exceptions géométriques assumées : bordures de 1 px, repères et coche des cartes à deux étapes, barre de palette (46 + 2 = 48).
- Un seul anneau de focus `--mt-focus-ring`, posé à l'intérieur quand un parent rogne (onglets, segments, cartes, triangles). Les champs n'ont pas de bordure d'accent au focus.
- Mouvement : `--mt-ease` et deux durées, propriétés nommées, panneaux, bulle et coche en fondu (opacité seule), aucun rebond, rien qui boucle.
- Recherche : loupe à gauche, rappel `Ctrl F` à droite qui disparaît à la frappe (CSS seul). Onglets en texte seul, l'actif souligné d'accent sur 2 px, nombre de destinations en texte secondaire (hors recherche).
- Textes : courts, sans point final sur un libellé, un bouton ou un message court, sans exclamation, sans capitales forcées. **Aucun caractère employé comme icône** : tout est en SVG dans `icons.tsx`.
- Contrôles dessinés (`src/components/controls.tsx`) : `Switch` (`role=switch`, se bascule aussi par le libellé), `Segmented` (`radiogroup` + `radio`, une tabulation, flèches, Début, Fin), `SettingRow` (libellé et description d'une ligne à gauche, contrôle à droite, détail en `title`). **Aucun contrôle natif** (`checkbox`, `radio`, `select`, `fieldset`).

## Éditeur

- Barre d'outils : `.toolbar__row` = onglets (défilants) + `icon-btn` « + » (Nouvelle destination) + crayon (mode gestion, `aria-pressed`, `is-active`).
- Mode gestion : `.card__edit` (crayon, haut-gauche, bouton frère des zones de copie) ; la pastille Farm est masquée ; barre d'accent de 2 px en haut de `.grid-scroll.is-managing`, l'icône de catégorie des cartes sans image masquée (le crayon prend sa place). Les clics de copie ne changent pas.
- Panneaux : composant `Panel` (`.panel`, `.panel__header`, `.panel__title`), un seul ouvert à la fois (`PanelState`). Formulaire : `.form__body` défilant, `.form__actions` fixées en bas, catégorie en `.segmented`, boutons `.btn` / `.btn--primary` / `.btn--danger` / `.btn--danger-ghost`. Confirmations (abandon, suppression) dans la barre d'actions, jamais de dialogue natif.
- Dès qu'un panneau est ouvert (Farm, Paramètres, formulaire), la barre d'outils et la grille sont `inert` ; `Panel` donne le focus à son bouton retour, et `usePanel` le rend à l'élément d'origine (ou à la recherche) à la fermeture.

## Palette et Paramètres

- Palette (`palette.html`, `src/styles/palette.css`, tokens seuls) : fenêtre de 560 de large dont la **hauteur suit le contenu** (issue n°19) : barre seule (48 px) à l'ouverture, champ vide ou sans résultat ; sinon lignes (8 visibles au plus, `--pal-max-rows`, puis défilement) et pied d'aide ; 430 px au maximum. `Palette.tsx` mesure `.palette` après chaque rendu et n'appelle `setPaletteHeight` que si la hauteur change (décision pure dans `src/features/palette/windowHeight.ts`) ; tout est remis à zéro au masquage (`palette:hidden`), pendant que la fenêtre est cachée, pour que la réouverture montre aussitôt la barre seule ; les dimensions n'existent que dans `palette.css`. Barre en aplat `--mt-palette-bar` (`--mt-bg-raised`), champ sans cadre fondu dans la barre, loupe en `--mt-icon-lg` ; ligne sélectionnée : marche `--mt-card-bg` et barre d'accent droite de 2 px (`::before`) ; vignette sur `--mt-bg-raised` avec filet. « Aucun résultat », « Chargement… » et l'échec d'une copie sans résultat s'affichent DANS la barre (`.palette__bar-info`) : rien n'agrandit la fenêtre sans contenu. Aucune animation de hauteur. Champ `role=combobox`, liste `role=listbox`, lignes de 40 px fixes (vignette `CardVisual`, titre + sous-titre, aperçu de ce qu'Entrée copie). Une ligne par étape (« — Étape N » en `.palette__step-tag`, jamais tronqué). Cases latérales réservées aux variantes **avec / sans Zaap** (issue n°11) : emplacement de largeur fixe `--pal-variants-w`, présent seulement sur une ligne à deux variantes ; boutons `ZaapIcon` / `TravelIcon` sur la ligne sélectionnée (case active en accent), mêmes icônes atténuées (`.is-idle`) ailleurs : aucun saut de mise en page. Rubrique Paramètres « Palette » : contrôle segmenté Sans Zaap / Avec Zaap. Sélection souris sur `mousemove`.
- Paramètres : engrenage dans `WindowHeader` (désactivé pendant l'édition), `SettingsPanel` avec un registre `SETTINGS_SECTIONS` et une rangée d'onglets ; un fichier par rubrique dans `src/components/settings/`. Ajouter une rubrique = une entrée du registre. Rubriques dans l'ordre du registre : Mises à jour, Données, Affichage, Palette, Alias, Raccourcis ; onglets au clavier par `useRovingFocus` (comme les onglets de catégorie et `Segmented`) ; chacune reçoit `settings`, `onChange`, `updater`, `aliases` et `destinations`. Rubrique Alias : saisie sur une ligne (`.aliases__form`), un bloc par alias (`.aliases__row` : terme et significations, puis origine, nombre de destinations trouvées et actions), confirmation de suppression dans la ligne. Chaque réglage est une `SettingRow` (booléen = `Switch`, choix de 2 ou 3 valeurs = `Segmented`), filets `--mt-hairline` entre les lignes, blocs titrés `.settings__block` / `.settings__heading` ; valeurs sélectionnables en `.settings__value` (chemin en `.settings__path`, tronqué par le milieu, complet en infobulle). Pas de bouton « Enregistrer » : chaque réglage est écrit dès qu'il change.

## Disposition

Barre de titre custom (zone de déplacement, `MarkIcon` compris) : pictogramme `MarkIcon`, « Map Traveller », paramètres (engrenage), épingle, réduire, fermer — ordre du code (`WindowHeader.tsx`) → recherche compacte → onglets Tout / PNJ / Donjons / Lieux-dits / Farm / Favoris + bouton `+` + crayon (mode gestion) → grille `auto-fill` à défilement vertical.

## Carte

- Image pleine carte (`object-fit: cover`). Nom **en surimpression** : `.card__name` (au moins 50 % de la hauteur) contient `.card__label` (`--mt-font-size-sm` en 500, `line-clamp: 2`, ombre `--mt-text-shadow`). Composant `CardName`. Le dégradé `--mt-scrim-*` n'est posé que sur une image (`.card__img ~ .card__name`) ; sur une carte sans image, le texte et son ombre suffisent. Jamais de bandeau opaque.
- **Un seul contour** par carte : la bordure `--mt-card-border` (éclaircie au survol). Pas de reflet ni de liseré intérieur décoratif.
- Sans image : `CardVisual` montre la surface `--mt-card-bg` unie et l'icône de catégorie (`CategoryIcon`, `--mt-icon-lg`, texte secondaire) en haut à gauche, puis le nom. **Pas de couleur par carte ni par catégorie**, pas d'initiales. La pastille « Farm » ne s'affiche que sur une image.
- Étoile : SVG `StarIcon` détourée (`--mt-icon-halo`), bouton distinct. Visible en permanence **seulement si favorite** (accent). Sinon opacité 0 au repos, 0.9 au survol de la carte ou quand la carte a le focus clavier, 1 quand l'étoile a le focus ; sous `@media (hover: none)`, 0.75 en permanence. Masquée par l'opacité seule : elle reste dans l'ordre de tabulation.
- Pastilles (Farm, repères 1 / 2, crayon) : rondes, `--mt-chip-bg` + anneau `--mt-chip-ring`. Le repère « 1 » est à 29 % / 29 %, hors du crayon du mode gestion.
- Surbrillance au survol : voile `::after` porté par le bouton cliquable (`.card__main`, `.card__zone`), **opacité seule**, aucun JavaScript. `--mt-highlight` pour la carte, `--mt-highlight-zone` (plus marqué) pour un triangle, `--mt-press` à l'appui. Carte classique : liseré `.card__main::before` (`--mt-highlight-edge`, accent 2 px au focus). Règles `:hover` toujours sous `@media (hover: hover)`. Le survol de l'étoile ou du crayon ne surligne pas la carte.
- Empilement : image (carte à deux étapes : calque découpé `.card__art` avec image et dégradé du nom) < contour du triangle et voile < pastilles et nom (1) < liseré (2) < copie (3) < étoile et crayon (4). Tout calque décoratif est en `pointer-events: none`.
- Interdits : ombre ou contour externes (`content-visibility` les rogne), `filter`, `backdrop-filter`, `will-change` permanent, `transform` au survol sur une zone ou sur la carte.
- Clic gauche / droit = copie (ou ouverture Farm) ; `contextmenu` toujours `preventDefault`.
- Crayon visible uniquement en mode gestion.
- Retour : classe `is-copied` ~800 ms (contour accent `.card::after`, lavis `--mt-copied-wash`, pastille accent avec `CheckIcon`), `is-warning` si commande vide. Sur une carte à deux zones, lavis et coche sont découpés par la zone, et le contour est celui du triangle copié (`--zone-edge` accent ou `--mt-warning`, 2 px) : `.card::after` y est désactivé.
- Structure : `.card` (div) contient `.card__main` (bouton de copie) et `.card__star` (bouton frère) — jamais de bouton imbriqué.
- Cartes mémoïsées (`memo`) : garder des gestionnaires stables (`useCallback`) dans `App`.
- Étapes Farm : classe `.step` ; `is-current` = dernière position cliquée, `is-done` = positions dépassées.
- Icônes : SVG de `src/components/icons.tsx` (grille 16 px, trait 1,5, `currentColor`) ; pas d'emoji ni de caractère « ★ » (l'onglet Favoris utilise `StarIcon`).
- Carte à deux étapes : deux triangles séparés par un interstice transparent (`--mt-split-gap`, 4 px, mesuré perpendiculairement à la diagonale). `.card--split` n'a ni fond ni bordure ; il contient `SplitCardArt` (calque `.card__art` : fond, image **unique** et non recadrée, dégradé du nom `::after` s'il y a une image, découpé une seule fois par `--mt-zone-both` ; repères `.card__step`), deux boutons `.card__zone--1` / `--2` découpés par `clip-path`, puis le nom (texte seul, entier), la coche, l'étoile et le crayon. `SplitCardArt` sert aussi à l'aperçu du formulaire. La géométrie n'est définie **que** par `--mt-zone-cut`, `--mt-zone-1`, `--mt-zone-2` et `--mt-zone-both` (carte carrée) : tout calque lié à une zone (coche, contour, surbrillance) réutilise ces variables. Contour de chaque triangle sur ses trois côtés : `.card__zone::before` (ombre interne + bande sur la diagonale) ; survol, focus et copie ne changent que `--zone-edge` / `--zone-edge-w` (`--mt-card-border` au repos, `--mt-highlight-edge` au survol, accent 2 px au focus). Focus clavier : voile `--mt-focus`, contour accent et repère en accent. L'interstice n'est pas cliquable. Le dégradé du nom est déclaré une fois (`--mt-name-scrim` sur `.card`).
- États : image absente (icône de catégorie, **pas d'initiales**), catalogue vide, recherche sans résultat, favoris vides, chargement, catalogue illisible (dit comment restaurer `catalog.json.bak`).

## Vérification

Suivre « Validation de l'interface » de `CLAUDE.md` (`npm run dev`, texte d'abord, `#root` à 510 × 300, palette à 560 de large), puis `npm run tauri dev` sous Windows si possible. Contrôles rapides : aucune couleur hors `tokens.css` (`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' src/styles/app.css src/styles/palette.css` ne renvoie rien) ; deux rangées de cartes à 510 × 300 ; `.palette` = 48 px pour la barre seule. 150 % et multi-écrans : sur Windows seulement (voir `docs/recette-v1.md`).
