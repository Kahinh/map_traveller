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

### Parcours Farm

Un clic sur une carte Farm ouvre le parcours : une petite carte par position (`1,1`, `2,2`…).

- **▶ Début** : copie le parcours complet.
- **Clic sur une position** : c'est la **dernière position atteinte**. La suite du parcours est copiée immédiatement, sans second clic.
- **Dernière position** : rien n'est copié, un message signale la fin du parcours.

La reprise se fait par **numéro d'étape**. Un parcours qui repasse par les mêmes coordonnées fonctionne donc correctement.

### Raccourcis

- `Ctrl+Alt+T` : afficher ou masquer la fenêtre (raccourci global).
- 📌 : activer ou désactiver « toujours au premier plan ». Le réglage est mémorisé.
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
| `images/` | images importées (chemins relatifs dans le JSON) |

- Au premier lancement, le catalogue d'exemple (`resources/catalog.seed.json`) est copié dans ce dossier.
- Les mises à jour **n'écrasent jamais** vos données.
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
npm test             # Vitest (règles de copie, Farm, catalogue)
npm run tauri build  # installateur NSIS local
```

`npm run dev` remplace le presse-papiers Tauri par `navigator.clipboard` et le stockage par `localStorage`. C'est pratique pour itérer sur l'interface.

### Architecture

```
src/
  features/commands/   # PUR — clic gauche / clic droit
  features/farm/       # PUR — parsing du parcours, reprise par indice
  features/catalog/    # PUR — schéma, validation, recherche, tri
  lib/tauri/           # pont système : presse-papiers, stockage, fenêtre, images
  components/          # React : WindowHeader, CategoryTabs, CompactCard, FarmPanel
  app/                 # App (état, câblage)
  styles/              # tokens.css (DA) + app.css
src-tauri/
  src/lib.rs           # plugins, raccourci global, instance unique
  src/storage.rs       # %APPDATA%\MapTraveller, écriture atomique + .bak
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
- [ ] Éditeur intégré : créer / modifier / dupliquer / supprimer, aperçu clic gauche/droit et étapes Farm
- [ ] Import d'images (dialogue Windows, contrôle du format, copie dans `images/`)
- [ ] Import / export ZIP complet, import JSON seul
- [ ] Raccourci global configurable, paramètres
- [ ] Validation sur Windows 11 propre, mise à l'échelle 100 % / 150 %, multi-écrans

## Licence et droits

Projet personnel. N'intègre aucune ressource propriétaire (images, icônes, styles, code) d'un jeu ou d'une application tierce : l'ergonomie de PNJ sert uniquement de référence.
