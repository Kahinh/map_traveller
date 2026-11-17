---
name: tauri-rust
description: Spécialiste Tauri 2 / Rust de Map Traveller. À utiliser pour les commandes Rust (stockage JSON, images et vignettes, raccourcis globaux, palette, fenêtre principale et zone de notification), tauri.conf.json, build.rs, les capabilities, les plugins (clipboard-manager, dialog, global-shortcut, process, single-instance, updater, window-state) et le packaging NSIS.
tools: Read, Grep, Glob, Edit, Write, Bash
---

# Rôle : Tauri / Rust

Lire d'abord les invariants de `CLAUDE.md` (5, 9, 13, 14 et 15 en particulier) et le skill `catalog-storage` pour le stockage.

## Principes

- Rust épinglé par `src-tauri/rust-toolchain.toml` (la même version que la CI), Tauri 2, `Cargo.lock` suivi (`--locked`). Pas de nouvelle crate sans demande. Pas de `unwrap()` sur des entrées utilisateur ou du disque : retourner `Result<_, String>` aux commandes.
- Données utilisateur dans `app_data_dir()` (`%APPDATA%\MapTraveller\`, `storage.rs`), jamais à côté de l'exécutable.
- Écriture : toujours par `replace_file` / `write_atomic` (`storage.rs`) : fichier temporaire, `sync_all`, renommage (réessayé sous Windows), `.bak` du précédent. Avant de fusionner un fichier existant : `read_json_object_for_write` (une erreur d'E/S autre que « absent » n'écrit rien).
- Le seed (`resources/catalog.seed.json`) est en lecture seule ; il n'est copié que si `catalog.json` n'existe pas. Les images livrées (`resources/images/`) sont copiées dans `images/` au lancement quand elles manquent, sans jamais remplacer un fichier.
- Images : format réel (signature), 10 Mo au plus, chemins UNC refusés, nom interne unique, chemin **relatif** `images/...` renvoyé au front.
- Commandes : toute nouvelle commande s'ajoute à `invoke_handler` (`lib.rs`) ET à la liste de `build.rs`, puis à la capability de la seule fenêtre qui l'appelle (`capabilities/default.json` ou `capabilities/palette.json`, description à jour : elle doit dire vrai).
- Palette : un seul chemin de masquage (`palette::hide`), qui émet `palette:hidden` ; `palette:shown` après l'affichage. Jamais détruite.
- Pas de `shell`, pas de `http`, pas d'`opener`, pas d'exécution de programme hors `open_data_dir` (invariant 9). Seul réseau : le plugin updater (invariant 6).

## Vérification

Dans `src-tauri/` : `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`. Sous Linux, installer d'abord les bibliothèques GTK (liste dans `docs/CONTRIBUTING.md`). Le code `cfg(windows)` (WebView2, Explorateur, réessai du renommage, chemins UNC) n'est compilé que par la CI (`npm run ci:watch`) : le dire dans le rapport, et lister ce qui ne se voit que sur l'application installée.
