# Notes d'agent — erreurs transformées en garde-fous

Ce fichier garde la trace des frictions rencontrées pendant le développement, pour qu'elles ne se perdent pas à la fin d'une session. Une note seule ne suffit pas : **une erreur vue deux fois devient un test, un script, un hook ou une règle**, et la note pointe alors vers ce garde-fou.

## Comment l'utiliser

- **Avant une tâche** : lire « Principes » et les notes de la zone concernée.
- **En fin de tâche** : ajouter une note pour chaque friction réelle (une correction demandée par l'utilisateur, une erreur découverte en revue, un outil qui a menti). Ne pas noter le bruit : ce qui existait avant et n'a pas été causé par la tâche n'a pas sa place ici.
- **Format d'une note** : date, étiquette, ce qui s'est passé, le garde-fou mis en place (ou « aucun, à surveiller »).
- **Étiquettes** : `violation-principe`, `duplication`, `test-fragile`, `correction-humaine`, `outil-trompeur`, `non-vérifié`.
- Les « Principes » ne se modifient pas : on en ajoute. Un principe n'entre ici qu'après accord de l'utilisateur.

## Principes

1. **Ce qui n'a pas été observé n'est pas vérifié.** Un build vert prouve que le code compile, pas qu'il fonctionne. Tout rapport sépare « vérifié » de « non vérifié » et dit comment vérifier le reste.
2. **Le Rust se valide par la CI.** Sans `cargo` en local : pousser `main` sans tag, attendre le build (`npm run ci:watch`), corriger, et seulement ensuite taguer.
3. **Un tag atteint les utilisateurs.** Depuis les mises à jour automatiques, taguer revient à déployer. Jamais sur un build non vérifié.
4. **Une règle de copie n'existe qu'à un seul endroit.** Toute nouvelle surface (carte, palette, aperçu) appelle les fonctions pures existantes.
5. **Le texte d'une commande ne se touche pas.** Ni `trim`, ni normalisation, ni reconstruction.
6. **La géométrie, les couleurs et les chemins ont une seule source** : variables `--mt-zone-*`, `tokens.css`, `app_data_dir()`.

## Notes

### 2026-11-14 — `outil-trompeur` — Le survol simulé ne déclenche pas `:hover`
L'outil de navigateur a déplacé le pointeur sans que la page voie un survol : les captures montraient un état normal. La surbrillance de l'issue n°2 a été contrôlée en forçant l'état par une feuille de style de test.
**Garde-fou :** section « Validation de l'interface » de `CLAUDE.md` (forcer l'état, ou lire `getComputedStyle`). Le survol réel reste à confirmer sur l'application installée.

### 2026-11-14 — `outil-trompeur` — `elementFromPoint` juste après le chargement
Interrogé avant la fin de la mise en page, il a renvoyé le conteneur de la carte pour tous les points, ce qui ressemblait à des zones de clic cassées. Elles étaient correctes.
**Garde-fou :** attendre la fin du rendu avant de mesurer ; recouper avec `elementsFromPoint`.

### 2026-11-14 — `outil-trompeur` — Captures rognées avec une taille de fenêtre émulée
Les captures ne montraient que le coin supérieur gauche de la page.
**Garde-fou :** ne pas émuler la taille ; fixer la taille de `#root` (510 × 300, ou 560 × 380 pour la palette). Voir `CLAUDE.md`.

### 2026-11-14 — `outil-trompeur` — Serveur de développement resté en vie
Arrêter la tâche qui a lancé Vite laisse le processus Node ouvert sous Windows ; le lancement suivant échoue sur le port 1420.
**Garde-fou :** `npm run dev:stop`.

### 2026-11-15 — `correction-humaine` — Recherche par catégorie trop large
Les mots de catégorie avaient été ajoutés au texte indexé : « on » ramenait tous les donjons, dans la palette et dans la fenêtre principale.
**Garde-fou :** `matchesCategory` (début de mot-clé, 2 lettres au moins) et tests dans `tests/searchRank.test.ts`.

### 2026-11-14 — `violation-principe` — Coche de copie superposée au repère de zone
Sur une carte à deux étapes, la coche recouvrait le « 1 » ou le « 2 ». Vu seulement à l'écran, aucun test ne pouvait le détecter.
**Garde-fou :** aucun test possible ; contrôle visuel obligatoire de tout changement de carte (voir `ui-da-pnj`).

### 2026-11-15 — `outil-trompeur` — Script en ligne cassé par les guillemets
Une longue commande avec un script Node en ligne et du texte français (apostrophes, accents graves) a échoué à l'analyse du shell.
**Garde-fou :** écrire le script dans un fichier temporaire, puis l'exécuter. Pas de script de plus de quelques lignes en ligne de commande.

### 2026-11-15 — `test-fragile` — Seuil de 50 ms de `palettePerf.test.ts` sous charge
Pendant l'issue n°12 (CSS seul), un `npm run check` a échoué une fois sur ce test (« requête … < 50 ms »), puis neuf passages consécutifs ont réussi. Cause : machine chargée par plusieurs worktrees qui testaient en parallèle, pas le code.
**Garde-fou :** aucun, à surveiller. Si cela se reproduit, mesurer une médiane sur plusieurs passes plutôt qu'un passage unique.

### 2026-11-15 — `outil-trompeur` — Worktrees parallèles : ports et cache Vite partagés
Le port choisi pour un second serveur Vite était déjà pris par une autre tâche, et Vite annonce « Re-optimizing dependencies because vite config has changed » : `node_modules` est un lien vers le même dossier, donc le cache `node_modules/.vite` est commun à tous les worktrees.
**Garde-fou :** aucun, à surveiller. Un port par tâche, fixé dans la consigne, avec `--strictPort`.

### 2026-11-14 — `non-vérifié` — Partie native jamais lancée
La palette, les raccourcis configurables, l'import d'images, l'ouverture du dossier de données et les mises à jour ont été écrits sans pouvoir être exécutés. La CI prouve qu'ils compilent.
**Garde-fou :** listes de tests manuels dans les commentaires de clôture des issues n°3, n°4, n°5 et n°6. À retirer d'ici quand l'utilisateur les aura déroulées.

### 2026-11-15 — `violation-principe` — Réécriture d'un fichier que l'on ne comprend qu'en partie
Première version du dictionnaire d'alias (issue n°10) : `aliases.json` était relu de façon tolérante puis réécrit en entier. Une entrée illisible par cette version, une clé inconnue dans une entrée ou une `schemaVersion` plus récente disparaissaient donc sans message à la première action. Trouvé en revue.
**Garde-fou :** `mergeUserAliases` conserve ce qu'il ne comprend pas, `aliasesFileProblem` interdit toute écriture sur un fichier d'une version plus récente ou d'une forme inattendue ; tests dans `tests/aliases.test.ts`. Règle à retenir pour tout nouveau fichier de données : lecture tolérante ne veut pas dire réécriture destructive.

### 2026-11-15 — `test-fragile` — Filtrer après avoir cherché annule la seconde passe
La reprise Farm par position cherchait dans tout le catalogue puis ne gardait que les parcours. La tolérance aux fautes ne se déclenchant que si la recherche exacte ne trouve rien, un PNJ au nom proche suffisait à l'empêcher. Trouvé en revue.
**Garde-fou :** `searchIndexRank` reçoit le filtre (`accept`) et l'applique AVANT de décider de la seconde passe ; tests dans `tests/searchIndex.test.ts` et `tests/paletteEntries.test.ts`.

### 2026-11-15 — `test-fragile` — Bandeau d'erreur jamais effacé quand on saute un rechargement
En ne revalidant plus le catalogue quand son texte n'a pas changé, la palette n'effaçait plus une erreur de chargement passagère. Trouvé en revue.
**Garde-fou :** deux états distincts dans `Palette.tsx` (erreur de lecture, effacée à chaque succès ; catalogue invalide, liée au texte du fichier). Aucun test : à contrôler sur l'application installée.

### 2026-11-15 — `non-vérifié` — Issue n°10 sur l'application installée
Le Rust (`store_file("aliases")`) n'a pas été compilé en local (bibliothèques système absentes) : validé par la CI. Non exécutés : écriture réelle de `aliases.json` et de son `.bak`, survie des alias à une mise à jour installée, palette devant le jeu avec un alias, rubrique « Alias » sous WebView2 et à 150 %.
**Garde-fou :** liste de tests manuels dans la description de la PR.

### 2026-11-15 — `outil-trompeur` — Chrome sans affichage se déclare `hover: none`
Toutes les règles `@media (hover: hover)` étaient ignorées : l'étoile apparaissait « toujours visible » alors que le CSS était correct. `Emulation.setEmulatedMedia` ne sait pas émuler `hover`. Pire, `page.setViewport` de puppeteer réinitialise le type de survol en cours de script.
**Garde-fou :** lancer Chrome avec `--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4`, vérifier `matchMedia('(hover: hover)')` avant chaque mesure, et changer d'échelle par `Emulation.setDeviceMetricsOverride` plutôt que `setViewport`. Survol d'un élément : `CSS.forcePseudoState`.

### 2026-11-15 — `violation-principe` — Captures AVANT écrasées
Le script de captures relancé avec l'étiquette `avant` après les modifications a remplacé l'état de référence. Rattrapé en remisant (`git stash`) le travail le temps de refaire les captures.
**Garde-fou :** aucun, à surveiller ; faire les captures AVANT dans un dossier à part et ne plus y écrire ensuite.

### 2026-11-15 — `violation-principe` — « Amener la carte à l'écran » ne fonctionnait pas
Après un enregistrement, la grille était déjà rendue avec la nouvelle destination quand `revealRef` était posé : l'effet qui fait défiler ne se relançait plus, la carte créée restait hors de l'écran (constaté sur `main` à 6 500 destinations, issue n°14). Aucun test ne le voyait.
**Garde-fou :** compteur `revealTick` qui relance l'effet ; le défilement est calculé (`scrollTopToReveal`, `tests/gridWindow.test.ts`) car la carte n'est plus forcément dans le DOM. Contrôle navigateur : `/home/claude/scratch/t14/create.mjs` (hors dépôt), à refaire dans tout changement de la grille.
