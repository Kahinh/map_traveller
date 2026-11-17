---
name: ci-release-windows
description: Workflow GitHub Actions Windows, build Tauri, installateur NSIS .exe, versionnement et publication de Map Traveller. À utiliser pour toute modification de .github/workflows, de la version, de tauri.conf.json (bundle) ou pour diagnostiquer un build CI en échec.
---

# ci-release-windows

Procédure complète, clé de signature et cas d'échec : [docs/RELEASING.md](../../../docs/RELEASING.md). Ce skill en garde les règles.

## Workflow `.github/workflows/windows.yml`

- `windows-latest`, un seul job (`timeout-minutes: 45`), déclenché sur `push`/`pull_request` vers `main`, `workflow_dispatch` et tags `v*`. `permissions: contents: read` au niveau du workflow, `contents: write` au seul job (il publie sur tag).
- Actions épinglées par SHA complet (tag en commentaire) ; Dependabot (`.github/dependabot.yml`) propose chaque semaine une PR groupée par écosystème (actions, cargo, npm).
- Étapes communes : Node **22** + cache npm → Rust **1.97.0** (même version que `src-tauri/rust-toolchain.toml` : les changer ensemble) + `rust-cache` (écrit par `main` seulement) → sur tag, `scripts/version.mjs --check` → `npm ci` → `npm run check` (typecheck + lint + tests, un seul `tsc`) → `cargo fmt --check` → `cargo clippy --all-targets --locked -- -D warnings` → `cargo test --locked`.
- Push `main`, PR et `workflow_dispatch` : `npx tauri build --bundles nsis -- --locked` (`beforeBuildCommand` = `npm run build`, soit `vite build`), **non signé, sans aucun secret**.
- Tag `v*` : `npx tauri build --bundles nsis --config src-tauri/tauri.release.conf.json -- --locked`, avec `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` dans l'environnement de **cette étape seulement** ; puis `node scripts/make-latest-json.mjs prepare --tag vX.Y.Z` (vérifie la signature avec la clé publique, écrit `release/`).
- Puis `node scripts/bundle-budget.mjs` (budget du JS initial de chaque page), et l'artefact `src-tauri/target/release/bundle/nsis/*.exe` (ex. `MapTraveller_1.0.0_x64-setup.exe`).
- Sur tag `v*` : **Release GitHub publiée** (non brouillon, `make_latest`) avec **trois fichiers** : `MapTraveller_X.Y.Z_x64-setup.exe`, sa signature `.exe.sig` et `latest.json` ; puis `node scripts/make-latest-json.mjs verify --tag vX.Y.Z`, qui relit l'index publié et retélécharge l'installateur.

## Versionnement

La version vit dans `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` et `src-tauri/Cargo.lock` (paquet `map-traveller`). Ne jamais les éditer à la main : `npm run version:set -- X.Y.Z` ; `node scripts/version.mjs --check X.Y.Z` contrôle qu'ils concordent.

## Règle : toute livraison fusionnée dans `main` est versionnée et taguée

Un push sur `main` lance un build de contrôle, mais **ne publie pas de `.exe`** : seul un tag `vX.Y.Z` crée la Release téléchargeable, et un tag atteint aussitôt les installations existantes. Donc, quand un changement visible par l'utilisateur (issue livrée, correctif) a été **fusionné dans `main` et que le build de `main` est vert**, terminer par une montée de version et un tag. Le commit, le push et la publication restent soumis à la demande explicite de l'utilisateur (`commit-and-push-on-request`) : une demande de fusionner une livraison vaut demande de la publier, une demande de pousser une branche de travail non.

1. Choisir le numéro : **correctif** (`0.2.0` → `0.2.1`) pour un bug, **mineur** (`0.2.1` → `0.3.0`) pour une fonctionnalité, **majeur** pour une rupture (format de données non relisible, par exemple). Plusieurs issues livrées ensemble = une seule version.
2. Sur `main` à jour, après le build vert : `npm run version:set -- X.Y.Z`, puis commit dédié `Version X.Y.Z`.
3. `git tag vX.Y.Z` puis `git push origin main vX.Y.Z`.
4. Vérifier que le build du tag est vert et que la Release contient `MapTraveller_X.Y.Z_x64-setup.exe` (`gh release view vX.Y.Z`).

Cas particuliers :
- Le code `cfg(windows)` n'est compilé que par la CI (`cargo test` et `clippy` passent aussi sous Linux, voir CLAUDE.md) : c'est pourquoi le tag attend toujours le build vert de `main`. Un tag sur un commit qui ne compile pas ne publie rien et oblige à publier le numéro suivant.
- Changement sans effet sur l'application (documentation, `.claude/`, CI seule) : pas de nouvelle version.
- Ne jamais déplacer ni réutiliser un tag déjà publié : en cas d'erreur, publier le numéro suivant.

## Mises à jour

Plugin updater de Tauri, index `https://github.com/Kahinh/map_traveller/releases/latest/download/latest.json`, installation NSIS passive. Mode manuel par défaut, automatique au choix (Paramètres → Mises à jour). Les données `%APPDATA%\MapTraveller` sont conservées.

- **Un tag atteint directement les installations existantes** : proposé en mode manuel, installé sans question en mode automatique. Ne jamais taguer un commit dont le build `main` n'est pas vert.
- Clé publique dans `tauri.conf.json` (`plugins.updater.pubkey`) : ne jamais la modifier. Clé privée et mot de passe : uniquement dans les secrets GitHub, et une copie hors dépôt chez le propriétaire. Clé perdue = plus aucune mise à jour possible pour les installations existantes.
- Échec de l'étape « Build Tauri signé » ou « Préparer les fichiers de mise à jour » (signature absente, mot de passe faux, clé qui ne correspond pas) : rien n'est publié. Faire corriger les secrets par le propriétaire, puis publier le numéro suivant.
- Échec de l'étape « Contrôler la release publiée » alors que la Release est publique : supprimer `latest.json` de cette Release (l'application ne voit alors rien), puis publier le numéro suivant.
- Les versions 0.4.0 et antérieures n'ont pas le mécanisme : elles demandent une dernière installation manuelle.
- Ne jamais embarquer de jeton dans l'application.

## Diagnostic d'un échec

`npm run ci:watch` attend le build du commit courant et résume les étapes en échec et les erreurs de compilation (`npm run ci:watch -- <id>` pour un run précis). À défaut : `gh run list --limit 5` puis `gh run view <id> --log-failed`. Identifier l'étape, reproduire en local si possible (`npm run check`, `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test` sous Linux), sinon (code `cfg(windows)`) corriger d'après le log.

## Interdits

Pas de signature factice, pas de contournement SmartScreen, pas de secret en clair dans le workflow. Ne jamais afficher l'environnement d'une étape qui reçoit les secrets. Ne jamais activer `allowDowngrades`. Ne jamais déplacer un tag publié.
