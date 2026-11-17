# Contribuer à Map Traveller

Les règles du projet (invariants, architecture, où commencer, validation de l'interface) sont dans [CLAUDE.md](../CLAUDE.md), seule copie : ce document ne les répète pas, il dit comment installer, lancer et vérifier.

## Prérequis

- **Node.js 22** et npm (la version de la CI).
- **Rust** : la version est épinglée par `src-tauri/rust-toolchain.toml` (la même que la CI) ; avec [rustup](https://rustup.rs/), elle s'installe d'elle-même à la première commande `cargo` dans `src-tauri/`.
- **Windows** (application complète, `npm run tauri dev`) : les [prérequis Tauri](https://tauri.app/start/prerequisites/) (Microsoft C++ Build Tools, WebView2).
- **Linux** (pour `cargo test` et `cargo clippy` seulement ; l'application cible Windows) : les bibliothèques GTK et WebKit de Tauri, par exemple sous Debian ou Ubuntu :

  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
  ```

  Le code `cfg(windows)` (WebView2, Explorateur, réessai du renommage, chemins UNC) n'est compilé que par la CI.

L'interface et les tests Vitest fonctionnent sans Rust.

## Commandes

```bash
npm install          # dépendances
npm run help         # menu complet des commandes du dépôt, par intention
```

Préférer une cible du menu à une commande reconstruite : elles portent les bons arguments, et la CI lance les mêmes. Les principales :

| Moment | Commande |
|---|---|
| Pendant le travail | `npm run check` (typecheck + lint + tests) |
| Un seul fichier de test | `npm test -- tests/<fichier>.test.ts` |
| Avant de rendre la main | `npm run check:full` (ajoute le build des deux pages et le budget JS de chaque page) |
| Rust (dans `src-tauri/`) | `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` |
| Interface dans le navigateur | `npm run dev` (http://localhost:1420, palette : `/palette.html`), puis `npm run dev:stop` |
| Application complète (Windows) | `npm run tauri dev` |
| Après un push | `npm run ci:watch` (attend le build GitHub et résume ses erreurs) |

Dans le navigateur (`npm run dev`), le presse-papiers passe par `navigator.clipboard` et le stockage par `localStorage` ; ce qui n'existe que dans l'application installée (import d'images, dossier de données, raccourcis, mises à jour) affiche « Disponible dans l'application installée ». Pour contrôler un changement visuel, suivre « Validation de l'interface » de CLAUDE.md.

## Principes

- **Fonctions pures d'abord.** Les règles de copie, le parcours Farm, la recherche, le catalogue, les réglages et les décisions de la palette sont des fonctions pures dans `src/features/`, sans import Tauri ni React (ESLint l'impose), testées par Vitest. Les composants React ne font que le rendu et les interactions ; le Rust ne gère que les fichiers et l'intégration Windows.
- **Tests d'abord** pour toute logique pure modifiée ou tout bug corrigé, avec des **coordonnées fictives**.
- **Données des utilisateurs** : aucun changement de format sans monter `schemaVersion` ; tout fichier réécrit conserve ce qu'il ne comprend pas.
- Français pour la documentation, les textes de l'interface et les messages de commit.

Arborescence commentée : [CLAUDE.md, « Architecture »](../CLAUDE.md#architecture).

## Intégration continue

`.github/workflows/windows.yml` tourne sur `windows-latest` pour chaque push et pull request vers `main`, en manuel et sur tag `v*` : `npm ci`, `npm run check`, `cargo fmt --check`, `cargo clippy`, `cargo test`, build de l'installateur NSIS (`--locked`), budget JS, artefact téléchargeable. Les actions sont épinglées par SHA ; Dependabot propose chaque semaine une mise à jour groupée par écosystème (actions, cargo, npm). Publication d'une version : [RELEASING.md](RELEASING.md).

## Régénérer le catalogue livré

`resources/catalog.seed.json` et `resources/images/` sont **générés** : ne jamais les éditer à la main (un hook Claude Code le bloque). Pour changer une entrée, changer le générateur.

1. Télécharger, depuis la publication citée en tête de `scripts/catalog/build-official-catalog.mjs` (dépôt dofus-sqlite), les fichiers JSON listés dans ce même en-tête, dans un dossier à part, et les archives `images-*.zip`.
2. `node scripts/catalog/build-official-catalog.mjs <dossier> <manifeste-images.json>` : écrit le catalogue et la liste des images à convertir.
3. `python -I scripts/catalog/convert-images.py <manifeste-images.json> <dossier des archives> resources/images` (Pillow requis) : WebP de 256 px au plus.
4. `npm run check` : `tests/officialCatalog.test.ts` recalcule chaque commande (zaap le plus proche puis `/travel`). Les identifiants `officiel-…` ne doivent jamais changer : une entrée supprimée par un utilisateur reviendrait.

Le référentiel des zaaps (`resources/zaaps.json`) n'est pas généré : une entrée ne s'y ajoute qu'avec sa source.

## Outillage Claude Code

Le dossier `.claude/` paramètre Claude Code pour ce dépôt ; [AGENTS.md](../AGENTS.md) est le point d'entrée de tout agent.

- **Skills** (`.claude/skills/`) : une procédure par domaine (règles de copie, stockage, DA, CI et publication, correction de bug, livraison de fonctionnalité, boucle de revue, commit, CodeGraph, `unslop` pour le design).
- **Agents** (`.claude/agents/`) : `architecte` (cadrage, lecture seule) → `implementation` → `reviewer` (lecture seule) ; spécialistes `tauri-rust` et `ui-da`.
- **Hooks** (`.claude/hooks/`, CommonJS : `.claude/package.json`) : blocage de l'édition des fichiers générés (lockfiles, builds, catalogue livré), typecheck après l'édition d'un fichier TypeScript, synchronisation CodeGraph au démarrage.
- **Plugins** activés dans `.claude/settings.json` : `frontend-design`, `code-review`, `code-simplifier`, `typescript-lsp`.
- **CodeGraph** : index local du code (`.codegraph/`, configuration `.codegraph/config.json` : TypeScript, JavaScript, Rust), à créer sur chaque machine (`codegraph init -i`) ; skill `codegraph-sync`.
- **Frictions passées** : [agent-notes.md](agent-notes.md) ; contrôles manuels avant publication : [recette-v1.md](recette-v1.md).
