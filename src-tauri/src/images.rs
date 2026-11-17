//! Import d'images (CdC §6.3).
//!
//! Le fichier choisi par l'utilisateur est COPIÉ dans `%APPDATA%\MapTraveller\images\` sous un
//! nom interne unique ; le catalogue ne garde que le chemin relatif `images/<nom>`.
//! - Taille limitée à `MAX_IMAGE_BYTES`, vérifiée avant toute lecture du contenu.
//! - Format réel détecté par signature (PNG, JPEG, WebP) ; l'extension du fichier d'origine
//!   est ignorée et celle de la copie vient du format détecté.
//! - Nom interne composé uniquement de `[a-z0-9-]` ; un fichier existant n'est jamais écrasé.
//! - Le fichier source n'est jamais modifié ni supprimé ; son contenu n'est ni exécuté ni décodé.
//! - Aucun fichier n'est supprimé automatiquement, sauf la copie partielle d'un import échoué.
//!
//! Vignettes (issue n°14, A4) : la grille et la palette affichent une copie réduite
//! `images/<nom>.thumb.webp` (256 px de petit côté au plus), produite DANS LA PAGE (canvas),
//! sans bibliothèque d'images en Rust. Rust ne fait que relire l'original (`read_image`) et
//! enregistrer la vignette reçue (`save_thumbnail`), après contrôle du nom, de la taille et du
//! format. L'original n'est jamais modifié ni supprimé ; seule une vignette peut être remplacée.
//! Ces deux commandes sont réservées à la fenêtre principale.

use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use std::path::{Component, Path, Prefix};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Window};

use crate::main_window::ensure_main;
use crate::storage::{app_data_dir, replace_file};

/// Taille maximale d'une image importée : 10 Mo.
pub const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;

/// Sous-dossier des images, relatif au dossier de données (identique au chemin du catalogue).
const IMAGES_DIR: &str = "images";

/// Nombre maximal de noms essayés avant d'abandonner (collision très improbable).
const MAX_NAME_ATTEMPTS: u32 = 100;

/// Compteur de processus : deux imports dans la même nanoseconde reçoivent deux noms différents.
static IMPORT_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Sérialise les écritures de vignettes : `save_thumbnail` s'exécute hors du fil principal, et deux
/// vignettes de la même image partageraient le même `.tmp`. Verrou global léger (une vignette
/// pèse quelques dizaines de Ko), jamais tenu en même temps qu'un verrou de `storage`.
static THUMB_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageFormat {
    Png,
    Jpeg,
    Webp,
}

impl ImageFormat {
    /// Extension de la copie, déduite du format réel.
    pub fn extension(self) -> &'static str {
        match self {
            ImageFormat::Png => "png",
            ImageFormat::Jpeg => "jpg",
            ImageFormat::Webp => "webp",
        }
    }
}

/// Détecte le format réel d'après les premiers octets du fichier.
pub fn detect_format(bytes: &[u8]) -> Option<ImageFormat> {
    const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const JPEG_SIGNATURE: [u8; 3] = [0xFF, 0xD8, 0xFF];
    if bytes.starts_with(&PNG_SIGNATURE) {
        return Some(ImageFormat::Png);
    }
    if bytes.starts_with(&JPEG_SIGNATURE) {
        return Some(ImageFormat::Jpeg);
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some(ImageFormat::Webp);
    }
    None
}

/// Nom interne unique (`img-<horodatage>-<processus>-<compteur>`), uniquement `[a-z0-9-]`.
fn unique_stem() -> String {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_nanos());
    let count = IMPORT_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("img-{nanos:x}-{:x}-{count:x}", std::process::id())
}

fn too_large(len: u64) -> String {
    let mo = len as f64 / (1024.0 * 1024.0);
    format!(
        "Image trop lourde ({mo:.1} Mo) : {} Mo maximum.",
        MAX_IMAGE_BYTES / (1024 * 1024)
    )
}

/// Chemin absolu sur un disque local. Sous Windows, seuls `C:\…` et `\\?\C:\…` sont acceptés :
/// ouvrir un chemin réseau (`\\serveur\partage\…`, `\\?\UNC\…`) ferait contacter une autre
/// machine et lui enverrait les identifiants de session (NTLM).
fn is_local_absolute(path: &Path) -> bool {
    if !path.is_absolute() {
        return false;
    }
    match path.components().next() {
        Some(Component::Prefix(prefix)) => matches!(prefix.kind(), Prefix::Disk(_) | Prefix::VerbatimDisk(_)),
        // Hors Windows, un chemin absolu commence par la racine ; sous Windows, il a un préfixe.
        _ => !cfg!(windows),
    }
}

/// Copie `source` dans `images_dir` après contrôle de taille et de format.
/// Renvoie le chemin relatif `images/<nom>.<ext>` à enregistrer dans le catalogue.
pub fn import_into(source: &Path, images_dir: &Path) -> Result<String, String> {
    if !is_local_absolute(source) {
        return Err("Chemin d'image invalide : un fichier local est attendu.".to_string());
    }
    let meta = fs::metadata(source).map_err(|e| format!("Image illisible : {e}"))?;
    if !meta.is_file() {
        return Err("Le chemin choisi n'est pas un fichier.".to_string());
    }
    if meta.len() > MAX_IMAGE_BYTES {
        return Err(too_large(meta.len()));
    }

    // Lecture bornée : le fichier a pu grossir depuis la lecture de sa taille.
    let mut data = Vec::new();
    File::open(source)
        .map_err(|e| format!("Image illisible : {e}"))?
        .take(MAX_IMAGE_BYTES + 1)
        .read_to_end(&mut data)
        .map_err(|e| format!("Lecture de l'image impossible : {e}"))?;
    if data.len() as u64 > MAX_IMAGE_BYTES {
        return Err(too_large(data.len() as u64));
    }
    let format = detect_format(&data)
        .ok_or_else(|| "Format non reconnu : seules les images PNG, JPEG et WebP sont acceptées.".to_string())?;

    fs::create_dir_all(images_dir).map_err(|e| format!("Création de {} impossible : {e}", images_dir.display()))?;

    for _ in 0..MAX_NAME_ATTEMPTS {
        let name = format!("{}.{}", unique_stem(), format.extension());
        let target = images_dir.join(&name);
        // `create_new` : échoue si le fichier existe déjà, sans jamais l'écraser.
        match OpenOptions::new().write(true).create_new(true).open(&target) {
            Ok(mut out) => {
                let written = out.write_all(&data).and_then(|()| out.sync_all());
                return match written {
                    Ok(()) => Ok(format!("{IMAGES_DIR}/{name}")),
                    Err(e) => {
                        // Fermer avant de supprimer la copie partielle (obligatoire sous Windows).
                        drop(out);
                        let _ = fs::remove_file(&target);
                        Err(format!("Copie de l'image impossible : {e}"))
                    }
                };
            }
            Err(e) if e.kind() == ErrorKind::AlreadyExists => {}
            Err(e) => return Err(format!("Création de {} impossible : {e}", target.display())),
        }
    }
    Err("Aucun nom de fichier libre pour l'image : réessayez.".to_string())
}

/// Taille maximale d'une vignette reçue de la page : 1 Mo (une vignette WebP de 256 px pèse
/// quelques dizaines de Ko).
pub const MAX_THUMB_BYTES: usize = 1024 * 1024;

/// Suffixe des vignettes, à la place de l'extension de l'original.
const THUMB_SUFFIX: &str = ".thumb.webp";

/// Nom de fichier d'une image importée par `import_into` (`images/<[a-z0-9-]+>.<png|jpg|webp>`),
/// sans le préfixe `images/`, et sa racine. `None` pour tout autre chemin, une vignette comprise :
/// aucun chemin libre, aucun `..`, aucun séparateur.
fn imported_name(relative: &str) -> Option<(&str, &str)> {
    let name = relative.strip_prefix("images/")?;
    let (stem, ext) = name.rsplit_once('.')?;
    let stem_ok = !stem.is_empty()
        && stem.len() <= 128
        && stem
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    (stem_ok && matches!(ext, "png" | "jpg" | "webp")).then_some((name, stem))
}

/// Relit une image importée, bornée à `MAX_IMAGE_BYTES`.
pub fn read_imported(relative: &str, images_dir: &Path) -> Result<Vec<u8>, String> {
    let (name, _) = imported_name(relative).ok_or_else(|| "Chemin d'image refusé.".to_string())?;
    let mut data = Vec::new();
    File::open(images_dir.join(name))
        .map_err(|e| format!("Image illisible : {e}"))?
        .take(MAX_IMAGE_BYTES + 1)
        .read_to_end(&mut data)
        .map_err(|e| format!("Lecture de l'image impossible : {e}"))?;
    if data.len() as u64 > MAX_IMAGE_BYTES {
        return Err(too_large(data.len() as u64));
    }
    Ok(data)
}

/// Enregistre la vignette WebP d'une image importée (`replace_file`) : une vignette n'est jamais
/// lue à moitié écrite. Renvoie son chemin relatif.
pub fn write_thumbnail(relative: &str, data: &[u8], images_dir: &Path) -> Result<String, String> {
    let (name, stem) = imported_name(relative).ok_or_else(|| "Chemin d'image refusé.".to_string())?;
    if data.len() > MAX_THUMB_BYTES {
        return Err("Vignette trop lourde.".to_string());
    }
    if detect_format(data) != Some(ImageFormat::Webp) {
        return Err("Vignette refusée : WebP attendu.".to_string());
    }
    if !images_dir.join(name).is_file() {
        return Err("Image d'origine introuvable.".to_string());
    }
    let target = images_dir.join(format!("{stem}{THUMB_SUFFIX}"));
    let _guard = THUMB_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    replace_file(&target, data).map_err(|e| format!("Enregistrement de la vignette impossible : {e}"))?;
    Ok(format!("{IMAGES_DIR}/{stem}{THUMB_SUFFIX}"))
}

/// Octets d'une image importée, pour en faire la vignette dans la page. Fenêtre principale
/// uniquement.
#[tauri::command]
pub async fn read_image(app: AppHandle, window: Window, relative: String) -> Result<Response, String> {
    ensure_main(&window)?;
    let images_dir = app_data_dir(&app)?.join(IMAGES_DIR);
    read_imported(&relative, &images_dir).map(Response::new)
}

/// Enregistre la vignette produite par la page. Corps brut (les octets WebP), image d'origine
/// dans l'en-tête `x-image`. Fenêtre principale uniquement, hors du fil principal.
#[tauri::command(async)]
pub fn save_thumbnail(app: AppHandle, window: Window, request: Request<'_>) -> Result<String, String> {
    ensure_main(&window)?;
    let relative = request
        .headers()
        .get("x-image")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "Image d'origine non précisée.".to_string())?;
    let InvokeBody::Raw(data) = request.body() else {
        return Err("Vignette attendue en octets bruts.".to_string());
    };
    let images_dir = app_data_dir(&app)?.join(IMAGES_DIR);
    write_thumbnail(relative, data, &images_dir)
}

/// Importe une image choisie dans le dialogue natif. Renvoie `images/<nom>.<ext>`. Fenêtre
/// principale uniquement. Asynchrone : la lecture (jusqu'à 10 Mo) ne bloque pas le fil de
/// l'interface.
#[tauri::command]
pub async fn import_image(app: AppHandle, window: Window, source_path: String) -> Result<String, String> {
    ensure_main(&window)?;
    let images_dir = app_data_dir(&app)?.join(IMAGES_DIR);
    import_into(Path::new(&source_path), &images_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const PNG: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, b'I', b'H', b'D', b'R',
    ];
    const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 0, 16, b'J', b'F', b'I', b'F', 0];
    const WEBP: &[u8] = b"RIFF\x24\x00\x00\x00WEBPVP8 ";

    /// Dossier temporaire propre à un test (les tests s'exécutent en parallèle).
    fn test_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("map-traveller-images-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn detects_real_formats() {
        assert_eq!(detect_format(PNG), Some(ImageFormat::Png));
        assert_eq!(detect_format(JPEG), Some(ImageFormat::Jpeg));
        assert_eq!(detect_format(WEBP), Some(ImageFormat::Webp));
        assert_eq!(detect_format(b"RIFF\x24\x00\x00\x00WAVEfmt "), None);
        assert_eq!(detect_format(b"RIFF"), None);
        assert_eq!(detect_format(b"texte"), None);
        assert_eq!(detect_format(&[]), None);
    }

    #[test]
    fn extension_comes_from_detected_format() {
        let dir = test_dir("extension");
        let source = dir.join("photo.png"); // nom trompeur : le contenu est du WebP
        fs::write(&source, WEBP).unwrap();
        let rel = import_into(&source, &dir.join("images")).unwrap();
        assert!(rel.starts_with("images/img-"));
        assert!(rel.ends_with(".webp"));
        let name = rel.trim_start_matches("images/");
        assert!(name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.'));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn renamed_text_file_is_refused() {
        let dir = test_dir("texte");
        let source = dir.join("faux.png");
        fs::write(&source, "ceci n'est pas une image").unwrap();
        let images = dir.join("images");
        assert!(import_into(&source, &images).is_err());
        // Rien n'a été copié.
        let copied = fs::read_dir(&images).map_or(0, Iterator::count);
        assert_eq!(copied, 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn oversized_file_is_refused() {
        let dir = test_dir("lourd");
        let source = dir.join("lourde.png");
        let file = File::create(&source).unwrap();
        file.set_len(MAX_IMAGE_BYTES + 1).unwrap();
        drop(file);
        let err = import_into(&source, &dir.join("images")).unwrap_err();
        assert!(err.contains("trop lourde"), "message inattendu : {err}");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn relative_or_missing_paths_are_refused() {
        let dir = test_dir("chemins");
        assert!(!is_local_absolute(Path::new("images/relative.png")));
        assert!(!is_local_absolute(Path::new("../relative.png")));
        assert!(import_into(Path::new("images/relative.png"), &dir.join("images")).is_err());
        assert!(import_into(Path::new("relative.png"), &dir.join("images")).is_err());
        assert!(import_into(&dir.join("absente.png"), &dir.join("images")).is_err());
        assert!(import_into(&dir, &dir.join("images")).is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn network_paths_are_refused() {
        assert!(is_local_absolute(Path::new(r"C:\Images\carte.png")));
        assert!(is_local_absolute(Path::new(r"\\?\C:\Images\carte.png")));
        for unc in [
            r"\\serveur\partage\carte.png",
            r"\\?\UNC\serveur\partage\carte.png",
            r"\\.\C:\carte.png",
            r"\Images\carte.png",
        ] {
            assert!(!is_local_absolute(Path::new(unc)), "{unc}");
            let err = import_into(Path::new(unc), Path::new(r"C:\inexistant\images")).unwrap_err();
            assert!(err.contains("fichier local"), "{unc} : {err}");
        }
    }

    #[test]
    fn two_imports_get_two_names_and_identical_copies() {
        let dir = test_dir("double");
        let source = dir.join("source.jpg");
        fs::write(&source, JPEG).unwrap();
        let images = dir.join("images");
        let first = import_into(&source, &images).unwrap();
        let second = import_into(&source, &images).unwrap();
        assert_ne!(first, second);
        for rel in [&first, &second] {
            assert!(rel.ends_with(".jpg"));
            assert_eq!(fs::read(dir.join(rel)).unwrap(), JPEG);
        }
        // La source n'a pas été touchée.
        assert_eq!(fs::read(&source).unwrap(), JPEG);
        let _ = fs::remove_dir_all(&dir);
    }

    /// Chemin relatif de la vignette d'une image importée (même règle que l'interface).
    fn thumbnail_path(relative: &str) -> Option<String> {
        imported_name(relative).map(|(_, stem)| format!("{IMAGES_DIR}/{stem}{THUMB_SUFFIX}"))
    }

    #[test]
    fn thumbnail_paths_only_for_imported_names() {
        assert_eq!(
            thumbnail_path("images/img-1a-2b-0.png").as_deref(),
            Some("images/img-1a-2b-0.thumb.webp")
        );
        assert_eq!(
            thumbnail_path("images/img-1.jpg").as_deref(),
            Some("images/img-1.thumb.webp")
        );
        for bad in [
            "images/img-1.thumb.webp",
            "images/../catalog.json",
            "images/sub/img-1.png",
            "images/IMG-1.png",
            "images/img-1.gif",
            "images/.png",
            "img-1.png",
            "/images/img-1.png",
            "images\\img-1.png",
            "",
        ] {
            assert_eq!(thumbnail_path(bad), None, "{bad}");
        }
    }

    #[test]
    fn writes_and_replaces_a_thumbnail_without_touching_the_original() {
        let dir = test_dir("thumb");
        fs::write(dir.join("img-1.png"), PNG).unwrap();
        let rel = write_thumbnail("images/img-1.png", WEBP, &dir).unwrap();
        assert_eq!(rel, "images/img-1.thumb.webp");
        assert_eq!(fs::read(dir.join("img-1.thumb.webp")).unwrap(), WEBP);
        // Remplacement d'une vignette existante : autorisé.
        let mut other = WEBP.to_vec();
        other.push(0);
        write_thumbnail("images/img-1.png", &other, &dir).unwrap();
        assert_eq!(fs::read(dir.join("img-1.thumb.webp")).unwrap(), other);
        assert_eq!(fs::read(dir.join("img-1.png")).unwrap(), PNG);
        assert!(!dir.join("img-1.thumb.webp.tmp").exists());
    }

    #[test]
    fn refuses_bad_thumbnails() {
        let dir = test_dir("thumb-bad");
        fs::write(dir.join("img-1.png"), PNG).unwrap();
        assert!(write_thumbnail("images/img-1.png", PNG, &dir).is_err());
        assert!(write_thumbnail("images/img-2.png", WEBP, &dir).is_err());
        assert!(write_thumbnail("images/../img-1.png", WEBP, &dir).is_err());
        let mut huge = WEBP.to_vec();
        huge.resize(MAX_THUMB_BYTES + 1, 0);
        assert!(write_thumbnail("images/img-1.png", &huge, &dir).is_err());
        assert!(!dir.join("img-1.thumb.webp").exists());
    }

    #[test]
    fn reads_only_imported_images() {
        let dir = test_dir("read");
        fs::write(dir.join("img-1.png"), PNG).unwrap();
        assert_eq!(read_imported("images/img-1.png", &dir).unwrap(), PNG);
        assert!(read_imported("images/../img-1.png", &dir).is_err());
        assert!(read_imported("images/img-2.png", &dir).is_err());
    }
}
