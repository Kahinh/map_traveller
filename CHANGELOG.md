# Journal des versions

Les numéros entre parenthèses renvoient aux issues et pull requests du dépôt. Seules les versions taguées ont une Release téléchargeable ; 0.7.0 et 0.8.0 ont été numérotées sans être taguées : leur contenu est arrivé aux utilisateurs avec la 0.9.0.

## 1.1.0 — 2026-11-20

**Pour l'utilisateur**

- Parcours Farm (#30) : le jeu n'enchaîne pas plusieurs `/travel`. Une carte Farm ouvre désormais une petite fenêtre toujours au premier plan, une case par position ; chaque case copie son seul `/travel`. « Début » (parcours qui commence par un `/zaap`) copie le Zaap et la première position. La dernière case cliquée reste en évidence tant que l'application tourne, même après fermeture de la fenêtre, dont la position et la taille sont retenues.
- Palette : un parcours Farm n'a plus qu'une ligne ; `Entrée` ou un clic ouvre sa fenêtre.

**Sous le capot**

- Fenêtre `farm` (`farm_window.rs`, `farm.html`) avec sa capability minimale ; `store:changed` émis aussi vers elle ; budget JS de la nouvelle page.

## 1.0.0 — 2026-11-17

Revue complète avant la 1.0, en six lots (A à F). Aucun changement de format des fichiers : les données des versions 0.x sont lues telles quelles.

**Pour l'utilisateur**

- Données mieux protégées : un fichier de favoris ou de réglages illisible n'est plus jamais écrasé (l'application passe en lecture seule et le signale) ; chaque écriture est forcée sur le disque avant de remplacer l'ancien fichier, ce qui la rend sûre en cas de coupure.
- Parcours Farm : la reprise depuis une position copie exactement le texte saisi après elle, y compris un segment non reconnu ou un `;` final, qui pouvaient disparaître.
- Recherche : une faute de frappe est tolérée dans l'onglet courant même si un autre onglet contient une correspondance exacte.
- Palette : la réouverture montre aussitôt une barre vide (plus d'ancienne requête ni d'aller-retour de taille), une lettre tapée dès l'ouverture n'est plus perdue, la frappe est plus rapide sur un gros catalogue, et la palette masquée met son affichage au repos. Meilleure prise en charge des lecteurs d'écran.
- Fenêtre principale : le focus est rendu là où il était à la fermeture d'un panneau (Farm, Paramètres), les onglets se parcourent aux flèches, les confirmations sont homogènes (« Supprimer « X » ? »), un message unique « Disponible dans l'application installée » dans le navigateur de développement, et l'état « Catalogue illisible » dit comment restaurer la sauvegarde.
- Finition visuelle : anneau de focus plus net, surfaces et contours affinés, rayons et typographie harmonisés, touches affichées comme des touches, bouton principal et « Début » du Farm en accent plein, champ de la palette fondu dans sa barre. La palette violette et la barre de titre sont conservées.
- Zone de notification : un double-clic sur l'icône ne fait plus apparaître puis disparaître la fenêtre. Un échec au démarrage est affiché dans un dialogue.
- Import d'images : les chemins réseau (UNC) sont refusés. Les images du catalogue livré ne reçoivent plus de vignette inutile.
- Palette instantanée (#24) : ordre de pertinence explicite (alias exact, nom exact, début du nom ou d'un alias, mots, initiales, sous-chaîne, faute de frappe) ; les initiales d'un nom ou d'un alias sont cherchables (`rdv`, `rv`) ; `Entrée` copie toujours le résultat de ce qui est tapé, même en rafale (`rdv` + `Entrée` avant l'affichage), une seule fois, et rien si le champ est vide ; un alias de fiche déjà porté par une autre destination est refusé dans le formulaire ; la palette se met à jour dès l'enregistrement, même fermée.

**Revue finale**

- Fenêtre étroite (jusqu'à 360 px de large) : tous les onglets restent visibles, Favoris réduit à son étoile ; une rangée d'onglets qui défile encore a son bord estompé.
- Recherche : quand l'onglet courant n'a aucun résultat mais que d'autres en ont, la grille le dit et propose « Voir les N résultats dans Tout ».
- Clavier : dans la recherche, la flèche bas mène à la première carte, `Entrée` copie la première carte comme un clic gauche.
- Copie plus claire : l'infobulle d'une carte dit exactement ce que font ses clics, la bulle dit « Copié sans Zaap » ou « Copié avec Zaap » et montre la commande en police à chasse fixe ; un échec affiche « Copie impossible, réessayez ».
- Palette : avec `proche X,Y`, la distance vient en tête de chaque ligne (« À 8 cartes · Zaap … »).
- Textes : « Remplacer » un alias fourni (et `Échap` vide la saisie), « Reprendre » dans la confirmation d'abandon du formulaire, exemple de commande précédé de « ex. ».

**Sous le capot**

- Rust (lot A) : écriture atomique durable et unique, lecture stricte avant fusion, commandes autorisées par fenêtre (`build.rs`, capabilities explicites sans `core:default`), CSP renforcée, palette au repos (`palette:hidden`, WebView2 invisible), clippy sans avertissement, `cargo fmt`.
- CI et outillage (lot A) : actions épinglées par SHA, permissions minimales, Dependabot, Node 22, Rust 1.97.0 épinglé, `Cargo.lock` suivi et builds en `--locked`, `cargo fmt --check` et `clippy -D warnings`, budget JS des pages (`scripts/bundle-budget.mjs`), chunk `react` nommé, scripts lintés.
- Logique pure (lot B) : index de recherche plus rapide à construire, cache LRU, façade de recherche allégée, règle « deux étapes » à un seul endroit, identifiants générés sans caractères perdus (« Cœur » → `coeur`), lecture JSON et bornes de coordonnées partagées.
- Palette (lot C) : lignes construites dans l'ordre jusqu'au plafond et réutilisées d'une frappe à l'autre, empreinte des fichiers relus au lieu de leur texte, paquet allégé.
- Palette (#24) : paliers de pertinence nommés (`TIER`, `searchIndex.ts`), acronymes indexés, décision de la touche Entrée en fonction pure (`enterChoice`), garde anti double copie, événement `store:changed` émis par Rust après chaque écriture, mesures locales (`performance.mark`, `window.__paletteStats()`, drapeau `map-traveller:perf`), `npm run bench:palette` et `docs/perf-palette.md`.
- Fenêtre principale (lot D) : `App.tsx` et `DestinationForm.tsx` découpés, garde d'écriture commune (`writeGate`), catalogue livré chargé à la demande, un seul abonnement clavier.
- Design (lot E) : nouveaux tokens (pastilles, pilule, opacités, bouton de barre de titre, survol de l'accent et des cartes), classe `.kbd` commune.
- Documentation (lot F) : README réécrit pour l'utilisateur, `docs/CONTRIBUTING.md`, `docs/RELEASING.md`, `docs/recette-v1.md`, ce journal ; cahier des charges archivé ; invariants renumérotés ; hooks Claude Code réparés (ils ne se chargeaient pas).

## 0.9.0 — 2026-11-17

- Catalogue livré (#8, #22) : 355 destinations réelles générées depuis les données du client du jeu (126 donjons, 32 PNJ, 197 hôtels des ventes et ateliers) avec 173 images ; commande = zaap le plus proche puis `/travel`. Les catalogues existants reçoivent les nouvelles entrées sans qu'aucune carte ne soit modifiée ; une entrée supprimée ne revient pas (`official.json`).

## 0.8.0 — non taguée (incluse dans 0.9.0)

- Palette : une ligne par étape d'une carte à deux étapes, cases « sans Zaap » / « avec Zaap » choisies aux flèches, variante par défaut dans Paramètres › Palette (#11).

## 0.7.0 — non taguée (incluse dans 0.9.0)

- Palette : `proche X,Y` propose les trois zaaps les plus proches d'une position (#7).
- Vignettes de 256 px pour la grille et la palette ; palette allégée (#14).

## 0.6.0 — 2026-11-16

- Recherche tolérante (accents, ponctuation, ordre des mots, fautes de frappe) et dictionnaire global d'alias, Paramètres › Alias (#10, #15).
- Cartes à deux étapes : deux triangles séparés, une seule image (#12, #16).
- Modernisation de l'interface, lots 1 et 2 : contraste, typographie, barre de titre en aplat, contrôles dessinés, textes courts (#13, #17, #21).
- Grille fenêtrée (catalogues de plusieurs milliers de cartes), icône dans la zone de notification, palette préchargée (#14, #18).
- Palette compacte dont la hauteur suit les résultats (#19, #20).

## 0.5.0 — 2026-11-15

- Mises à jour manuelles (par défaut) ou automatiques depuis les Releases GitHub, installateurs signés (#5). Les versions 0.4.0 et antérieures doivent être mises à jour une dernière fois à la main.
- Paramètres : rubriques Mises à jour, Données et Affichage (#6).

## 0.4.0 — 2026-11-15

- Palette de recherche globale (`Ctrl+Alt+Espace`), raccourcis globaux configurables, panneau Paramètres (#3).

## 0.3.0 — 2026-11-14

- Surbrillance au survol et nouveau design des cartes : image pleine carte, nom en surimpression (#2).

## 0.2.0 — 2026-11-14

- Cartes PNJ et Donjons à deux étapes (schéma 3 du catalogue) (#1).
- Éditeur intégré : créer, modifier, dupliquer, supprimer ; import d'images (#4).

## 0.1.1 — 2026-11-14

- Revue : étoile des favoris en bouton distinct, performance de la grille et de la recherche, frappe directe et `Ctrl+F` vers la recherche, suivi de la position dans un parcours Farm.

## 0.1.0 — 2026-11-14

- Première version : copie au clic gauche (sans `/zaap` initial) et au clic droit (commande complète), parcours Farm à reprise par étape, catalogue JSON local avec favoris et recherche, fenêtre toujours au premier plan, raccourci global, instance unique, installateur NSIS construit par GitHub Actions.
