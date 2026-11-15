# Map Traveller

Petite application Windows **flottante et compacte**, à garder au-dessus du jeu (mode fenêtré ou sans bordure). Elle affiche une bibliothèque de cartes illustrées : un clic copie la commande `/travel` voulue dans le presse-papiers, il ne reste qu'à la **coller soi-même** dans le chat du jeu.

> L'application ne colle jamais rien dans le jeu. Elle ne lit pas sa mémoire, n'intercepte pas le réseau et n'automatise aucune action de jeu. Elle fonctionne hors ligne, sans compte ni télémétrie. Sa seule connexion possible est la recherche de mises à jour auprès de GitHub : par défaut (mode manuel), elle n'a lieu que lorsque vous cliquez sur « Rechercher des mises à jour ». Voir [Mises à jour](#mises-à-jour).

Spécification complète : [docs/cahier-des-charges.md](docs/cahier-des-charges.md).

---

## Utilisation

### Destinations classiques (PNJ, Donjons, Lieux-dits)

| Action | Copie |
|---|---|
| **Clic gauche** | la commande **sans le `/zaap` initial** |
| **Clic droit** | la commande **complète**, Zaap compris |
| **☆ / ★** | ajoute ou retire des favoris (aucune copie) |

Exemple (coordonnées fictives) : `/zaap 5 -18;/travel 1 1;/travel 2 2`

- clic gauche → `/travel 1 1;/travel 2 2`
- clic droit → `/zaap 5 -18;/travel 1 1;/travel 2 2`

Seul le **premier** segment est retiré, et seulement s'il s'agit d'un `/zaap`. Le reste est copié exactement tel quel.

### Trajet en deux étapes (PNJ, Donjons)

Pour une destination qui demande un passage **manuel** par un portail ou un PNJ (par exemple l'entrée d'une dimension), une carte PNJ ou Donjon peut porter deux commandes. La carte garde une seule image, coupée par une diagonale du coin bas-gauche au coin haut-droit :

| Zone | Repère | Commande |
|---|---|---|
| triangle **haut-gauche** | « 1 » | étape 1 : accès (`command`) |
| triangle **bas-droite** | « 2 » | étape 2 : sur place (`command2`) |

Chaque zone suit la même règle que les cartes classiques, appliquée à sa propre commande : **clic gauche** sans le `/zaap` initial, **clic droit** complet. La copie est immédiate et la coche n'apparaît que sur la zone cliquée.

Exemple (coordonnées fictives) : étape 1 `/zaap 5 -18;/travel 1 1`, étape 2 `/travel 2 2;/travel 3 3`.

1. Clic sur la zone 1, coller dans le chat du jeu : trajet jusqu'à l'accès.
2. Franchir soi-même le portail ou parler au PNJ : l'application n'automatise pas ce passage.
3. Clic sur la zone 2, coller dans le chat du jeu : trajet sur place.

Ce que la commande `/travel` accepte de part et d'autre d'un passage est à vérifier en jeu. Le mode se règle dans le formulaire de la destination (case « Trajet en deux étapes », voir ci-dessous).

### Parcours Farm

Un clic sur une carte Farm ouvre le parcours : une petite carte par position (`1,1`, `2,2`…).

- **▶ Début** : copie le parcours complet.
- **Clic sur une position** : c'est la **dernière position atteinte**. La suite du parcours est copiée immédiatement, sans second clic.
- **Dernière position** : rien n'est copié, un message signale la fin du parcours.

La dernière position cliquée reste surlignée et les précédentes sont estompées, le temps de la session.

La reprise se fait par **numéro d'étape**. Un parcours qui repasse par les mêmes coordonnées fonctionne donc correctement.

### Créer et gérer ses destinations

- **`+`** (à droite des onglets) : ouvre le formulaire « Nouvelle destination ». Si un onglet de catégorie est actif, elle est présélectionnée.
- **Crayon** (à côté du `+`) : active le **mode gestion**. Un crayon apparaît sur chaque carte et ouvre son formulaire. Les clics gauche et droit des cartes **copient toujours**, dans ce mode comme en dehors. `Échap` quitte le mode gestion.

Le formulaire :

| Champ | Remarque |
|---|---|
| **Nom** | obligatoire |
| **Catégorie** | PNJ, Donjon, Lieu-dit ou Farm ; changer de catégorie n'efface rien |
| **Image** | facultative ; sans image, la carte affiche les initiales |
| **Trajet en deux étapes** | PNJ et Donjons uniquement, décoché par défaut ; affiche « Commande 1 » et « Commande 2 » |
| **Commande** | obligatoire, texte libre sur plusieurs lignes, **enregistré exactement tel que saisi** |
| **Plus d'options** | zone, alias et tags (séparés par des virgules), ordre d'affichage (entier, vide = 0) |

- L'**aperçu** sous la commande montre ce que copiera chaque clic (gauche / droit, et par étape pour une carte double). Pour un parcours Farm, il montre le nombre et l'ordre des positions reconnues, et signale tout segment non reconnu.
- **Enregistrer** (`Ctrl+Entrée`) écrit aussitôt sur le disque ; la carte apparaît dans la grille sans redémarrage.
- **Dupliquer** crée une copie (même image, mêmes commandes) ; **Supprimer** demande une confirmation. Supprimer une carte la retire aussi des favoris. Le fichier image n'est jamais supprimé.
- `Échap` ou **Annuler** ferme le formulaire ; s'il y a des modifications non enregistrées, une confirmation est demandée.
- Si l'enregistrement échoue, le formulaire reste ouvert avec le message d'erreur et rien n'est modifié.

**Images** (application installée uniquement) : le bouton « Choisir… » ouvre le dialogue Windows (PNG, JPEG, WebP, 10 Mo maximum). Le fichier est **copié** dans `images/` sous un nom interne ; l'original peut ensuite être déplacé ou supprimé. Le format réel du fichier est contrôlé : un fichier refusé ne remplace pas l'image existante. « Retirer » enlève l'image de la carte sans supprimer de fichier. Dans `npm run dev` (navigateur), l'import d'images est désactivé.

### Palette de recherche

`Ctrl+Alt+Espace`, depuis n'importe quelle fenêtre, ouvre une petite palette au centre de l'écran principal. On tape, on valide, la commande est dans le presse-papiers et la palette se referme. Rien n'est collé ni tapé dans le jeu.

| Touche | Effet |
|---|---|
| `↑` / `↓` | changer de ligne |
| `Entrée` ou clic | copier, comme un **clic gauche** (sans le `/zaap` initial) |
| `Ctrl+Entrée` ou clic droit | copier la commande **complète** |
| `←` / `→` | sur une carte à deux étapes, choisir l'étape 1 ou 2 |
| `Échap` | fermer sans copier |

- **Recherche** : par nom, alias, tag, zone ou catégorie (« donjon … », « farm … »). Elle ignore les accents, les majuscules, la ponctuation, les tirets, les mots de liaison (« de », « des », « du », « l' »… sauf s'ils sont seuls dans la recherche) et l'ordre des mots : `bijoutier bonta` et `bonta bijoutier` donnent le même résultat. Le meilleur résultat est présélectionné ; sans texte, les favoris viennent en premier.
- **Alias** : un acronyme du dictionnaire (`hdv` pour « hôtel des ventes ») trouve toutes les destinations concernées ; un mot de plus affine (`hdv bonta`). Voir [Paramètres](#paramètres).
- **Fautes de frappe** : si rien ne correspond exactement, la recherche tolère une faute (deux à partir de 8 lettres) sur les mots de 4 lettres et plus. Un résultat approximatif n'apparaît jamais quand un résultat exact existe.
- **Carte à deux étapes** : une seule ligne, avec les cases **1** et **2** sur la ligne sélectionnée.
- **Parcours Farm** : le nom du parcours liste « parcours complet » puis chaque position. Le nom suivi d'une position reprend directement la suite : avec un parcours fictif « Tremble », `farm tremble 2 2` copie les étapes après `2,2`. Si le parcours repasse par la même position, une ligne par passage est proposée.
- **Limite** : la palette s'affiche devant le jeu en mode fenêtré ou sans bordure. En plein écran exclusif, Windows peut l'empêcher d'apparaître.

### Paramètres

L'engrenage de la barre de titre ouvre les Paramètres. Chaque réglage est enregistré dès qu'il change.

- **Mises à jour** : la version installée, le mode, Manuel (par défaut : rien n'est contacté sans votre action) ou Automatique, et le bouton « Rechercher des mises à jour ». Détails dans [Mises à jour](#mises-à-jour).
- **Données** : l'emplacement réel de vos données, avec « Ouvrir le dossier » et « Copier le chemin ». Pour sauvegarder vos données, copiez ce dossier. Fermez l'application avant de modifier ces fichiers à la main.
- **Affichage** : toujours au premier plan (même réglage que l'épingle).
- **Alias** : le dictionnaire de la recherche, commun à la fenêtre et à la palette. Un alias remplace un mot de la recherche par sa signification, pour toutes les destinations : il se saisit **une seule fois** ici, pas carte par carte. Les alias fournis avec l'application (`hdv`, `rdv`) peuvent être désactivés ou remplacés ; les vôtres s'ajoutent, se modifient et se suppriment. Chaque ligne indique combien de destinations l'alias trouve.
- **Raccourcis** : les deux raccourcis globaux.

### Raccourcis

- `Ctrl+Alt+T` : afficher ou masquer la fenêtre (raccourci global).
- `Ctrl+Alt+Espace` : ouvrir ou fermer la palette de recherche (raccourci global).
- Les deux raccourcis globaux se règlent dans **Paramètres** (engrenage de la barre de titre) → Raccourcis : cliquer sur le champ, puis appuyer sur la combinaison voulue (Ctrl ou Alt, plus une lettre, un chiffre, F1 à F12 ou Espace). Si un raccourci est déjà pris par une autre application, l'ancien est conservé et un message l'indique.
- Épingle : activer ou désactiver « toujours au premier plan ». Le réglage est mémorisé.
- Taper directement du texte lance la recherche ; `Ctrl+F` y place le curseur.
- `Échap` : fermer le parcours Farm ouvert, sinon effacer la recherche, sinon quitter le mode gestion.
- Dans le formulaire : `Ctrl+Entrée` enregistre, `Échap` annule. La frappe directe vers la recherche est alors inactive.
- Relancer l'application réaffiche la fenêtre déjà ouverte (une seule instance).

---

## Installation (utilisateur)

1. Ouvrir la page **Releases** du dépôt (dernière version) et télécharger `MapTraveller_x.y.z_x64-setup.exe`.
   - Pour tester un build intermédiaire non publié, le `.exe` est aussi dans l'onglet **Actions** → run → *Artifacts*, mais zippé.
2. Lancer l'installateur. L'installation se fait pour l'utilisateur courant, sans droits administrateur.

Node.js et Rust ne sont pas nécessaires. Si WebView2 est absent, l'installateur le télécharge.

L'exécutable n'est pas signé : Windows SmartScreen peut afficher un avertissement (« Informations complémentaires » → « Exécuter quand même »).

### Mises à jour

> **Versions 0.4.0 et antérieures** : elles ne savent pas se mettre à jour seules. Installez une dernière fois la nouvelle version à la main (voir « Mise à jour manuelle » ci-dessous) ; les suivantes pourront se mettre à jour depuis l'application.

Le mode se choisit dans **Paramètres → Mises à jour** :

| Mode | Comportement |
|---|---|
| **Manuel** (par défaut) | Aucune connexion au lancement, aucune en arrière-plan : **rien ne part sans votre clic**. « Rechercher des mises à jour » indique si vous avez la dernière version ou propose la nouvelle avec « Installer et redémarrer » ; rien n'est téléchargé avant ce second clic. |
| **Automatique** | Quelques secondes après chaque lancement, une vérification a lieu. Si une nouvelle version existe, elle est téléchargée (indication discrète en bas de la fenêtre), puis installée, et l'application redémarre. Si un formulaire de destination est ouvert, l'installation attend sa fermeture. Sans réseau, ou si GitHub ne répond pas, rien ne s'affiche et l'application reste utilisable ; le résultat reste consultable dans les Paramètres. |

- **Ce qui est envoyé à GitHub** : une vérification est une simple requête HTTPS vers la page des Releases du dépôt (`latest.json`), suivie, s'il y a une nouvelle version et que vous l'installez, du téléchargement de l'installateur. GitHub voit votre adresse IP et le fichier demandé (l'index, puis l'installateur de la version annoncée), comme pour tout téléchargement, ainsi que l'en-tête technique standard du composant de mise à jour (son nom et sa version, pas ceux de l'application ni les vôtres). Aucun identifiant, aucune statistique, aucune donnée de votre catalogue n'est envoyé ; il n'y a pas de télémétrie.
- **Sécurité** : chaque installateur publié est signé. L'application vérifie cette signature avant d'installer et refuse un fichier non signé ou modifié ; rien n'est alors installé.
- **Installation** : l'installateur s'exécute en mode passif (une barre de progression, aucune question), puis relance l'application. Après le redémarrage, le message « Mise à jour X.Y.Z installée » s'affiche une fois.
- **Données** : le catalogue, les favoris, les images et les réglages sont conservés ; ils sont dans `%APPDATA%\MapTraveller\`, que l'installateur ne touche pas.
- Le système de mise à jour ne revient jamais à une version antérieure.
- L'installateur n'étant pas signé par un certificat Windows, SmartScreen ou l'antivirus peuvent réagir à son lancement.

#### Mise à jour manuelle

Toujours possible, quel que soit le mode, et seule possible depuis la 0.4.0 ou une version antérieure :

1. Télécharger le nouveau `.exe` depuis la dernière Release.
2. Fermer Map Traveller, puis lancer l'installateur.

L'installateur remplace l'ancienne version sur place, sans désinstallation préalable, et conserve vos données.

## Données utilisateur

Tout est stocké dans `%APPDATA%\MapTraveller\` :

| Fichier | Contenu |
|---|---|
| `catalog.json` | vos destinations (éditable) |
| `catalog.json.bak` | version précédente, restaurable |
| `favorites.json` | identifiants des favoris |
| `settings.json` | préférences (premier plan, raccourcis, mode de mise à jour et date de la dernière vérification…) |
| `aliases.json` | vos alias de recherche et les alias fournis que vous avez désactivés (créé à la première personnalisation). Ce que l'application ne comprend pas dans ce fichier est conservé tel quel ; un fichier illisible ou d'une version plus récente n'est jamais réécrit |
| `images/` | images importées par le formulaire, renommées `img-….png/jpg/webp` (chemins relatifs dans le JSON) |

- Windows contient aussi deux dossiers techniques nommés `app.maptraveller`, l'un dans `%APPDATA%` (position de la fenêtre), l'autre dans `%LOCALAPPDATA%` (cache de la vue web). Ils ne contiennent aucune donnée de l'utilisateur.
- Au premier lancement, le catalogue d'exemple (`resources/catalog.seed.json`) est copié dans ce dossier.
- Le catalogue est au **schéma 3**. Chaque destination peut porter `"twoStep": true` (PNJ et Donjons uniquement) et `"command2"` (commande de l'étape 2). Champs absents : `false` et `""`. `command2` est conservée même si `twoStep` vaut `false`. Un catalogue au schéma 2 est lu sans modification ; il est réécrit au schéma 3 à la prochaine sauvegarde.
- Une version **0.1.x** refuse un `catalog.json` au schéma 3 (« version plus récente que l'application ») **sans le modifier**. Revenir à une version antérieure demande donc de restaurer une sauvegarde au schéma 2.
- Les mises à jour **n'écrasent jamais** vos données. Les alias fournis avec l'application sont embarqués dans celle-ci et peuvent évoluer d'une version à l'autre ; vos alias personnalisés et vos désactivations, rangés dans `aliases.json`, ne sont jamais touchés.
- Une image retirée d'une carte, ou importée dans un formulaire annulé, reste dans `images/` : aucun fichier n'est supprimé automatiquement.
- Chaque écriture est atomique (fichier temporaire puis remplacement). La version précédente est gardée en `.bak`.
- **Sauvegarde manuelle :** copier tout le dossier `%APPDATA%\MapTraveller\`.
- **Restauration :** recopier ce dossier, application fermée.

L'import/export ZIP intégré est prévu, voir la feuille de route.

> Le catalogue livré ne contient que des **exemples fictifs**. Les vrais trajets sont à saisir vous-même.

---

## Développement

### Prérequis

- Node.js LTS (≥ 20) et npm
- [Rust stable](https://rustup.rs/) et les [prérequis Tauri pour Windows](https://tauri.app/start/prerequisites/) (MSVC Build Tools, WebView2) — uniquement pour lancer l'application native. L'UI et les tests fonctionnent sans Rust.

### Commandes

```bash
npm install          # dépendances
npm run help         # menu complet des commandes du dépôt
npm run check        # typecheck + lint + tests (check:full ajoute le build)
npm run dev          # UI seule dans le navigateur (http://localhost:1420)
npm run tauri dev    # application native complète (Rust requis)
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Vitest (règles de copie, Farm, catalogue, éditeur)
npm run tauri build  # installateur NSIS local
```

`npm run dev` remplace le presse-papiers Tauri par `navigator.clipboard` et le stockage par `localStorage`. C'est pratique pour itérer sur l'interface.

### Architecture

```
src/
  features/commands/   # PUR — clic gauche / clic droit, zones d'une carte (cardParts)
  features/farm/       # PUR — parsing du parcours, reprise par indice
  features/catalog/    # PUR — schéma, validation, éditeur (editor.ts), recherche : texte (searchText.ts), index et classement (searchIndex.ts), grille fenêtrée (gridWindow.ts)
  features/aliases/    # PUR — dictionnaire global d'alias de recherche (livrés + personnalisés)
  features/updates/    # PUR — machine à états des mises à jour, messages d'erreur, décisions au lancement
  lib/tauri/           # pont système : presse-papiers, stockage, fenêtre, images, mises à jour (updater.ts)
  components/          # React : WindowHeader, CategoryTabs, CompactCard, Panel, FarmPanel, DestinationForm
  app/                 # App (état, câblage), useCatalog (chargement + enregistrement), useAliases, useCopyFeedback, useUpdater, useGridWindow (rangées visibles seulement)
  styles/              # tokens.css (DA) + app.css
src-tauri/
  src/lib.rs           # plugins, raccourci global, instance unique
  src/storage.rs       # %APPDATA%\MapTraveller, écriture atomique + .bak
  src/images.rs        # import d'images : taille, format réel, copie sous nom unique
  capabilities/        # permissions minimales
  tauri.conf.json
  tauri.release.conf.json  # surcharge des builds de tag : fichiers de mise à jour signés
resources/catalog.seed.json   # seed lecture seule (fictif)
resources/aliases.default.json # alias de recherche livrés (lecture seule, embarqués dans l'interface)
scripts/make-latest-json.mjs  # latest.json + contrôles avant et après publication
tests/                        # Vitest
.github/workflows/windows.yml # CI + installateur
```

La grille ne crée que les rangées de cartes visibles, plus deux au-dessus et au-dessous : le nombre d'éléments dans la page ne dépend pas de la taille du catalogue. La touche Tab ne parcourt donc que les cartes présentes à l'écran.

Principe : les règles de découpe des commandes sont des **fonctions pures**, sans dépendance à Tauri ni React. ESLint l'impose et Vitest les teste. Le Rust ne gère que les fichiers et l'intégration Windows.

**Stack :** Tauri 2 · Rust stable · React 19 · TypeScript · Vite · Vitest. JSON local uniquement : pas de SQLite, de serveur ni de cloud. Seul accès réseau : la recherche et le téléchargement des mises à jour sur les Releases GitHub (plugins `updater` et `process` de Tauri).

### CI / publication

`.github/workflows/windows.yml` s'exécute sur `windows-latest` : `npm ci` → typecheck → lint → tests → `cargo test` → `tauri build --bundles nsis`. L'installateur est publié en artefact.

Le workflow tourne sur push et PR vers `main`, en manuel (`workflow_dispatch`) et sur tag `v*`.

Un tag `vX.Y.Z` **publie en plus une Release GitHub** avec le `.exe` directement téléchargeable, sa signature `.sig`, l'index `latest.json` des mises à jour et des notes générées à partir des commits. Avant de construire, le workflow vérifie que le tag correspond à la version du code ; après publication, il contrôle la Release (voir « Mises à jour automatiques »).

Pour publier une version :

```bash
npm run version:set -- 0.2.0     # écrit la version dans package.json, tauri.conf.json, Cargo.toml, package-lock.json
git commit -am "Version 0.2.0"
git tag v0.2.0
git push origin main v0.2.0      # la CI construit et publie la Release (~15–20 min)
```

`npm run version:set` sans argument affiche la version de chaque fichier.

### Mises à jour automatiques (mainteneur)

**Un tag atteint désormais les installations existantes** : toute Release publiée est proposée (mode manuel) ou installée sans question (mode automatique) chez les utilisateurs. Ne jamais taguer un commit dont le build `main` n'est pas vert.

**Clé de signature.** Les mises à jour sont signées par une clé propre à l'application (signature minisign de Tauri, gratuite, distincte d'un certificat Windows).

- La **clé publique** est dans `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Elle n'est pas secrète.
- La **clé privée** et son **mot de passe** sont uniquement dans les secrets GitHub Actions du dépôt (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) et dans une copie hors dépôt (gestionnaire de mots de passe du propriétaire). Ils ne sont jamais commités, jamais écrits dans un fichier du dépôt, jamais affichés dans un journal.
- **Clé perdue** : plus aucune mise à jour ne peut être signée pour les installations existantes. Il faut générer une nouvelle paire (`npx tauri signer generate`), mettre la nouvelle clé publique dans `tauri.conf.json`, publier, et prévenir les utilisateurs qu'une réinstallation manuelle est nécessaire. Il n'existe pas de rattrapage automatique.
- **Clé divulguée** : un tiers pourrait signer une fausse mise à jour, mais il lui faudrait aussi pouvoir publier dans les Releases du dépôt. Remplacer immédiatement la paire de clés (même procédure que la perte), remplacer les secrets, vérifier les accès au dépôt. Les installations existantes font confiance à l'ancienne clé publique jusqu'à leur réinstallation manuelle.
- Les builds de `main`, des pull requests et `workflow_dispatch` ne reçoivent pas les secrets et ne signent rien. Seul un tag `vX.Y.Z` lance le build signé (`--config src-tauri/tauri.release.conf.json`).

**Une Release contient trois fichiers** :

| Fichier | Rôle |
|---|---|
| `MapTraveller_X.Y.Z_x64-setup.exe` | l'installateur |
| `MapTraveller_X.Y.Z_x64-setup.exe.sig` | sa signature |
| `latest.json` | l'index lu par l'application, généré par `scripts/make-latest-json.mjs` |

L'application interroge `https://github.com/Kahinh/map_traveller/releases/latest/download/latest.json`, que GitHub redirige vers la dernière Release **stable** (ni brouillon, ni pré-version). `latest.json` pointe vers l'installateur de la Release du tag exact.

**Contrôles.** Avant publication, `make-latest-json.mjs prepare` vérifie la signature avec la clé publique de `tauri.conf.json` (comme l'application), le nom et la version de l'installateur, puis écrit `latest.json`. Après publication, `make-latest-json.mjs verify` relit `latest.json` depuis la Release du tag et depuis l'adresse de l'application, contrôle version, adresse et signature, et télécharge l'installateur publié pour revérifier sa signature. Si ce contrôle échoue, le run est rouge alors que la Release est publique : corriger aussitôt (voir ci-dessous).

**En cas d'échec.**

- *Signature absente ou refusée au build* (étape « Build Tauri signé » ou « Préparer ») : rien n'est publié. Vérifier que les deux secrets existent et correspondent à la clé publique, puis publier le numéro suivant (ne jamais déplacer un tag).
- *Contrôle après publication en échec* : supprimer `latest.json` de la Release fautive (l'application ne propose alors rien et n'affiche aucune erreur en mode automatique), ou repasser la Release en brouillon, puis publier le numéro suivant.
- Solution de secours toujours valable pour les utilisateurs : réinstaller à la main depuis la page des Releases.
- Si le dépôt redevient privé, les mises à jour cessent sans message en mode automatique.

**Protocole de test en deux versions** (machine Windows réelle ; rien de ceci n'est testable dans le navigateur) :

1. Publier une version **N** contenant le mécanisme ; l'installer à la main.
2. Mode manuel : « Rechercher » → « dernière version ». Vérifier qu'aucune requête ne part au lancement (Moniteur de ressources, ou lancement hors ligne).
3. Publier une version **N+1** (un simple correctif suffit).
4. Depuis N, en mode manuel : N+1 est proposée, l'installation aboutit, l'application redémarre en N+1 avec « Mise à jour N+1 installée » ; catalogue, images, favoris et réglages intacts.
5. Réinstaller N, passer en automatique, relancer : la mise à jour se fait seule. Recommencer avec un formulaire ouvert pendant le téléchargement : l'installation attend sa fermeture.
6. Erreurs : réseau coupé au lancement (aucun message, application utilisable) ; réseau coupé pendant le téléchargement (l'ancienne version reste en place) ; « Rechercher » hors ligne (message clair).
7. Noter le comportement de SmartScreen et de l'antivirus.

Ne présenter la fonction comme fiable qu'après l'étape 5.

### Outillage Claude Code

Le dossier `.claude/` contient le paramétrage du projet :

- **hooks** : blocage de l'édition des fichiers générés, typecheck après édition TS, sync CodeGraph au démarrage ;
- **skills** : `feature-delivery`, `bugfix-root-cause`, `copy-rules`, `catalog-storage`, `ui-da-pnj`, `ci-release-windows`, `codegraph-sync`, `commit-and-push-on-request`, `review-loop` ;
- **agents** : `architecte`, `implementation`, `reviewer`, `tauri-rust`, `ui-da`.

Les règles du projet sont dans [CLAUDE.md](CLAUDE.md). L'index [CodeGraph](https://www.npmjs.com/package/@colbymchenry/codegraph) (`.codegraph/`) est local à chaque machine (`codegraph init -i` pour le créer).

---

## Feuille de route V1

- [x] Règles de copie clic gauche / clic droit + tests
- [x] Parcours Farm (parsing, reprise par indice, fin de parcours) + tests
- [x] Schéma et validation du catalogue, recherche sans accents, tri, favoris
- [x] Interface compacte : barre de titre, recherche, onglets, grille, panneau Farm
- [x] Stockage Rust atomique + `.bak`, seed au premier lancement
- [x] Toujours au premier plan, raccourci global, instance unique, mémorisation de la position
- [x] Workflow GitHub Actions + installateur NSIS
- [x] Éditeur intégré : créer / modifier / dupliquer / supprimer, aperçu clic gauche/droit et étapes Farm
- [x] Import d'images (dialogue Windows, contrôle du format, copie dans `images/`)
- [ ] Vignettes réduites à l'import (images lourdes) et nettoyage explicite des images orphelines
- [ ] Import / export ZIP complet, import JSON seul
- [x] Palette de recherche globale (seconde fenêtre, reprise Farm par position, étapes 1 / 2)
- [x] Raccourcis globaux configurables, panneau Paramètres
- [x] Rubriques Paramètres : mises à jour (version, mode), dossier des données, affichage
- [x] Recherche tolérante (ordre des mots, mots de liaison, fautes de frappe) et dictionnaire global d'alias
- [ ] Mises à jour manuelles et automatiques depuis les Releases signées (livrées, à valider par le protocole en deux versions)
- [ ] Validation sur Windows 11 propre, mise à l'échelle 100 % / 150 %, multi-écrans

## Licence et droits

Projet personnel. N'intègre aucune ressource propriétaire (images, icônes, styles, code) d'un jeu ou d'une application tierce : l'ergonomie de PNJ sert uniquement de référence.
