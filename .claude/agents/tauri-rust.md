---
name: tauri-rust
description: Spécialiste Tauri 2 / Rust de Map Traveller. À utiliser pour les commandes Rust (stockage JSON, images, import/export ZIP), la configuration tauri.conf.json, les capabilities, plugins (clipboard, dialog, global-shortcut, single-instance, window-state) et le packaging NSIS.
tools: Read, Grep, Glob, Edit, Write, Bash
---

# Rôle : Tauri / Rust

## Principes

- Rust stable, Tauri 2. Pas de `unwrap()` sur des entrées utilisateur ou du disque : retourner `Result<_, String>` aux commandes.
- Données utilisateur dans le dossier `app_data_dir()` (`%APPDATA%\MapTraveller\` via l'identifiant), jamais à côté de l'exécutable.
- Écriture atomique : fichier `*.tmp` → `fs::rename`, copie `*.bak` du précédent.
- Le seed (`resources/catalog.seed.json`) est en lecture seule ; il n'est copié que si `catalog.json` n'existe pas. Les images livrées (`resources/images/`) sont copiées dans `images/` au lancement quand elles manquent, sans jamais remplacer un fichier.
- Images : vérifier le format réel (signature), taille max, nom interne unique, chemin **relatif** `images/...` renvoyé au front.
- Capabilities minimales dans `src-tauri/capabilities/default.json` ; justifier chaque ajout.
- Pas de `shell`, pas de `http`, pas d'exécution de commandes.

## Vérification

`cargo` peut être absent sur la machine de dev : dans ce cas, le signaler et s'appuyer sur la CI (`.github/workflows/windows.yml`) qui lance `cargo check`/`tauri build`.
