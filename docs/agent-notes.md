# Notes d'agent — erreurs transformées en garde-fous

Ce fichier garde la trace des frictions rencontrées pendant le développement, pour qu'elles ne se perdent pas à la fin d'une session. Une note seule ne suffit pas : **une erreur vue deux fois devient un test, un script, un hook ou une règle**, et la note pointe alors vers ce garde-fou.

## Comment l'utiliser

- **Avant une tâche** : lire « Principes » et les notes de la zone concernée.
- **En fin de tâche** : ajouter une note pour chaque friction réelle (une correction demandée par l'utilisateur, une erreur découverte en revue, un outil qui a menti). Ne pas noter le bruit : ce qui existait avant et n'a pas été causé par la tâche n'a pas sa place ici.
- **Format d'une note** : date, étiquette, ce qui s'est passé, le garde-fou mis en place (ou « aucun, à surveiller »). Notes de la plus récente à la plus ancienne.
- **Étiquettes** (liste fermée) : `violation-principe`, `duplication`, `test-fragile`, `correction-humaine`, `outil-trompeur`, `non-vérifié`.
- Ce qui reste à contrôler à la main sur Windows ne s'accumule pas ici : l'ajouter à [recette-v1.md](recette-v1.md), et ne garder ici que la note qui l'explique.
- Les « Principes » ne se modifient pas : on en ajoute. Un principe n'entre ici qu'après accord de l'utilisateur.

## Principes

1. **Ce qui n'a pas été observé n'est pas vérifié.** Un build vert prouve que le code compile, pas qu'il fonctionne. Tout rapport sépare « vérifié » de « non vérifié » et dit comment vérifier le reste.
2. **Le code Windows se valide par la CI.** `cargo test` et `cargo clippy` passent en local sous Linux (voir CLAUDE.md), mais le code `cfg(windows)` n'est compilé que par la CI : fusionner dans `main` sans tag, attendre le build (`npm run ci:watch`), corriger, et seulement ensuite taguer. *(Reformulé le 17/11/2026 : la version d'origine, « sans `cargo` en local », supposait le Rust impossible à compiler hors CI ; voir la note du 17/11 « cargo ne compile pas en local ».)*
3. **Un tag atteint les utilisateurs.** Depuis les mises à jour automatiques, taguer revient à déployer. Jamais sur un build non vérifié.
4. **Une règle de copie n'existe qu'à un seul endroit.** Toute nouvelle surface (carte, palette, aperçu) appelle les fonctions pures existantes.
5. **Le texte d'une commande ne se touche pas.** Ni `trim`, ni normalisation, ni reconstruction.
6. **La géométrie, les couleurs et les chemins ont une seule source** : variables `--mt-zone-*`, `tokens.css`, `app_data_dir()`.

## Notes

### 2026-11-17 — `correction-humaine` — Palette ouverte au-dessus du centre de l'écran
`center_on_primary` centrait la fenêtre comme si elle avait sa hauteur maximale (430 px) : la barre seule (48 px) apparaissait environ 190 px au-dessus du centre. L'utilisateur la veut centrée. C'est désormais la barre qui est centrée ; les résultats se développent vers le bas, la barre ne bouge pas.
**Garde-fou :** position non testable hors Windows ; à contrôler sur l'application installée.

### 2026-11-17 — `outil-trompeur` — Requête média ignorée avec `#root` fixé (revue finale)
Les onglets à 360 px restaient coupés au contrôle : `#root` était fixé à 360 dans une page de 900 de large, et `@media (max-width: 439px)` suit la largeur de la page, pas celle de `#root`. Dans l'application, fenêtre et page ont la même largeur.
**Garde-fou :** pour une règle `@media` de largeur, régler aussi la largeur de la page du navigateur de contrôle (hauteur libre), en plus de `#root`.

### 2026-11-17 — `outil-trompeur` — Vitest vide les feuilles de style, `?raw` compris
Le test de contrat (`tests/tauriContract.test.ts`) lisait `palette.css?raw` et recevait une chaîne vide : Vitest remplace toute feuille de style par un module vide. Les fichiers Rust, eux, se lisent bien par `?raw`.
**Garde-fou :** le test lit la feuille sur le disque (`node:fs` par import dynamique) ; commentaire en tête du test.

### 2026-11-17 — `non-vérifié` — Palette instantanée (issue n°24)
Ordre, acronymes, décision d'Entrée et collisions d'alias sont couverts par des tests ; la rafale `rdv` + `Entrée` et la réindexation par `store:changed` ont été contrôlées dans le navigateur (Chrome, fallback `BroadcastChannel`). Ni l'émission réelle de `store:changed` par Rust vers une WebView2 masquée (`SetIsVisible(false)`), ni les temps sous Windows n'ont été observés ; les chiffres de `docs/perf-palette.md` sont des mesures Node.
**Garde-fou :** section « Palette instantanée » de [recette-v1.md](recette-v1.md) ; `npm run bench:palette` ; `tests/palettePerf.test.ts`.

### 2026-11-17 — `violation-principe` — Revue V1.0 : cinq défauts que les tests ne voyaient pas
Une revue en six volets avant la 1.0 (lots A à F) a trouvé, entre autres :
- **Favoris écrasables** : un `favorites.json` illisible était lu comme vide, et le premier clic sur une étoile le remplaçait. **Règle :** tout fichier réécrit par l'interface passe par `createWriteGate` (`src/lib/writeGate.ts`) : rien avant la fin de la lecture, rien si elle a échoué, disque avant l'état ; `storeRead.ts` distingue « absent » de « lecture échouée ». Tests dans `tests/persistence.test.ts`.
- **Écriture non durable** : le fichier temporaire était renommé sans `sync_all`, et le `.bak` copié par un autre chemin ; une coupure de courant pouvait laisser un fichier vide. **Règle :** une seule fonction d'écriture en Rust (`replace_file` / `write_atomic`, `storage.rs`) : temporaire, `sync_all`, renommage réessayé sous Windows ; lecture stricte avant fusion (`read_json_object_for_write`).
- **Palette remise à zéro trop tard** : à la réouverture, la première image montrait l'ancienne requête et une hauteur parasite partait vers Rust. **Règle :** remise à zéro sur `palette:hidden` (fenêtre cachée), décision de hauteur pure et testée (`src/features/palette/windowHeight.ts`).
- **Recherche qui construisait toutes les lignes** : la palette fabriquait jusqu'à 6 000 lignes pour en garder 50. **Règle :** `searchPalette` s'arrête au plafond ; un test compte les appels à `cardParts` (`tests/palettePerf.test.ts`).
- **Reprise Farm qui perdait des segments** : `farmResumeCommand` recollait les seuls `/travel`, un segment non reconnu entre deux étapes disparaissait (invariant 1). **Règle :** la reprise découpe le texte brut à la fin du segment (`FarmStep.end`) ; tests de segment inconnu, d'espaces et de `;` final dans `tests/farmRoute.test.ts`.
Contrôles manuels restants : [recette-v1.md](recette-v1.md).

### 2026-11-17 — `outil-trompeur` — Les hooks Claude Code ne tournaient pas
En relisant `.claude/hooks/` (lot F de la revue V1.0) : les hooks sont écrits en CommonJS (`require`) alors que le dépôt est en `"type": "module"`. Node refusait de les charger et sortait en erreur non bloquante : le blocage des fichiers générés, le typecheck après édition et la synchronisation CodeGraph n'ont jamais fonctionné, sans que rien ne le signale.
**Garde-fou :** `.claude/package.json` (`"type": "commonjs"`) ; tester un hook en lui passant une entrée à la main (`echo '{"tool_input":{"file_path":"/x/resources/catalog.seed.json"}}' | node .claude/hooks/guard-generated.js`, code de sortie 2 attendu).

### 2026-11-17 — `violation-principe` — Champ « Alias » de 210 px au lieu de 88 (lot E de la revue V1.0)
Contrôle dans le navigateur : `.aliases__term` avait `flex: 0 0 88px` mais mesurait 210 px, ce qui tronquait l'indication du champ voisin (« …séparées par des vi »). Cause : un `input` élément flexible garde sa largeur intrinsèque comme minimum (`min-width: auto`).
**Garde-fou :** tout champ de saisie à base flexible reçoit `min-width: 0` ; mesurer la largeur réelle (`getBoundingClientRect`), pas seulement le style déclaré.

### 2026-11-17 — `non-vérifié` — Catalogue livré : images et ajout aux catalogues existants (issue n°8)
Le navigateur de développement lit les images dans `resources/` : il ne prouve ni la copie au lancement (`copy_missing_images`), ni le protocole `asset:`. Les commandes générées ne sont pas testées en jeu : le zaap le plus proche « à vol d'oiseau » peut être de l'autre côté de la mer (ex. Château Ensablé, zaap de Pandala).
**Garde-fou :** section « Installation et données » de [recette-v1.md](recette-v1.md) ; avertissement dans le README.

### 2026-11-17 — `violation-principe` — Noms de cartes coupés avant le lieu (issue n°8)
Contrôle dans le navigateur : « Atelier des alchimistes · Bonta » tronqué sur deux lignes, le lieu disparaissait et vingt cartes semblaient identiques. Corrigé dans le générateur : le métier puis le lieu (« Alchimiste · Bonta »), le nom complet en alias.
**Garde-fou :** pour un nom fabriqué, mettre ce qui distingue au début.

### 2026-11-17 — `test-fragile` — `palettePerf.test.ts`, troisième occurrence
Issue n°8 (catalogue livré, aucun code de recherche touché) : `npm run check:full` a échoué sur « requête «  » < 50 ms » (53 ms) ; lancé seul, le fichier passe.
**Garde-fou :** depuis la revue V1.0 (lot C), les tests de performance comptent des appels (déterministes) au lieu de se fier au seul temps. Si un seuil de temps échoue encore, mesurer une médiane sur plusieurs passes.

### 2026-11-17 — `outil-trompeur` — « cargo ne compile pas en local » n'était pas une fatalité
Les notes précédentes concluaient que le Rust ne pouvait pas être compilé dans le conteneur (bibliothèques système absentes). Il suffit de les installer (liste dans [CONTRIBUTING.md](CONTRIBUTING.md)), puis `cargo test` et `cargo clippy` passent dans `src-tauri/` (sous Linux : le code `cfg(windows)` reste vérifié par la CI seulement).
**Garde-fou :** règle unique dans CLAUDE.md (« Commandes ») et principe 2. Tenter l'installation avant de déclarer le Rust « non compilé ».

### 2026-11-17 — `non-vérifié` — Palette : étapes en lignes et variantes avec / sans Zaap (issue n°11)
Vérifié dans Chrome (`palette.html`, catalogue de contrôle) : « temple » donne deux lignes, cases sur la ligne sélectionnée avec Zaap seulement, ←/→ changent l'aperçu et le pied, Entrée et Ctrl+Entrée copient les bonnes variantes, réglage « Avec Zaap » enregistré puis relu par la palette, nom long tronqué avec « — Étape N » visible.
**Garde-fou :** le reste (palette devant le jeu, réglage relu par la palette installée) est dans [recette-v1.md](recette-v1.md).

### 2026-11-17 — `non-vérifié` — Zaap le plus proche (n°7) et vignettes (n°14, A4)
Vérifié : tests Vitest et Rust ; palette dans Chrome (`proche -20,-20`, saisie incomplète ou invalide dans la barre, hauteur 48 / 204 px, pied d'aide) ; chaîne `createImageBitmap` → `OffscreenCanvas` → WebP 256 × 256 dans Chrome.
**Garde-fou :** coordonnées des 48 zaaps non vérifiées en jeu (source citée dans `resources/zaaps.json`) ; vignettes sous WebView2 dans [recette-v1.md](recette-v1.md).

### 2026-11-16 — `correction-humaine` — Refonte lancée dans une direction déjà refusée
Une refonte « surfaces neutres sombres », dictée par un skill de design appliqué à la lettre, contredisait la décision de l'auteur (palette violette conservée, écrite dans l'issue n°13). Elle a été arrêtée et jetée.
**Garde-fou :** section « Fondations » de `ui-da-pnj` et note d'usage de `unslop` (`SOURCE.md`) ; avant tout travail de design, lire l'issue de design en cours et faire `git fetch` : une autre session livre des PR en parallèle.

### 2026-11-16 — `outil-trompeur` — `dev:stop` ne voyait pas le serveur
`npm run dev:stop` répondait « Aucun serveur sur le port 1420 » alors que Vite tournait : il interrogeait `netstat -p TCP`, qui ne liste que l'IPv4, et Vite écoute en IPv6 (`[::1]:1420`). Découvert parce qu'un dossier restait verrouillé par ce serveur oublié.
**Garde-fou :** `listeningPids` lit IPv4 et IPv6, et reconnaît l'écoute à l'adresse distante nulle plutôt qu'au mot « LISTENING » ; testé dans `tests/devStop.test.ts`, et vérifié sur un vrai serveur.

### 2026-11-16 — `test-fragile` — Seuils de `palettePerf.test.ts`, deuxième occurrence
Lot 2 de l'issue n°13 (apparence et textes seulement) : `npm run check:full` a échoué trois fois de suite sur « requête « vilel123 » < 50 ms » (53 à 69 ms) et une fois sur « construction de l'index < 300 ms » (334 ms). Lancé seul, le fichier passe ; toute la suite passe avec `vitest run --no-file-parallelism`. Cause : fichiers testés en parallèle avec d'autres worktrees actifs.
**Garde-fou :** voir la troisième occurrence (17/11).

### 2026-11-16 — `non-vérifié` — Palette à hauteur dynamique (issue n°19)
La hauteur du contenu est vérifiée dans le navigateur (48 px pour la barre seule, 124 px pour une ligne, 404 px pour une liste pleine, un seul changement par variation réelle). Le redimensionnement de la FENÊTRE (`set_palette_height`) ne s'observe que sur l'application installée.
**Garde-fou :** `clamp_height` testé en Rust ; si `set_size` est refusé, l'erreur est journalisée et la fenêtre garde sa taille ; contrôles dans [recette-v1.md](recette-v1.md).

### 2026-11-15 — `correction-humaine` — Recherche par catégorie trop large
Les mots de catégorie avaient été ajoutés au texte indexé : « on » ramenait tous les donjons, dans la palette et dans la fenêtre principale.
**Garde-fou :** `categoriesForWord` (début de mot-clé, 2 lettres au moins) et tests dans `tests/searchIndex.test.ts`.

### 2026-11-15 — `outil-trompeur` — Script en ligne cassé par les guillemets
Une longue commande avec un script Node en ligne et du texte français (apostrophes, accents graves) a échoué à l'analyse du shell.
**Garde-fou :** écrire le script dans un fichier temporaire, puis l'exécuter. Pas de script de plus de quelques lignes en ligne de commande.

### 2026-11-15 — `test-fragile` — Seuil de 50 ms de `palettePerf.test.ts` sous charge
Pendant l'issue n°12 (CSS seul), un `npm run check` a échoué une fois sur ce test, puis neuf passages consécutifs ont réussi. Cause : machine chargée par plusieurs worktrees, pas le code.
**Garde-fou :** voir la troisième occurrence (17/11).

### 2026-11-15 — `outil-trompeur` — Worktrees parallèles : ports et cache Vite partagés
Le port choisi pour un second serveur Vite était déjà pris par une autre tâche, et Vite annonce « Re-optimizing dependencies because vite config has changed » : `node_modules` est un lien vers le même dossier, donc le cache `node_modules/.vite` est commun à tous les worktrees.
**Garde-fou :** aucun, à surveiller. Un port par tâche, fixé dans la consigne, avec `--strictPort`.

### 2026-11-15 — `violation-principe` — Réécriture d'un fichier que l'on ne comprend qu'en partie
Première version du dictionnaire d'alias (issue n°10) : `aliases.json` était relu de façon tolérante puis réécrit en entier. Une entrée illisible, une clé inconnue ou une `schemaVersion` plus récente disparaissaient donc sans message à la première action. Trouvé en revue.
**Garde-fou :** `mergeUserAliases` conserve ce qu'il ne comprend pas, `aliasesFileProblem` interdit toute écriture sur un fichier d'une version plus récente ou d'une forme inattendue ; tests dans `tests/aliases.test.ts`. Règle pour tout nouveau fichier de données : lecture tolérante ne veut pas dire réécriture destructive.

### 2026-11-15 — `test-fragile` — Filtrer après avoir cherché annule la seconde passe
La reprise Farm par position cherchait dans tout le catalogue puis ne gardait que les parcours. La tolérance aux fautes ne se déclenchant que si la recherche exacte ne trouve rien, un PNJ au nom proche suffisait à l'empêcher. Trouvé en revue ; la même erreur est revenue dans le filtre des onglets (revue V1.0, lot B).
**Garde-fou :** `searchIndexRank` et `searchIndexMatch` reçoivent le filtre (`accept`) et l'appliquent AVANT de décider de la seconde passe ; tests dans `tests/searchIndex.test.ts` et `tests/paletteEntries.test.ts`.

### 2026-11-15 — `test-fragile` — Bandeau d'erreur jamais effacé quand on saute un rechargement
En ne revalidant plus le catalogue quand son texte n'a pas changé, la palette n'effaçait plus une erreur de chargement passagère. Trouvé en revue.
**Garde-fou :** deux états distincts dans `Palette.tsx` (erreur de lecture, effacée à chaque succès ; catalogue invalide, liée au contenu du fichier). Aucun test : à contrôler sur l'application installée.

### 2026-11-15 — `outil-trompeur` — Chrome sans affichage se déclare `hover: none`
Toutes les règles `@media (hover: hover)` étaient ignorées : l'étoile apparaissait « toujours visible » alors que le CSS était correct. `Emulation.setEmulatedMedia` ne sait pas émuler `hover`, et `page.setViewport` de puppeteer réinitialise le type de survol en cours de script.
**Garde-fou :** lancer Chrome avec `--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4`, vérifier `matchMedia('(hover: hover)')` avant chaque mesure, et changer d'échelle par `Emulation.setDeviceMetricsOverride` plutôt que `setViewport`. Survol d'un élément : `CSS.forcePseudoState`.

### 2026-11-15 — `violation-principe` — Captures AVANT écrasées
Le script de captures relancé avec l'étiquette `avant` après les modifications a remplacé l'état de référence. Rattrapé en remisant (`git stash`) le travail le temps de refaire les captures.
**Garde-fou :** aucun, à surveiller ; faire les captures AVANT dans un dossier à part et ne plus y écrire ensuite.

### 2026-11-15 — `non-vérifié` — Zone de notification et palette préchargée (issue n°14)
`main_window.rs`, `tray.rs`, `palette.rs` et `lib.rs` ont été écrits sans pouvoir être exécutés ; ils sont depuis compilés et testés (CI, et `cargo test` sous Linux), mais leur comportement réel ne se voit que sous Windows.
**Garde-fou :** section « Zone de notification » de [recette-v1.md](recette-v1.md).

### 2026-11-14 — `outil-trompeur` — Le survol simulé ne déclenche pas `:hover`
L'outil de navigateur a déplacé le pointeur sans que la page voie un survol : les captures montraient un état normal. La surbrillance de l'issue n°2 a été contrôlée en forçant l'état par une feuille de style de test.
**Garde-fou :** section « Validation de l'interface » de `CLAUDE.md` (forcer l'état, ou lire `getComputedStyle`). Le survol réel reste à confirmer sur l'application installée.

### 2026-11-14 — `outil-trompeur` — `elementFromPoint` juste après le chargement
Interrogé avant la fin de la mise en page, il a renvoyé le conteneur de la carte pour tous les points, ce qui ressemblait à des zones de clic cassées. Elles étaient correctes.
**Garde-fou :** attendre la fin du rendu avant de mesurer ; recouper avec `elementsFromPoint`.

### 2026-11-14 — `outil-trompeur` — Captures rognées avec une taille de fenêtre émulée
Les captures ne montraient que le coin supérieur gauche de la page.
**Garde-fou :** ne pas émuler la taille ; fixer la taille de `#root` (510 × 300 ; palette : largeur 560). Voir `CLAUDE.md`.

### 2026-11-14 — `outil-trompeur` — Serveur de développement resté en vie
Arrêter la tâche qui a lancé Vite laisse le processus Node ouvert sous Windows ; le lancement suivant échoue sur le port 1420.
**Garde-fou :** `npm run dev:stop`.

### 2026-11-14 — `violation-principe` — Coche de copie superposée au repère de zone
Sur une carte à deux étapes, la coche recouvrait le « 1 » ou le « 2 ». Vu seulement à l'écran, aucun test ne pouvait le détecter.
**Garde-fou :** aucun test possible ; contrôle visuel obligatoire de tout changement de carte (voir `ui-da-pnj`).

### 2026-11-14 — `non-vérifié` — Partie native jamais lancée
La palette, les raccourcis configurables, l'import d'images, l'ouverture du dossier de données et les mises à jour ont été écrits sans pouvoir être exécutés. La CI prouve qu'ils compilent.
**Garde-fou :** [recette-v1.md](recette-v1.md), à dérouler avant la 1.0.
