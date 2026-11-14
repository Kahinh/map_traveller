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

La version vit dans `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (+ `package-lock.json`). Ne jamais les éditer à la main : `npm run version:set -- X.Y.Z`, commit, `git tag vX.Y.Z`, `git push origin main vX.Y.Z`. Tagger/pousser uniquement sur demande explicite de l'utilisateur.

## Mises à jour

Manuelles : l'utilisateur télécharge le nouvel installateur depuis la dernière Release ; NSIS met à jour sur place, les données `%APPDATA%\MapTraveller` sont conservées. Dépôt public : un auto-updater Tauri (plugin updater + `latest.json` signé dans la Release) est possible plus tard ; ne jamais embarquer de jeton dans l'app.

## Diagnostic d'un échec

`gh run list --limit 5` puis `gh run view <id> --log-failed`. Identifier l'étape, reproduire en local si possible (`npm run typecheck`, `npm test`), sinon corriger d'après le log Rust.

## Interdits

Pas de signature factice, pas de contournement SmartScreen, pas de secret en clair dans le workflow.
