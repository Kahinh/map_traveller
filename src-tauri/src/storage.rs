//! Stockage local (CdC §8.2).
//!
//! Dossier : `%APPDATA%\MapTraveller\` (`catalog.json`, `favorites.json`, `settings.json`,
//! `aliases.json`, `images/`).
//! - Le seed livré n'est copié que si `catalog.json` n'existe pas : une mise à jour
//!   n'écrase jamais les données utilisateur. Les entrées livrées absentes d'un catalogue
//!   existant y sont ajoutées par l'interface (`src/features/catalog/official.ts`).
//! - Images du catalogue livré (`resources/images/`) : copiées dans `images/` à chaque lancement
//!   quand elles y manquent (absentes ou vides) ; un fichier non vide n'est jamais remplacé.
//! - Écriture atomique et durable (`replace_file`) : `*.tmp` écrit puis synchronisé sur le disque,
//!   puis renommé ; copie `*.bak` de la version précédente par le même chemin (`write_atomic`).
//! - Les commandes s'exécutent hors du fil principal (`#[tauri::command(async)]`) : une écriture
//!   lente ne gèle ni les fenêtres ni les raccourcis globaux. Chaque fichier de stockage a donc son
//!   verrou (`Store::lock`), le `.tmp` ayant un nom fixe. Un seul verrou est tenu à la fois (aucun
//!   interblocage possible) ; celui de `settings.json` est `SETTINGS_LOCK`, partagé avec Rust.
//! - Lecture avant réécriture (`read_json_object_for_write`) : une erreur d'E/S autre que
//!   « fichier absent » n'écrit rien, pour ne jamais remplacer un fichier qu'on n'a pas pu lire.
//! - Le contenu est validé comme JSON avant écriture ; la validation métier est faite côté TS.
//! - `settings.json` a deux auteurs : l'interface (`save_store`) et Rust (`shortcuts::set_shortcut`).
//!   Les deux écritures passent par le même verrou, et la clé `shortcuts` n'appartient qu'à Rust :
//!   `save_store` la reprend toujours du fichier sur disque, jamais du contenu envoyé par l'interface.
//! - Après chaque `save_store` réussi, `store:changed` est émis vers la seule palette : elle relit
//!   le fichier et reconstruit son index pendant qu'elle est masquée (issue n°24).

use std::fs::{self, File};
use std::io::{self, ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};
use std::time::Duration;

use serde_json::{Map, Value};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};

use crate::farm_window::FARM_LABEL;
use crate::palette::PALETTE_LABEL;

const APP_DIR: &str = "MapTraveller";
const SEED_RESOURCE: &str = "resources/catalog.seed.json";
const IMAGES_RESOURCE: &str = "resources/images";

/// Nom du fichier de réglages dans le dossier de données.
pub const SETTINGS_FILE: &str = "settings.json";
/// Clé de `settings.json` réservée à Rust (raccourcis globaux).
pub const SHORTCUTS_KEY: &str = "shortcuts";
/// Événement émis vers la palette après chaque `save_store` réussi, avec le nom du stockage
/// écrit (`catalog`, `aliases`…) ; écouté par `onStoreChanged` (`src/lib/tauri/palette.ts`).
pub const STORE_CHANGED_EVENT: &str = "store:changed";

/// Sérialise les lectures-modifications-écritures de `settings.json` (interface et raccourcis).
static SETTINGS_LOCK: Mutex<()> = Mutex::new(());
/// Verrous des autres fichiers de stockage, un par fichier (voir `store`).
static CATALOG_LOCK: Mutex<()> = Mutex::new(());
static FAVORITES_LOCK: Mutex<()> = Mutex::new(());
static ALIASES_LOCK: Mutex<()> = Mutex::new(());
static OFFICIAL_LOCK: Mutex<()> = Mutex::new(());

/// Prend `lock`. Un verrou « empoisonné » (panique d'un autre détenteur) est repris tel quel :
/// il ne protège aucune donnée en mémoire, seulement l'accès au fichier.
fn acquire(lock: &'static Mutex<()>) -> MutexGuard<'static, ()> {
    lock.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Prend le verrou de `settings.json`.
pub fn lock_settings() -> MutexGuard<'static, ()> {
    acquire(&SETTINGS_LOCK)
}

/// Objet JSON contenu dans `bytes` ; objet vide si ce n'est pas du JSON ou pas un objet.
pub fn parse_json_object(bytes: &[u8]) -> Map<String, Value> {
    match serde_json::from_slice::<Value>(bytes) {
        Ok(Value::Object(map)) => map,
        _ => Map::new(),
    }
}

/// Objet JSON contenu dans `path`. Fichier absent, illisible ou qui n'est pas un objet :
/// objet vide (lecture tolérante, jamais d'erreur). Pour LIRE un réglage seulement : avant
/// une réécriture, utiliser `read_json_object_for_write`.
pub fn read_json_object(path: &Path) -> Map<String, Value> {
    fs::read(path)
        .map(|bytes| parse_json_object(&bytes))
        .unwrap_or_default()
}

/// Objet JSON contenu dans `path`, à fusionner puis réécrire. Fichier absent : objet vide.
/// Autre erreur d'E/S (fichier verrouillé, droits) : erreur, et l'appelant n'écrit rien ; sinon
/// une lecture ratée effacerait toutes les clés du fichier. Contenu invalide : objet vide (la
/// version précédente reste dans le `.bak`).
pub fn read_json_object_for_write(path: &Path) -> Result<Map<String, Value>, String> {
    match fs::read(path) {
        Ok(bytes) => Ok(parse_json_object(&bytes)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(Map::new()),
        Err(e) => Err(format!(
            "Lecture de {} impossible, rien n'a été écrit : {e}",
            path.display()
        )),
    }
}

/// Réglages envoyés par l'interface, dont la clé `shortcuts` est remplacée par celle du
/// fichier existant (ou retirée si le fichier n'en a pas). Renvoie le JSON à écrire.
pub fn settings_from_ui(incoming: Value, existing: Map<String, Value>) -> Result<String, String> {
    let Value::Object(mut settings) = incoming else {
        return Err("Réglages invalides : un objet JSON est attendu, rien n'a été écrit.".to_string());
    };
    settings.remove(SHORTCUTS_KEY);
    let mut existing = existing;
    if let Some(shortcuts) = existing.remove(SHORTCUTS_KEY) {
        settings.insert(SHORTCUTS_KEY.to_string(), shortcuts);
    }
    serde_json::to_string_pretty(&Value::Object(settings)).map_err(|e| format!("Réglages non sérialisables : {e}"))
}

/// Fichier de stockage et verrou qui en sérialise les écritures.
struct Store {
    file: &'static str,
    lock: &'static Mutex<()>,
}

/// Fichiers autorisés : aucun nom de fichier arbitraire n'est accepté depuis le front.
fn store(name: &str) -> Result<Store, String> {
    let (file, lock) = match name {
        "catalog" => ("catalog.json", &CATALOG_LOCK),
        "favorites" => ("favorites.json", &FAVORITES_LOCK),
        "settings" => (SETTINGS_FILE, &SETTINGS_LOCK),
        // Alias de recherche personnalisés (issue n°10) ; les alias livrés sont dans l'interface.
        "aliases" => ("aliases.json", &ALIASES_LOCK),
        // Entrées du catalogue livré déjà proposées (issue n°8) : jamais rajoutées une fois supprimées.
        "official" => ("official.json", &OFFICIAL_LOCK),
        other => return Err(format!("Stockage inconnu : {other}")),
    };
    Ok(Store { file, lock })
}

/// Chemin du dossier de données, résolu une fois puis gardé en mémoire.
static DATA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// `%APPDATA%\MapTraveller`, avec `images/`. Le chemin est mis en cache, mais le dossier est
/// recréé à chaque appel (coût négligeable) : s'il a été supprimé pendant que l'application
/// tourne, les écritures suivantes réussissent sans redémarrage.
pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = match DATA_DIR.get() {
        Some(dir) => dir.clone(),
        None => {
            let dir = app
                .path()
                .data_dir()
                .map_err(|e| format!("Dossier %APPDATA% introuvable : {e}"))?
                .join(APP_DIR);
            DATA_DIR.get_or_init(|| dir).clone()
        }
    };
    fs::create_dir_all(dir.join("images")).map_err(|e| format!("Création de {} impossible : {e}", dir.display()))?;
    Ok(dir)
}

/// Tentatives de renommage : sous Windows, un antivirus ou l'indexeur qui vient d'ouvrir le
/// fichier fait échouer `rename` (accès refusé) pendant quelques millisecondes.
const RENAME_ATTEMPTS: u32 = if cfg!(windows) { 5 } else { 1 };
const RENAME_RETRY_DELAY: Duration = Duration::from_millis(50);

/// `rename`, réessayé sur `PermissionDenied` (voir `RENAME_ATTEMPTS`). Sous Windows, `rename`
/// remplace la cible existante (MoveFileEx + REPLACE_EXISTING).
fn rename_with_retry(from: &Path, to: &Path) -> io::Result<()> {
    let mut attempt = 1;
    loop {
        match fs::rename(from, to) {
            Err(e) if e.kind() == ErrorKind::PermissionDenied && attempt < RENAME_ATTEMPTS => {
                attempt += 1;
                std::thread::sleep(RENAME_RETRY_DELAY);
            }
            result => return result,
        }
    }
}

/// `path` suivi de `suffix` (`catalog.json` → `catalog.json.tmp`).
fn with_suffix(path: &Path, suffix: &str) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("Chemin invalide : {}", path.display()))?;
    Ok(path.with_file_name(format!("{file_name}{suffix}")))
}

/// Remplace `path` par `contents` sans jamais laisser sous ce nom un fichier à moitié écrit :
/// `*.tmp` écrit, synchronisé sur le disque (une coupure de courant après le renommage ne laisse
/// pas un fichier vide) et fermé, puis renommé. Le `.tmp` est supprimé en cas d'échec.
/// Deux appels simultanés sur le même `path` partagent le même `.tmp` : l'appelant les sérialise.
pub fn replace_file(path: &Path, contents: &[u8]) -> Result<(), String> {
    replace_file_with(path, contents, true)
}

/// `replace_file`, avec ou sans synchronisation du `.tmp` avant le renommage. Sans elle, une
/// coupure de courant peut laisser un fichier VIDE sous le vrai nom, jamais un fichier tronqué.
fn replace_file_with(path: &Path, contents: &[u8], durable: bool) -> Result<(), String> {
    let tmp = with_suffix(path, ".tmp")?;
    // Le fichier est fermé à la fin de la fermeture : obligatoire avant `rename` sous Windows.
    let written = File::create(&tmp).and_then(|mut out| {
        out.write_all(contents)?;
        if durable {
            out.sync_all()?;
        }
        Ok(())
    });
    if let Err(e) = written {
        let _ = fs::remove_file(&tmp);
        return Err(format!("Écriture de {} impossible : {e}", tmp.display()));
    }
    rename_with_retry(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        format!("Remplacement de {} impossible : {e}", path.display())
    })
}

/// Écrit `contents` dans `path` (`replace_file`), en conservant l'ancienne version en `.bak`,
/// écrite de la même façon.
pub fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    match fs::read(path) {
        Ok(previous) => replace_file(&with_suffix(path, ".bak")?, &previous)
            .map_err(|e| format!("Sauvegarde .bak impossible : {e}"))?,
        Err(e) if e.kind() == ErrorKind::NotFound => {}
        Err(e) => {
            return Err(format!(
                "Lecture de {} impossible, rien n'a été écrit : {e}",
                path.display()
            ))
        }
    }
    replace_file(path, contents.as_bytes())
}

/// Nom d'une image livrée : `<lettres, chiffres, ., _, ->.webp`, sans chemin.
fn is_bundled_image_name(name: &str) -> bool {
    name.len() > ".webp".len()
        && name.ends_with(".webp")
        && !name.starts_with('.')
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
}

/// Image livrée à (re)copier : absente, ou fichier vide, seul reste possible d'une copie non
/// synchronisée interrompue par une coupure. Tout autre fichier (non vide, dossier, illisible)
/// est laissé tel quel.
fn needs_bundled_copy(target: &Path) -> bool {
    match fs::metadata(target) {
        Ok(meta) => meta.is_file() && meta.len() == 0,
        Err(e) => e.kind() == ErrorKind::NotFound,
    }
}

/// Copie dans `dest` les images de `src` qui y manquent (`needs_bundled_copy`). Ne remplace
/// jamais un fichier non vide. Renvoie le nombre de fichiers copiés.
fn copy_missing_images(src: &Path, dest: &Path) -> Result<usize, String> {
    let entries = fs::read_dir(src).map_err(|e| format!("Lecture de {} impossible : {e}", src.display()))?;
    let mut copied = 0;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if !is_bundled_image_name(name) || !entry.file_type().is_ok_and(|t| t.is_file()) {
            continue;
        }
        let target = dest.join(name);
        if !needs_bundled_copy(&target) {
            continue;
        }
        // Jamais d'image tronquée sous son vrai nom (images livrées : quelques Ko chacune). Pas de
        // synchronisation : au premier lancement, une par image retardait l'affichage de plusieurs
        // centaines de ms, et une copie perdue (fichier vide) est refaite au lancement suivant.
        let data = fs::read(entry.path()).map_err(|e| format!("Copie de {name} impossible : {e}"))?;
        replace_file_with(&target, &data, false).map_err(|e| format!("Copie de {name} impossible : {e}"))?;
        copied += 1;
    }
    Ok(copied)
}

/// Images du catalogue livré. Un échec n'empêche pas le démarrage : les cartes concernées
/// affichent alors leur repère sans image.
fn install_bundled_images(app: &AppHandle, dir: &Path) {
    let result = app
        .path()
        .resolve(IMAGES_RESOURCE, BaseDirectory::Resource)
        .map_err(|e| format!("Images livrées introuvables : {e}"))
        .and_then(|src| copy_missing_images(&src, &dir.join("images")));
    if let Err(e) = result {
        eprintln!("{e}");
    }
}

/// Au lancement : images livrées manquantes, puis seed si aucun catalogue utilisateur n'existe.
pub fn ensure_initialized(app: &AppHandle) -> Result<(), String> {
    let dir = app_data_dir(app)?;
    install_bundled_images(app, &dir);
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

/// Contenu brut d'un fichier de stockage, ou `None` s'il n'existe pas encore. Sans verrou :
/// le renommage atomique ne laisse jamais lire un fichier à moitié écrit.
#[tauri::command(async)]
pub fn load_store(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let path = app_data_dir(&app)?.join(store(&name)?.file);
    match fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Lecture de {} impossible : {e}", path.display())),
    }
}

/// Enregistre un fichier de stockage après vérification que le contenu est du JSON valide.
/// Pour `settings`, la clé `shortcuts` du fichier existant est conservée (voir l'en-tête).
#[tauri::command(async)]
pub fn save_store(app: AppHandle, name: String, json: String) -> Result<(), String> {
    let value = serde_json::from_str::<Value>(&json).map_err(|e| format!("JSON invalide, rien n'a été écrit : {e}"))?;
    let store = store(&name)?;
    write_store(&app_data_dir(&app)?.join(store.file), &store, value, &json)?;
    notify_store_changed(&app, &name);
    Ok(())
}

/// Écrit `json` (déjà validé en `value`) dans `path`, sous le verrou du fichier : l'écriture
/// (`.tmp`, `.bak`) et, pour `settings`, la lecture qui la précède ne se croisent jamais.
fn write_store(path: &Path, store: &Store, value: Value, json: &str) -> Result<(), String> {
    let _guard = acquire(store.lock);
    if store.file == SETTINGS_FILE {
        let merged = settings_from_ui(value, read_json_object_for_write(path)?)?;
        write_atomic(path, &merged)
    } else {
        write_atomic(path, json)
    }
}

/// Prévient la palette et la fenêtre de parcours Farm qu'un fichier vient d'être écrit (verrou
/// du fichier déjà relâché). Un échec n'annule pas l'écriture, déjà faite : la palette relira de
/// toute façon les fichiers à son prochain affichage, la fenêtre Farm à sa prochaine ouverture.
fn notify_store_changed(app: &AppHandle, name: &str) {
    for label in [PALETTE_LABEL, FARM_LABEL] {
        if let Err(e) = app.emit_to(label, STORE_CHANGED_EVENT, name) {
            eprintln!("Événement {STORE_CHANGED_EVENT} non émis : {e}");
        }
    }
}

/// Chemin absolu du dossier de données (utilisé pour afficher les images via `asset:`).
#[tauri::command(async)]
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
    // Chemin complet de l'Explorateur, jamais de repli sur un nom nu : un `explorer.exe` posé à
    // côté de l'application serait lancé à sa place (Windows cherche d'abord dans le dossier du
    // programme).
    let explorer = std::env::var_os("SystemRoot")
        .map(|root| PathBuf::from(root).join("explorer.exe"))
        .ok_or_else(|| "Dossier Windows introuvable (SystemRoot absent) : Explorateur non lancé".to_string())?;
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
        assert!(!dir.join("catalog.json.bak.tmp").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn replace_file_leaves_nothing_behind_on_failure() {
        let dir = std::env::temp_dir().join(format!("map-traveller-replace-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("vignette.webp");
        replace_file(&file, b"un").unwrap();
        replace_file(&file, b"deux").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"deux");
        // Cible impossible à remplacer (un dossier non vide) : erreur, aucun `.tmp` restant.
        let blocked = dir.join("bloque");
        fs::create_dir_all(blocked.join("dedans")).unwrap();
        assert!(replace_file(&blocked, b"x").is_err());
        assert!(!dir.join("bloque.tmp").exists());
        assert!(blocked.is_dir());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_for_write_refuses_unreadable_files() {
        let dir = std::env::temp_dir().join(format!("map-traveller-for-write-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        assert_eq!(read_json_object_for_write(&dir.join("absent.json")), Ok(Map::new()));
        let bad = dir.join("bad.json");
        fs::write(&bad, "{ pas du json").unwrap();
        assert_eq!(read_json_object_for_write(&bad), Ok(Map::new()));
        let good = dir.join("good.json");
        fs::write(&good, r#"{"a":1}"#).unwrap();
        assert_eq!(
            read_json_object_for_write(&good).unwrap().get("a"),
            Some(&Value::from(1))
        );
        // Erreur d'E/S autre que « absent » (ici, un dossier) : rien ne doit être réécrit.
        let unreadable = dir.join("dossier.json");
        fs::create_dir_all(&unreadable).unwrap();
        assert!(read_json_object_for_write(&unreadable).is_err());
        assert!(read_json_object(&unreadable).is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn bundled_images_are_copied_once_and_never_replaced() {
        let root = std::env::temp_dir().join(format!("map-traveller-images-{}", std::process::id()));
        let (src, dest) = (root.join("src"), root.join("dest"));
        fs::create_dir_all(&src).unwrap();
        fs::create_dir_all(&dest).unwrap();
        fs::write(src.join("donjon-1.webp"), "livree").unwrap();
        fs::write(src.join("banque.webp"), "livree").unwrap();
        fs::write(src.join("notes.txt"), "ignoree").unwrap();
        fs::write(dest.join("banque.webp"), "utilisateur").unwrap();

        assert_eq!(copy_missing_images(&src, &dest), Ok(1));
        assert_eq!(fs::read_to_string(dest.join("donjon-1.webp")).unwrap(), "livree");
        assert_eq!(fs::read_to_string(dest.join("banque.webp")).unwrap(), "utilisateur");
        assert!(!dest.join("notes.txt").exists());
        assert!(!dest.join("donjon-1.webp.tmp").exists());
        assert_eq!(copy_missing_images(&src, &dest), Ok(0));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn empty_bundled_images_are_copied_again() {
        let root = std::env::temp_dir().join(format!("map-traveller-images-vides-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let (src, dest) = (root.join("src"), root.join("dest"));
        fs::create_dir_all(&src).unwrap();
        fs::create_dir_all(dest.join("dossier.webp")).unwrap();
        fs::write(src.join("vide.webp"), "livree").unwrap();
        fs::write(src.join("pleine.webp"), "livree").unwrap();
        fs::write(src.join("dossier.webp"), "livree").unwrap();
        // Reste d'une copie interrompue par une coupure : fichier vide sous le vrai nom.
        fs::write(dest.join("vide.webp"), "").unwrap();
        fs::write(dest.join("pleine.webp"), "u").unwrap();

        assert_eq!(copy_missing_images(&src, &dest), Ok(1));
        assert_eq!(fs::read_to_string(dest.join("vide.webp")).unwrap(), "livree");
        assert_eq!(fs::read_to_string(dest.join("pleine.webp")).unwrap(), "u");
        assert!(dest.join("dossier.webp").is_dir());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn bundled_image_names_are_plain_webp_files() {
        assert!(is_bundled_image_name("metier-paysan.webp"));
        assert!(!is_bundled_image_name(".webp"));
        assert!(!is_bundled_image_name("../x.webp"));
        assert!(!is_bundled_image_name("x.png"));
        assert!(!is_bundled_image_name(".cache.webp"));
    }

    #[test]
    fn store_names_are_whitelisted() {
        assert_eq!(store("catalog").map(|s| s.file), Ok("catalog.json"));
        assert_eq!(store("aliases").map(|s| s.file), Ok("aliases.json"));
        assert!(store("../secret").is_err());
    }

    #[test]
    fn settings_store_shares_the_shortcuts_lock() {
        // Un seul verrou pour `settings.json`, celui que prend aussi `shortcuts::set_shortcut`.
        assert!(std::ptr::eq(store("settings").unwrap().lock, &SETTINGS_LOCK));
        assert!(!std::ptr::eq(store("catalog").unwrap().lock, &SETTINGS_LOCK));
    }

    #[test]
    fn concurrent_writes_of_one_store_leave_valid_files() {
        let dir = std::env::temp_dir().join(format!("map-traveller-concurrent-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("catalog.json");
        // Contenus assez gros pour que les écritures se chevauchent sans verrou.
        let contents: Vec<String> = (0..2)
            .map(|i| serde_json::json!({ "v": i, "pad": "x".repeat(256 * 1024) }).to_string())
            .collect();
        for _ in 0..10 {
            std::thread::scope(|scope| {
                for json in &contents {
                    let path = &path;
                    scope.spawn(move || {
                        let value = serde_json::from_str::<Value>(json).unwrap();
                        write_store(path, &store("catalog").unwrap(), value, json).unwrap();
                    });
                }
            });
            let written = fs::read_to_string(&path).unwrap();
            assert!(contents.contains(&written));
            let backup = fs::read_to_string(dir.join("catalog.json.bak")).unwrap();
            assert!(contents.contains(&backup));
            assert!(!dir.join("catalog.json.tmp").exists());
            assert!(!dir.join("catalog.json.bak.tmp").exists());
        }
        let _ = fs::remove_dir_all(&dir);
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
        let incoming: Value =
            serde_json::from_str(r#"{"alwaysOnTop":true,"shortcuts":{"palette":"Ctrl+Alt+P"}}"#).unwrap();
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
