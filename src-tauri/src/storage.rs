//! Stockage local (CdC §8.2).
//!
//! Dossier : `%APPDATA%\MapTraveller\` (`catalog.json`, `favorites.json`, `settings.json`, `images/`).
//! - Le seed livré n'est copié que si `catalog.json` n'existe pas : une mise à jour
//!   n'écrase jamais les données utilisateur.
//! - Écriture atomique : `*.tmp` puis renommage ; copie `*.bak` de la version précédente.
//! - Le contenu est validé comme JSON avant écriture ; la validation métier est faite côté TS.
//! - `settings.json` a deux auteurs : l'interface (`save_store`) et Rust (`shortcuts::set_shortcut`).
//!   Les deux écritures passent par le même verrou, et la clé `shortcuts` n'appartient qu'à Rust :
//!   `save_store` la reprend toujours du fichier sur disque, jamais du contenu envoyé par l'interface.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, PoisonError};

use serde_json::{Map, Value};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const APP_DIR: &str = "MapTraveller";
const SEED_RESOURCE: &str = "resources/catalog.seed.json";

/// Nom du fichier de réglages dans le dossier de données.
pub const SETTINGS_FILE: &str = "settings.json";
/// Clé de `settings.json` réservée à Rust (raccourcis globaux).
pub const SHORTCUTS_KEY: &str = "shortcuts";

/// Sérialise les lectures-modifications-écritures de `settings.json`.
static SETTINGS_LOCK: Mutex<()> = Mutex::new(());

/// Prend le verrou de `settings.json`. Un verrou « empoisonné » (panique d'un autre
/// détenteur) est repris tel quel : il ne protège aucune donnée en mémoire.
pub fn lock_settings() -> MutexGuard<'static, ()> {
    SETTINGS_LOCK.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Objet JSON contenu dans `path`. Fichier absent, illisible ou qui n'est pas un objet :
/// objet vide (lecture tolérante, jamais d'erreur).
pub fn read_json_object(path: &Path) -> Map<String, Value> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(_) => return Map::new(),
    };
    match serde_json::from_str::<Value>(&text) {
        Ok(Value::Object(map)) => map,
        _ => Map::new(),
    }
}

/// Réglages envoyés par l'interface, dont la clé `shortcuts` est remplacée par celle du
/// fichier existant (ou retirée si le fichier n'en a pas). Renvoie le JSON à écrire.
pub fn settings_from_ui(incoming: Value, existing: Map<String, Value>) -> Result<String, String> {
    let mut settings = match incoming {
        Value::Object(map) => map,
        _ => return Err("Réglages invalides : un objet JSON est attendu, rien n'a été écrit.".to_string()),
    };
    settings.remove(SHORTCUTS_KEY);
    let mut existing = existing;
    if let Some(shortcuts) = existing.remove(SHORTCUTS_KEY) {
        settings.insert(SHORTCUTS_KEY.to_string(), shortcuts);
    }
    serde_json::to_string_pretty(&Value::Object(settings)).map_err(|e| format!("Réglages non sérialisables : {e}"))
}

/// Fichiers autorisés : aucun nom de fichier arbitraire n'est accepté depuis le front.
fn store_file(name: &str) -> Result<&'static str, String> {
    match name {
        "catalog" => Ok("catalog.json"),
        "favorites" => Ok("favorites.json"),
        "settings" => Ok(SETTINGS_FILE),
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
/// Pour `settings`, la clé `shortcuts` du fichier existant est conservée (voir l'en-tête).
#[tauri::command]
pub fn save_store(app: AppHandle, name: String, json: String) -> Result<(), String> {
    let value = serde_json::from_str::<Value>(&json).map_err(|e| format!("JSON invalide, rien n'a été écrit : {e}"))?;
    let file = store_file(&name)?;
    let path = app_data_dir(&app)?.join(file);
    if file == SETTINGS_FILE {
        let _guard = lock_settings();
        let merged = settings_from_ui(value, read_json_object(&path))?;
        return write_atomic(&path, &merged);
    }
    write_atomic(&path, &json)
}

/// Chemin absolu du dossier de données (utilisé pour afficher les images via `asset:`).
#[tauri::command]
pub fn data_dir(app: AppHandle) -> Result<String, String> {
    Ok(app_data_dir(&app)?.to_string_lossy().into_owned())
}

/// Ouvre l'Explorateur Windows sur le dossier de données (Paramètres › Données).
///
/// Aucun paramètre : le chemin est celui de `app_data_dir`, la fonction qui sert au stockage.
/// L'interface ne peut donc pas faire ouvrir un autre emplacement. Exception étroite et assumée
/// à la règle « pas d'exécution de programme » : programme fixe, argument calculé ici, aucune
/// entrée de l'utilisateur.
#[tauri::command]
pub fn open_data_dir(app: AppHandle) -> Result<(), String> {
    let dir = app_data_dir(&app)?;
    open_in_explorer(&dir)
}

/// Lance `explorer.exe <dossier>`. Le chemin est un argument distinct (jamais concaténé dans
/// une ligne de commande) : espaces et accents passent tels quels. `explorer.exe` renvoie
/// souvent un code de sortie non nul même quand il réussit : on ne l'attend pas et on n'en
/// lit pas le code ; seule une erreur de lancement est remontée.
#[cfg(windows)]
fn open_in_explorer(dir: &Path) -> Result<(), String> {
    // Chemin complet de l'Explorateur : un `explorer.exe` posé à côté de l'application ne doit
    // jamais être lancé à sa place (Windows cherche d'abord dans le dossier du programme).
    let explorer = std::env::var_os("SystemRoot")
        .map(|root| PathBuf::from(root).join("explorer.exe"))
        .unwrap_or_else(|| PathBuf::from("explorer.exe"));
    std::process::Command::new(explorer)
        .arg(dir)
        .spawn()
        .map(|_child| ())
        .map_err(|e| format!("Impossible d'ouvrir l'Explorateur Windows sur {} : {e}", dir.display()))
}

#[cfg(not(windows))]
fn open_in_explorer(dir: &Path) -> Result<(), String> {
    Err(format!(
        "Ouverture du dossier disponible uniquement sous Windows. Dossier des données : {}",
        dir.display()
    ))
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

    fn object(text: &str) -> Map<String, Value> {
        match serde_json::from_str::<Value>(text).unwrap() {
            Value::Object(map) => map,
            other => panic!("objet attendu : {other}"),
        }
    }

    #[test]
    fn ui_never_overwrites_shortcuts() {
        let incoming: Value =
            serde_json::from_str(r#"{"alwaysOnTop":false,"shortcuts":{"palette":"Ctrl+Alt+P"},"autre":1}"#).unwrap();
        let existing = object(r#"{"alwaysOnTop":true,"shortcuts":{"palette":"Ctrl+Alt+K","futur":"x"}}"#);
        let written: Value = serde_json::from_str(&settings_from_ui(incoming, existing).unwrap()).unwrap();
        assert_eq!(written["alwaysOnTop"], Value::Bool(false));
        assert_eq!(written["autre"], Value::from(1));
        assert_eq!(written["shortcuts"]["palette"], Value::from("Ctrl+Alt+K"));
        assert_eq!(written["shortcuts"]["futur"], Value::from("x"));
    }

    #[test]
    fn ui_shortcuts_are_dropped_when_file_has_none() {
        let incoming: Value = serde_json::from_str(r#"{"alwaysOnTop":true,"shortcuts":{"palette":"Ctrl+Alt+P"}}"#).unwrap();
        let written: Value = serde_json::from_str(&settings_from_ui(incoming, Map::new()).unwrap()).unwrap();
        assert!(written.get(SHORTCUTS_KEY).is_none());
        assert_eq!(written["alwaysOnTop"], Value::Bool(true));
    }

    #[test]
    fn ui_settings_must_be_an_object() {
        assert!(settings_from_ui(Value::from(3), Map::new()).is_err());
        assert!(settings_from_ui(Value::Null, Map::new()).is_err());
    }

    #[test]
    fn read_json_object_is_tolerant() {
        let dir = std::env::temp_dir().join(format!("map-traveller-settings-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        assert!(read_json_object(&dir.join("absent.json")).is_empty());
        let bad = dir.join("bad.json");
        fs::write(&bad, "{ pas du json").unwrap();
        assert!(read_json_object(&bad).is_empty());
        let list = dir.join("list.json");
        fs::write(&list, "[1, 2]").unwrap();
        assert!(read_json_object(&list).is_empty());
        let good = dir.join("good.json");
        fs::write(&good, r#"{"a":1}"#).unwrap();
        assert_eq!(read_json_object(&good).get("a"), Some(&Value::from(1)));
        let _ = fs::remove_dir_all(&dir);
    }

    #[cfg(not(windows))]
    #[test]
    fn open_in_explorer_is_refused_outside_windows() {
        let err = open_in_explorer(Path::new("/tmp/map-traveller")).unwrap_err();
        assert!(err.contains("uniquement sous Windows"));
    }
}
