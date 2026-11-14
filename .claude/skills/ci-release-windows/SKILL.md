---
name: ci-release-windows
description: Workflow GitHub Actions Windows, build Tauri, installateur NSIS .exe, versionnement et publication de Map Traveller. À utiliser pour toute modification de .github/workflows, de la version, de tauri.conf.json (bundle) ou pour diagnostiquer un build CI en échec.
---

# ci-release-windows

Source : cahier des charges §11.

## Workflow `.github/workflows/windows.yml`

- `windows-latest`, déclenché sur `push`/`pull_request` vers `main`, `workflow_dispatch` et tags `v*`.
- Étapes : Node LTS + cache npm → Rust stable + cache cargo → `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npx tauri build --bundles nsis`.
- Artefact : `src-tauri/target/release/bundle/nsis/*.exe` (ex. `MapTraveller_1.0.0_x64-setup.exe`).
- Sur tag `v*` : vérification tag = version (`scripts/version.mjs --check`), puis **Release GitHub publiée** (non brouillon, `make_latest`) avec le `.exe` et des notes générées.

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

Manuelles : l'utilisateur télécharge le nouvel installateur depuis la dernière Release ; NSIS met à jour sur place, les données `%APPDATA%\MapTraveller` sont conservées. Dépôt public : un auto-updater Tauri (plugin updater + `latest.json` signé dans la Release) est possible plus tard ; ne jamais embarquer de jeton dans l'app.

## Diagnostic d'un échec

`gh run list --limit 5` puis `gh run view <id> --log-failed`. Identifier l'étape, reproduire en local si possible (`npm run typecheck`, `npm test`), sinon corriger d'après le log Rust.

## Interdits

Pas de signature factice, pas de contournement SmartScreen, pas de secret en clair dans le workflow.
