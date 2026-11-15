---
name: ci-release-windows
description: Workflow GitHub Actions Windows, build Tauri, installateur NSIS .exe, versionnement et publication de Map Traveller. À utiliser pour toute modification de .github/workflows, de la version, de tauri.conf.json (bundle) ou pour diagnostiquer un build CI en échec.
---

# ci-release-windows

Source : cahier des charges §11.

## Workflow `.github/workflows/windows.yml`

- `windows-latest`, déclenché sur `push`/`pull_request` vers `main`, `workflow_dispatch` et tags `v*`.
- Étapes communes : Node LTS + cache npm → Rust stable + cache cargo → `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `cargo test`.
- Push `main`, PR et `workflow_dispatch` : `npx tauri build --bundles nsis`, **non signé, sans aucun secret**.
- Tag `v*` : `npx tauri build --bundles nsis --config src-tauri/tauri.release.conf.json`, avec `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` dans l'environnement de **cette étape seulement** ; puis `node scripts/make-latest-json.mjs prepare --tag vX.Y.Z` (vérifie la signature avec la clé publique, écrit `release/`).
- Artefact : `src-tauri/target/release/bundle/nsis/*.exe` (ex. `MapTraveller_1.0.0_x64-setup.exe`).
- Sur tag `v*` : vérification tag = version (`scripts/version.mjs --check`), puis **Release GitHub publiée** (non brouillon, `make_latest`) avec **trois fichiers** : `MapTraveller_X.Y.Z_x64-setup.exe`, sa signature `.exe.sig` et `latest.json` ; puis `node scripts/make-latest-json.mjs verify --tag vX.Y.Z`, qui relit l'index publié et retélécharge l'installateur.

## Versionnement

La version vit dans `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (+ `package-lock.json`). Ne jamais les éditer à la main : `npm run version:set -- X.Y.Z`.

## Règle : toute livraison poussée sur `main` est versionnée et taguée

Un simple push sur `main` lance un build de contrôle, mais **ne publie pas de `.exe`** : seul un tag `vX.Y.Z` crée la Release téléchargeable. Donc, chaque fois qu'un changement visible par l'utilisateur est poussé sur `main` (issue livrée, correctif), **terminer par une montée de version et un tag**, sans attendre qu'on le demande. La demande de pousser vaut demande de publier.

1. Choisir le numéro : **correctif** (`0.2.0` → `0.2.1`) pour un bug, **mineur** (`0.2.1` → `0.3.0`) pour une fonctionnalité, **majeur** pour une rupture (format de données non relisible, par exemple). Plusieurs issues livrées ensemble = une seule version.
2. `npm run version:set -- X.Y.Z`, puis commit dédié `Version X.Y.Z`.
3. `git tag vX.Y.Z` puis `git push origin main vX.Y.Z`.
4. Vérifier que le build du tag est vert et que la Release contient `MapTraveller_X.Y.Z_x64-setup.exe` (`gh release view vX.Y.Z`).

Cas particuliers :
- **Rust non compilé en local** (pas de `cargo`) : pousser d'abord `main` **sans tag**, attendre que le build soit vert, corriger si besoin, et seulement ensuite faire les étapes 2 à 4. Un tag sur un commit qui ne compile pas ne publie rien et oblige à retaguer.
- Changement sans effet sur l'application (documentation, `.claude/`, CI seule) : pas de nouvelle version.
- Ne jamais déplacer ni réutiliser un tag déjà publié : en cas d'erreur, publier le numéro suivant.
- Le commit et le push eux-mêmes restent soumis à la demande explicite de l'utilisateur (`commit-and-push-on-request`).

## Mises à jour

Plugin updater de Tauri, index `https://github.com/Kahinh/map_traveller/releases/latest/download/latest.json`, installation NSIS passive. Mode manuel par défaut, automatique au choix (Paramètres → Mises à jour). Les données `%APPDATA%\MapTraveller` sont conservées.

- **Un tag atteint directement les installations existantes** : proposé en mode manuel, installé sans question en mode automatique. Ne jamais taguer un commit dont le build `main` n'est pas vert.
- Clé publique dans `tauri.conf.json` (`plugins.updater.pubkey`) : ne jamais la modifier. Clé privée et mot de passe : uniquement dans les secrets GitHub, et une copie hors dépôt chez le propriétaire. Clé perdue = plus aucune mise à jour possible pour les installations existantes.
- Échec de l'étape « Préparer » (signature absente, mot de passe faux, clé qui ne correspond pas) : rien n'est publié. Faire corriger les secrets par le propriétaire, puis publier le numéro suivant.
- Échec de l'étape « Contrôler » alors que la Release est publique : supprimer `latest.json` de cette Release (l'application ne voit alors rien), puis publier le numéro suivant.
- Les versions 0.4.0 et antérieures n'ont pas le mécanisme : elles demandent une dernière installation manuelle.
- Ne jamais embarquer de jeton dans l'application.

## Diagnostic d'un échec

`npm run ci:watch` attend le build du commit courant et résume les étapes en échec et les erreurs de compilation (`npm run ci:watch -- <id>` pour un run précis). À défaut : `gh run list --limit 5` puis `gh run view <id> --log-failed`. Identifier l'étape, reproduire en local si possible (`npm run typecheck`, `npm test`), sinon corriger d'après le log Rust.

## Interdits

Pas de signature factice, pas de contournement SmartScreen, pas de secret en clair dans le workflow. Ne jamais afficher l'environnement d'une étape qui reçoit les secrets. Ne jamais activer `allowDowngrades`. Ne jamais déplacer un tag publié.
