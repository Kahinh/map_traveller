//! Stockage local (CdC §8.2).
//!
//! Dossier : `%APPDATA%\MapTraveller\` (`catalog.json`, `favorites.json`, `settings.json`, `images/`).
//! - Le seed livré n'est copié que si `catalog.json` n'existe pas : une mise à jour
//!   n'écrase jamais les données utilisateur.
//! - Écriture atomique : `*.tmp` puis renommage ; copie `*.bak` de la version précédente.
//! - Le contenu est validé comme JSON avant écriture ; la validation métier est faite côté TS.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const APP_DIR: &str = "MapTraveller";
const SEED_RESOURCE: &str = "resources/catalog.seed.json";

/// Fichiers autorisés : aucun nom de fichier arbitraire n'est accepté depuis le front.
fn store_file(name: &str) -> Result<&'static str, String> {
    match name {
        "catalog" => Ok("catalog.json"),
        "favorites" => Ok("favorites.json"),
        "settings" => Ok("settings.json"),
        other => Err(format!("Stockage inconnu : {other}")),
    }
}

/// `%APPDATA%\MapTraveller` (créé si besoin, avec `images/`).
pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .data_dir()
        .map_err(|e| format!("Dossier %APPDATA% introuvable : {e}"))?
        .join(APP_DIR);
    fs::create_dir_all(dir.join("images")).map_err(|e| format!("Création de {} impossible : {e}", dir.display()))?;
    Ok(dir)
}

/// Écrit `contents` dans `path` de façon atomique, en conservant l'ancienne version en `.bak`.
pub fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("Chemin invalide : {}", path.display()))?;
    let tmp = path.with_file_name(format!("{file_name}.tmp"));
    let bak = path.with_file_name(format!("{file_name}.bak"));

    fs::write(&tmp, contents).map_err(|e| format!("Écriture de {} impossible : {e}", tmp.display()))?;
    if path.exists() {
        fs::copy(path, &bak).map_err(|e| format!("Sauvegarde .bak impossible : {e}"))?;
    }
    // Sous Windows, `rename` remplace la cible existante (MoveFileEx + REPLACE_EXISTING).
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Remplacement de {} impossible : {e}", path.display())
    })
}

/// Premier lancement : copie le seed si aucun catalogue utilisateur n'existe.
pub fn ensure_initialized(app: &AppHandle) -> Result<(), String> {
    let dir = app_data_dir(app)?;
    let catalog = dir.join("catalog.json");
    if catalog.exists() {
        return Ok(());
    }
    let seed_path = app
        .path()
        .resolve(SEED_RESOURCE, BaseDirectory::Resource)
        .map_err(|e| format!("Seed introuvable : {e}"))?;
    let seed = fs::read_to_string(&seed_path).map_err(|e| format!("Lecture du seed impossible : {e}"))?;
    write_atomic(&catalog, &seed)
}

/// Contenu brut d'un fichier de stockage, ou `None` s'il n'existe pas encore.
#[tauri::command]
pub fn load_store(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let path = app_data_dir(&app)?.join(store_file(&name)?);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("Lecture de {} impossible : {e}", path.display()))
}

/// Enregistre un fichier de stockage après vérification que le contenu est du JSON valide.
#[tauri::command]
pub fn save_store(app: AppHandle, name: String, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("JSON invalide, rien n'a été écrit : {e}"))?;
    let path = app_data_dir(&app)?.join(store_file(&name)?);
    write_atomic(&path, &json)
}

/// Chemin absolu du dossier de données (utilisé pour afficher les images via `asset:`).
#[tauri::command]
pub fn data_dir(app: AppHandle) -> Result<String, String> {
    Ok(app_data_dir(&app)?.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_atomic_keeps_backup() {
        let dir = std::env::temp_dir().join(format!("map-traveller-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("catalog.json");
        write_atomic(&file, "{\"v\":1}").unwrap();
        write_atomic(&file, "{\"v\":2}").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "{\"v\":2}");
        assert_eq!(fs::read_to_string(dir.join("catalog.json.bak")).unwrap(), "{\"v\":1}");
        assert!(!dir.join("catalog.json.tmp").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn store_names_are_whitelisted() {
        assert!(store_file("catalog").is_ok());
        assert!(store_file("../secret").is_err());
    }
}
