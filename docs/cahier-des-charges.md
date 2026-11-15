# Map Traveller — Cahier des charges fonctionnel et technique V1.1

**Date :** 14 novembre 2026  
**Statut :** référence pour démarrer le développement après validation  
**Cible :** Windows 10/11 x64, usage personnel, application locale et hors ligne  
**Référence ergonomique :** capture PNJ fournie par l'utilisateur  
**Dépôt prévu :** `map-traveller` (GitHub public)

## 1. Vision et objectif

Créer une petite application Windows flottante et compacte, utilisable au-dessus du jeu en mode fenêtré/sans bordure. Elle présente une bibliothèque de cartes illustrées. L'utilisateur retrouve une destination, clique, puis colle manuellement dans le chat du jeu la commande déjà copiée dans le presse-papiers. Aucune saisie ou interaction automatique dans le jeu, aucune lecture mémoire ni injection.

Le produit est personnel : aucun compte, backend HTTP, serveur, cloud, SQLite ou Docker requis. Les destinations et commandes restent entièrement éditables dans l'application.

## 2. Périmètre de la V1

**Catégories actives :** PNJ, Donjons, Lieux-dits, Farm. Une vue « Tout » et une vue « Favoris » sont également disponibles. Le Farm est **inclus dès la V1**.

Fonctions obligatoires : recherche instantanée, cartes illustrées compactes, favoris, copie par clic gauche/droit pour destinations classiques, parcours Farm à reprise en un clic, création/modification/duplication/suppression de boutons, import d'images locales, sauvegarde JSON, import/export complet, fenêtre toujours au premier plan, raccourci global, installateur `.exe` compilé par GitHub Actions.

## 3. Direction artistique (DA) : inspiration PNJ

### 3.1 Principes visuels

S'inspirer **étroitement de la composition et de l'ergonomie de la capture fournie**, sans reprendre des ressources propriétaires sans autorisation : fenêtre sombre violet-ardoise, barre supérieure dégradée lavande, accent jaune-vert, cartes carrées très serrées, portraits occupant presque toute la carte, nom dans un bandeau sombre en bas, étoile de favori en coin, petites icônes et contours discrets.

**Valeurs de départ à ajuster à la capture lors de l'implémentation :**

| Élément | Spécification initiale |
|---|---|
| Fenêtre initiale | ~510 × 300 px, redimensionnable, coins arrondis si pris en charge |
| Fond principal | `#252739` |
| Barre de titre | Dégradé `#646392` vers `#4B4D77` |
| Cartes | ~90 × 90 px, option de densité ultérieure |
| Fond / bordure carte | `#393B58` / `#505273` |
| Rayon des cartes | 10–12 px |
| Texte principal / secondaire | `#F1F1FF` / `#B8B9D0` |
| Accent favori / sélection | `#E5F052` |
| Police | Segoe UI ou police système, lisible à petite taille |

La grille doit rester **dense**, sans grandes illustrations ni grandes marges. Images centrées et recadrées sans déformation, nom tronqué avec infobulle, survol discret, retour de copie par coche ou contour bref. Prévoir des états de chargement, d'image absente et de catalogue vide. La capture est une référence de DA, pas une extraction prouvée des styles internes de PNJ.

### 3.2 Disposition

Barre de titre personnalisée : icône, nom « Map Traveller », épingle toujours devant, paramètres, réduire/fermer. Sous la barre : recherche compacte, onglets Tout / PNJ / Donjons / Lieux-dits / Farm / Favoris, bouton `+` pour ajouter une destination, puis grille à défilement vertical. La largeur de la grille s'adapte à la fenêtre. L'édition doit être accessible sans détourner les clics gauche et droit réservés à la copie : bouton `+`, mode gestion, icône crayon uniquement en mode édition.

## 4. Règles des clics pour PNJ, Donjons et Lieux-dits

**Source de vérité :** le champ `command` du catalogue contient le texte saisi manuellement, dans l'ordre exact, sans reconstruction automatique à partir de coordonnées. Il peut comprendre plusieurs `/travel`.

**Clic gauche :** copier la commande **sans le `/zaap` initial**. Si la commande commence par `/zaap ...;`, retirer ce premier segment et le séparateur associé, puis conserver **exactement** la suite. Ne pas supprimer les autres segments, ne pas normaliser leurs espaces, ne pas réordonner. Si la commande ne commence pas par un Zaap, copier l'intégralité.

**Clic droit :** copier **l'intégralité** du champ `command`, Zaap initial compris. Empêcher le menu contextuel Windows/web par défaut sur la carte. Ne pas déclencher la copie du clic gauche en plus.

**Exemple fictif stocké :**

```text
/zaap 5 -18;/travel 1 1;/travel 2 2;/travel 3 3
```

- Clic gauche → `/travel 1 1;/travel 2 2;/travel 3 3`
- Clic droit → `/zaap 5 -18;/travel 1 1;/travel 2 2;/travel 3 3`

Les coordonnées illustrent la règle, elles ne sont pas des trajets vérifiés. Si le champ est vide, ne rien copier et montrer un avertissement discret. Une commande commençant par autre chose que `/zaap` reste intacte au clic gauche. L'éditeur peut afficher un aperçu des deux variantes.

**Implémentation prudente :** identifier uniquement le premier segment (jusqu'au premier `;`) et reconnaître `/zaap` avec une frontière de commande ; ne pas faire de remplacement global de la chaîne `/zaap`. Le comportement d'une commande multi-ligne ou contenant des commandes inhabituelles doit être testé ; ne jamais perdre du texte silencieusement.

## 5. Catégorie Farm : parcours à reprise immédiate

### 5.1 Ouverture

Une carte Farm dans la bibliothèque **n'effectue pas de copie directe** : un clic gauche ouvre une sous-fenêtre ou un panneau compact affichant toutes les étapes du parcours. Chaque étape est une **petite carte portant seulement les coordonnées** (par exemple `1,1`, `2,2`, `3,3`). Conserver la même DA compacte. Afficher le nom du parcours, une action Fermer/Retour et une action « Démarrer depuis le début ».

### 5.2 Règle fondamentale : un clic sur une étape = copie immédiate

Chaque carte représente la **dernière position déjà atteinte**, pas le premier déplacement à exécuter. **Dès le clic sur la carte d'une position, copier automatiquement les segments `/travel` strictement suivants** dans le presse-papiers. **Aucun second clic, bouton Copier, confirmation ou dialogue.** Laisser la fenêtre ouverte et afficher une coche temporaire non bloquante.

Parcours fictif stocké :

```text
/travel 1 1;/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6
```

| Clic sur la carte | Texte immédiatement copié |
|---|---|
| Démarrer depuis le début | `/travel 1 1;/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6` |
| `1,1` | `/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6` |
| `2,2` | `/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6` |
| `3,3` | `/travel 4 4;/travel 5 5;/travel 6 6` |
| `4,4` | `/travel 5 5;/travel 6 6` |
| `5,5` | `/travel 6 6` |
| `6,6` | Fin de parcours : aucune commande copiée ; signal discret |

L'utilisateur peut sélectionner n'importe quelle étape, dans n'importe quel ordre, autant de fois que nécessaire. **Pas de suivi automatique de position dans le jeu.** Les parcours avec coordonnées répétées sont pris en charge grâce à **l'indice d'étape**, jamais par recherche de la première occurrence des coordonnées.

### 5.3 Données et validation Farm

Conserver également **une commande brute manuelle** dans `command`. Pour afficher les étapes, l'application analyse les segments `/travel` séparés par `;` sans changer le texte original. Pour copier la suite, utiliser les segments originaux à partir de l'indice suivant, afin de préserver la saisie et l'ordre. Les coordonnées sont uniquement des libellés extraits pour l'affichage.

En V1, un parcours Farm est constitué de segments `/travel` valides ; l'éditeur valide cette règle et signale les segments non reconnus. **Si un Zaap initial est présent dans un parcours Farm**, le bouton « Démarrer depuis le début » peut copier la commande complète ; la reprise à partir d'une position copie uniquement les `/travel` ultérieurs. Ce cas doit être explicitement testé. Aucune suppression silencieuse d'étapes non reconnues. Pour éviter toute ambiguïté, l'éditeur doit afficher le nombre et l'ordre des étapes détectées.

**Clic droit sur une carte Farm de la bibliothèque :** même action que clic gauche (ouvrir le parcours) en V1 ; pas de copie de la commande complète par surprise. **Clic droit sur une étape Farm :** même action que clic gauche (copie de la suite) en V1. Ces choix peuvent être adaptés ultérieurement.

## 6. Gestionnaire intégré : créer, éditer et supprimer des boutons

### 6.1 Formulaire « Nouvelle destination »

Champs obligatoires :

1. **Nom / titre** de la carte (ex. « Abraknyde Ancestral »).
2. **Catégorie** : PNJ, Donjon, Lieu-dit ou Farm.
3. **Image** : sélection via un vrai dialogue Windows (`PNG`, `JPG/JPEG`, `WebP`), aperçu avant enregistrement, remplacement ou suppression possible ; image de substitution si non renseignée (l'image peut être facultative pour ne pas bloquer la création).
4. **Commande** : champ texte multiligne, saisi manuellement, nombre de `/travel` non limité artificiellement.

Champs facultatifs : zone, alias, tags, ordre d'affichage. Afficher un aperçu de la carte. Pour les catégories classiques, prévisualiser clic gauche / clic droit. Pour Farm, prévisualiser les positions reconnues et le nombre d'étapes.

### 6.2 Actions

Créer, modifier, dupliquer, supprimer (confirmation avant suppression), changer d'image, ajouter/retirer un favori. Les changements sont sauvegardés immédiatement sur disque et visibles dans la bibliothèque sans redémarrer. L'édition se fait via bouton dédié ou mode gestion ; ne pas intercepter les clics de copie.

### 6.3 Import des images

Au choix du fichier, l'application le **copie** dans le répertoire utilisateur de Map Traveller, par exemple `%APPDATA%\MapTraveller\images\`, avec un nom interne unique. Le JSON conserve un **chemin relatif** (`images/...`) et non le chemin du fichier source. Les images doivent rester disponibles après suppression ou déplacement de l'original, redémarrage ou mise à jour de l'application.

Prévoir contrôle de format réel, taille maximale configurable (valeur initiale indicative : 10 Mo), refus des fichiers invalides, traitement d'erreurs, conservation de l'image existante si le remplacement échoue. Redimensionner une copie pour l'affichage si utile, sans déformer. Les images orphelines peuvent être nettoyées par une fonction explicite, jamais par suppression hasardeuse. Ne pas exécuter de code embarqué ni charger automatiquement des URLs distantes.

## 7. Favoris, recherche et tri

Étoile en coin de carte, indépendante des clics de copie et d'ouverture. Les favoris sont enregistrés localement par identifiant stable. Vue Favoris mélange les catégories, y compris Farm. Recherche instantanée sur nom, alias, tags et zone, insensible à la casse et aux accents. Recherche de « vortex » → carte Vortex. Tri stable par `sortOrder` puis nom ; état vide explicite. Prévoir des performances correctes avec plusieurs milliers de destinations.

> **Addendum — recherche tolérante et dictionnaire d'alias (issue n°10).** La recherche de la fenêtre et de la palette ignore aussi la ponctuation, les tirets, les mots de liaison (sauf s'ils sont seuls) et l'ordre des mots ; elle déplie les ligatures (« coeur » trouve « Cœur »). Si rien ne correspond exactement, elle tolère une faute de frappe sur les mots de 4 lettres et plus ; un résultat approximatif n'apparaît jamais à côté d'un résultat exact. Un **dictionnaire global d'alias** remplace un mot de la requête par sa signification (`hdv` → « hôtel des ventes ») pour toutes les destinations : il se renseigne une seule fois, dans Paramètres › Alias, jamais carte par carte. Les alias livrés (`resources/aliases.default.json`) se désactivent ou se remplacent ; les personnalisations sont dans `aliases.json` et survivent aux mises à jour. Classement : coût par mot (nom, alias, tags et zone, catégorie, faute), somme sur la requête, puis favori, puis `sortOrder` et nom.

## 8. Catalogue JSON : schéma et stockage

### 8.1 Exemple de structure

```json
{
  "schemaVersion": 2,
  "destinations": [
    {
      "id": "abraknyde-ancestral",
      "name": "Abraknyde Ancestral",
      "category": "dungeon",
      "zone": "Forêt des Abraknydes",
      "aliases": [],
      "tags": ["boss"],
      "image": "images/abraknyde-ancestral.webp",
      "command": "/zaap 5 -18;/travel 1 1;/travel 2 2",
      "sortOrder": 10,
      "enabled": true
    },
    {
      "id": "circuit-bois",
      "name": "Circuit bois",
      "category": "farm",
      "zone": "Exemple fictif",
      "aliases": [],
      "tags": ["bois"],
      "image": "images/circuit-bois.webp",
      "command": "/travel 1 1;/travel 2 2;/travel 3 3;/travel 4 4;/travel 5 5;/travel 6 6",
      "sortOrder": 20,
      "enabled": true
    }
  ]
}
```

> **Addendum — schéma 3 (trajet en deux étapes).** Deux champs s'ajoutent à chaque destination : `twoStep` (booléen, `false` par défaut) et `command2` (texte brut, `""` par défaut). `twoStep: true` n'est autorisé que pour les catégories `npc` et `dungeon`. La carte affiche alors une seule image coupée par une diagonale du coin bas-gauche au coin haut-droit : le triangle haut-gauche copie `command` (étape 1 : accès), le triangle bas-droite copie `command2` (étape 2 : sur place), chacun avec les règles du §4 (clic gauche sans `/zaap` initial, clic droit complet). Les zones de clic sont les deux triangles, pas deux rectangles. Le passage entre les deux étapes (portail, PNJ, dimension) reste manuel. `command2` n'est jamais normalisée et reste conservée si `twoStep` est décoché. Un catalogue au schéma 2 est accepté tel quel, les champs absents prenant leur valeur par défaut. Exemple fictif : `"twoStep": true`, `"command": "/zaap 5 -18;/travel 1 1"`, `"command2": "/travel 2 2;/travel 3 3"`.

**Toutes les coordonnées sont fictives.** Les commandes sont des chaînes brutes saisies par l'utilisateur. L'application n'invente pas les trajets et ne déduit pas les Zaaps depuis les coordonnées. Les segments Farm sont analysés uniquement pour construire les cartes et découper la suite à copier.

### 8.2 Persistance

- Ressource `catalog.seed.json` livrée avec l'application : lecture seule.
- Au premier lancement, copie vers `%APPDATA%\MapTraveller\catalog.json`.
- `settings.json` pour paramètres et position de fenêtre ; `favorites.json` pour favoris, ou équivalent documenté.
- `images/` pour images personnalisées, chemins relatifs.
- Validation de schéma, identifiants uniques, catégories autorisées, sauvegarde atomique (fichier temporaire puis remplacement), `.bak` en cas de problème, restauration non destructive.
- **Import/export de sauvegarde complet** : archive ZIP contenant JSON, images, favoris et paramètres utiles. Prévoir import JSON seul pour données sans images, avec avertissement sur les images manquantes.
- Aucune mise à jour de l'application ne doit écraser le catalogue utilisateur.

## 9. Fenêtre et intégration Windows

Fenêtre flottante, redimensionnable, taille initiale ~510 × 300 px, minimum ~360 × 240 px. Option **toujours au premier plan**, activable/désactivable et mémorisée. Fonctionnement attendu avec le jeu en mode fenêtré / sans bordure ; le plein écran exclusif n'est pas garanti. Mémoriser dimensions et position, et restaurer sur un écran visible en cas de changement de configuration multi-moniteurs. Raccourci global configurable pour masquer/afficher (proposition `Ctrl+Alt+T`, à tester pour conflits). Instance unique : deuxième lancement réaffiche la fenêtre. Icône de notification facultative ; comportement de fermeture documenté. Faible consommation CPU au repos.

**Important :** copier ne colle jamais dans le jeu ; le joueur conserve le contrôle du collage manuel. Pas d'accès à la mémoire du jeu, pas de sniffing, pas d'automatisation de gameplay.

## 10. Architecture technique recommandée

- **Tauri 2** : application native Windows, fenêtres, packaging, permissions et plugins.
- **Rust stable** : opérations fichiers sûres, validation, gestion des ressources, intégration Windows et éventuelle instance unique.
- **React + TypeScript + Vite** : interface, navigation, recherche, formulaires, grille Farm.
- **CSS / Tailwind CSS** : design system dense inspiré de la capture ; tokens centralisés.
- **JSON local uniquement**, pas de SQLite, backend HTTP, cloud, compte ni télémétrie.
- Plugins Tauri selon besoin : clipboard-manager, dialog, global-shortcut, single-instance, fs/store, notification/tray si retenu ; permissions minimales.
- L'application fonctionne hors ligne. WebView2 est requis sur Windows et doit être géré/vérifié au packaging.

### Arborescence indicative

```text
map-traveller/
  .github/workflows/windows.yml
  src/
    app/
    components/          # CompactCard, SearchBar, CategoryTabs, WindowHeader
    features/catalog/    # CRUD, schéma, recherche, import/export
    features/farm/       # parsing, grille, reprise après étape
    features/favorites/
    features/settings/
    styles/              # tokens et DA
  src-tauri/
    src/                 # Rust : stockage, fenêtre, images, commandes
    capabilities/
    icons/
    tauri.conf.json
  resources/
    catalog.seed.json
    images/
  tests/
  README.md
  package.json
```

**Organisation du code :** séparer fonctions pures de traitement des commandes (clic gauche/droit et Farm), accès au presse-papiers, catalogue, composants UI et intégration Windows. Couvrir les fonctions de découpe par tests unitaires.

## 11. Compilation, GitHub et exécutable

- Dépôt public GitHub `map-traveller`.
- Workflow GitHub Actions `windows-latest` : installer Node.js et Rust, restaurer dépendances, lancer typecheck/lint/tests, puis `tauri build`.
- Générer un **installateur Windows NSIS `.exe`** versionné, par exemple `MapTraveller_1.0.0_x64-setup.exe`.
- Publier l'installateur comme artefact téléchargeable du workflow ; builds manuels (`workflow_dispatch`) et sur tags `v*`.
- En option, construire un **exécutable portable** (ou ZIP autonome) après test sur machine Windows propre ; distinguer clairement portable et installateur.
- L'utilisateur final ne doit installer ni Node.js ni Rust ni compiler lui-même.
- Signature de code non prévue pour l'usage personnel ; Windows SmartScreen peut afficher un avertissement pour un exécutable non signé. Ne pas contourner les protections.
- La compilation et les mises à jour conservent toutes les données utilisateur.

## 12. Sécurité, droits et fiabilité

Aucun service distant ni collecte de données. Les champs `command` sont du **texte brut** destiné au presse-papiers et ne sont jamais exécutés comme commandes système. Images locales validées. Éviter de redistribuer des portraits, icônes, styles ou du code de PNJ sans autorisation/licence ; utiliser l'application et la capture comme références ergonomiques. Ne pas supposer que l'analyse statique de l'exécutable fournit son code source ni tous ses styles. Ne pas faire de promesses sur l'acceptation des commandes par le jeu sans tests dans la version cible.

## 13. Tests d'acceptation obligatoires

1. Installation sur Windows 11 sans environnement de développement, lancement hors ligne.
2. Fenêtre compacte toujours au premier plan devant le jeu en mode fenêtré ; épingle activable.
3. Clic gauche sur une destination `/zaap ...;/travel A;/travel B` : copie exactement `/travel A;/travel B`.
4. Clic droit sur la même carte : copie exactement `/zaap ...;/travel A;/travel B` ; aucun menu contextuel parasite.
5. Destination sans Zaap : clic gauche et clic droit copient la même commande.
6. Destination contenant plusieurs `/travel` : aucun segment n'est perdu.
7. Carte Farm : un clic ouvre la grille de toutes les positions, dans l'ordre.
8. Farm : clic sur `3,3` copie immédiatement les étapes **après** `3,3` ; aucun second clic.
9. Farm : « Démarrer depuis le début » copie le parcours complet en un clic.
10. Farm : clic sur dernière étape ne copie rien et signale la fin.
11. Farm : coordonnées répétées ne perturbent pas le calcul de reprise (index d'étape).
12. Farm : parcours invalide signalé à l'édition ; pas de suppression silencieuse de segments.
13. Création d'un bouton avec nom, catégorie, image PNG/JPG/WebP et commande ; apparition immédiate.
14. Remplacement d'image : fichier copié dans les données de l'application ; image persistante après suppression du fichier original.
15. Modification, duplication, suppression et favoris persistants après redémarrage.
16. Recherche sans accents : « meriana » trouve « Mériana ».
17. Import JSON corrompu ne détruit pas le catalogue existant ; sauvegarde restaurable.
18. Export ZIP puis import sur un autre profil Windows restaure catalogue **et images**.
19. Une mise à jour de l'exécutable n'efface ni catalogue, ni images, ni favoris.
20. Build GitHub Actions produit un installateur NSIS `.exe` téléchargeable.
21. Interface lisible en mise à l'échelle Windows 100 % et 150 % et sur plusieurs moniteurs.

## 14. Livrables attendus du développement

1. Dépôt source complet, README d'installation, usage et architecture.
2. Interface Windows compacte conforme à la DA de référence, avec toutes les catégories.
3. Catalogue JSON d'exemple et éditeur intégré ; aucun trajet fictif présenté comme réel.
4. Import local d'images, copie et gestion robuste de fichiers.
5. Tests automatisés des clics gauche/droit et de la reprise Farm.
6. Workflow GitHub Actions et installateur `.exe` téléchargeable.
7. Documentation de sauvegarde/restauration JSON + images et procédure de mise à jour.

## 15. Décisions et questions résiduelles

**Décisions figées :** V1 locale, JSON, quatre catégories dont Farm, images importables, commandes manuelles, clic gauche sans Zaap initial, clic droit avec commande complète, Farm par sélection de la dernière position atteinte et copie immédiate des étapes suivantes, Tauri 2/Rust/React/TypeScript, GitHub Actions + `.exe`.

**Points non bloquants à ajuster pendant la réalisation :** raccourci global exact ; fermeture ou réduction en zone de notification ; icône/logo original ; source légitime des portraits ; choix d'une archive portable en plus de l'installateur ; comportement détaillé des commandes Farm non standard. **Ne pas inventer de trajets réels.**

---

**Instruction de lancement du développement :** « Implémente Map Traveller V1.1 selon ce cahier des charges, dans le dépôt GitHub public `map-traveller`. Commence par l'architecture et les tests des règles de copie, puis l'interface compacte et l'éditeur, puis le packaging Windows. »
