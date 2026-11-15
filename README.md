# Map Traveller

Petite application Windows **flottante et compacte**, à garder au-dessus du jeu (mode fenêtré ou sans bordure). Elle affiche une bibliothèque de cartes illustrées : un clic copie la commande `/travel` voulue dans le presse-papiers, il ne reste qu'à la **coller soi-même** dans le chat du jeu.

> L'application ne colle jamais rien dans le jeu. Elle ne lit pas sa mémoire, n'intercepte pas le réseau et n'automatise aucune action de jeu. Elle fonctionne hors ligne, sans compte ni télémétrie.

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

- **Recherche** : par nom, alias, tag, zone ou catégorie (« donjon … », « farm … »), sans accents ni majuscules. Le meilleur résultat est présélectionné ; sans texte, les favoris viennent en premier.
- **Carte à deux étapes** : une seule ligne, avec les cases **1** et **2** sur la ligne sélectionnée.
- **Parcours Farm** : le nom du parcours liste « parcours complet » puis chaque position. Le nom suivi d'une position reprend directement la suite : avec un parcours fictif « Tremble », `farm tremble 2 2` copie les étapes après `2,2`. Si le parcours repasse par la même position, une ligne par passage est proposée.
- **Limite** : la palette s'affiche devant le jeu en mode fenêtré ou sans bordure. En plein écran exclusif, Windows peut l'empêcher d'apparaître.

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

### Mettre à jour

1. Télécharger le nouveau `.exe` depuis la dernière Release.
2. Fermer Map Traveller, puis lancer l'installateur.

L'installateur remplace l'ancienne version sur place, sans désinstallation préalable. Le catalogue, les favoris, les images et les réglages sont conservés : ils sont dans `%APPDATA%\MapTraveller\`, que l'installateur ne touche pas.

## Données utilisateur

Tout est stocké dans `%APPDATA%\MapTraveller\` :

| Fichier | Contenu |
|---|---|
| `catalog.json` | vos destinations (éditable) |
| `catalog.json.bak` | version précédente, restaurable |
| `favorites.json` | identifiants des favoris |
| `settings.json` | préférences (premier plan…) |
| `images/` | images importées par le formulaire, renommées `img-….png/jpg/webp` (chemins relatifs dans le JSON) |

- Au premier lancement, le catalogue d'exemple (`resources/catalog.seed.json`) est copié dans ce dossier.
- Le catalogue est au **schéma 3**. Chaque destination peut porter `"twoStep": true` (PNJ et Donjons uniquement) et `"command2"` (commande de l'étape 2). Champs absents : `false` et `""`. `command2` est conservée même si `twoStep` vaut `false`. Un catalogue au schéma 2 est lu sans modification ; il est réécrit au schéma 3 à la prochaine sauvegarde.
- Une version **0.1.x** refuse un `catalog.json` au schéma 3 (« version plus récente que l'application ») **sans le modifier**. Revenir à une version antérieure demande donc de restaurer une sauvegarde au schéma 2.
- Les mises à jour **n'écrasent jamais** vos données.
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
  features/catalog/    # PUR — schéma, validation, recherche, tri, éditeur (editor.ts)
  lib/tauri/           # pont système : presse-papiers, stockage, fenêtre, images
  components/          # React : WindowHeader, CategoryTabs, CompactCard, Panel, FarmPanel, DestinationForm
  app/                 # App (état, câblage), useCatalog (chargement + enregistrement), useCopyFeedback
  styles/              # tokens.css (DA) + app.css
src-tauri/
  src/lib.rs           # plugins, raccourci global, instance unique
  src/storage.rs       # %APPDATA%\MapTraveller, écriture atomique + .bak
  src/images.rs        # import d'images : taille, format réel, copie sous nom unique
  capabilities/        # permissions minimales
  tauri.conf.json
resources/catalog.seed.json   # seed lecture seule (fictif)
tests/                        # Vitest
.github/workflows/windows.yml # CI + installateur
```

Principe : les règles de découpe des commandes sont des **fonctions pures**, sans dépendance à Tauri ni React. ESLint l'impose et Vitest les teste. Le Rust ne gère que les fichiers et l'intégration Windows.

**Stack :** Tauri 2 · Rust stable · React 19 · TypeScript · Vite · Vitest. JSON local uniquement : pas de SQLite, de serveur ni de cloud.

### CI / publication

`.github/workflows/windows.yml` s'exécute sur `windows-latest` : `npm ci` → typecheck → lint → tests → `cargo test` → `tauri build --bundles nsis`. L'installateur est publié en artefact.

Le workflow tourne sur push et PR vers `main`, en manuel (`workflow_dispatch`) et sur tag `v*`.

Un tag `vX.Y.Z` **publie en plus une Release GitHub** avec le `.exe` directement téléchargeable et des notes générées à partir des commits. Avant de construire, le workflow vérifie que le tag correspond à la version du code.

Pour publier une version :

```bash
npm run version:set -- 0.2.0     # écrit la version dans package.json, tauri.conf.json, Cargo.toml, package-lock.json
git commit -am "Version 0.2.0"
git tag v0.2.0
git push origin main v0.2.0      # la CI construit et publie la Release (~15–20 min)
```

`npm run version:set` sans argument affiche la version de chaque fichier.

### Outillage Claude Code

Le dossier `.claude/` contient le paramétrage du projet :

- **hooks** : blocage de l'édition des fichiers générés, typecheck après édition TS, sync CodeGraph au démarrage ;
- **skills** : `feature-delivery`, `bugfix-root-cause`, `copy-rules`, `catalog-storage`, `ui-da-pnj`, `ci-release-windows`, `codegraph-sync`, `commit-and-push-on-request` ;
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
- [ ] Rubriques Paramètres : mises à jour, dossier des données
- [ ] Validation sur Windows 11 propre, mise à l'échelle 100 % / 150 %, multi-écrans

## Licence et droits

Projet personnel. N'intègre aucune ressource propriétaire (images, icônes, styles, code) d'un jeu ou d'une application tierce : l'ergonomie de PNJ sert uniquement de référence.
