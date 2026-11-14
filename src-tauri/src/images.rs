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

use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::AppHandle;

use crate::storage::app_data_dir;

/// Taille maximale d'une image importée : 10 Mo.
pub const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;

/// Sous-dossier des images, relatif au dossier de données (identique au chemin du catalogue).
const IMAGES_DIR: &str = "images";

/// Nombre maximal de noms essayés avant d'abandonner (collision très improbable).
const MAX_NAME_ATTEMPTS: u32 = 100;

/// Compteur de processus : deux imports dans la même nanoseconde reçoivent deux noms différents.
static IMPORT_COUNTER: AtomicU64 = AtomicU64::new(0);

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
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
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

/// Copie `source` dans `images_dir` après contrôle de taille et de format.
/// Renvoie le chemin relatif `images/<nom>.<ext>` à enregistrer dans le catalogue.
pub fn import_into(source: &Path, images_dir: &Path) -> Result<String, String> {
    if !source.is_absolute() {
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
    let format = detect_format(&data).ok_or_else(|| {
        "Format non reconnu : seules les images PNG, JPEG et WebP sont acceptées.".to_string()
    })?;

    fs::create_dir_all(images_dir)
        .map_err(|e| format!("Création de {} impossible : {e}", images_dir.display()))?;

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
            Err(e) if e.kind() == ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("Création de {} impossible : {e}", target.display())),
        }
    }
    Err("Aucun nom de fichier libre pour l'image : réessayez.".to_string())
}

/// Importe une image choisie dans le dialogue natif. Renvoie `images/<nom>.<ext>`.
/// Asynchrone : la lecture (jusqu'à 10 Mo) ne bloque pas le fil de l'interface.
#[tauri::command]
pub async fn import_image(app: AppHandle, source_path: String) -> Result<String, String> {
    let images_dir = app_data_dir(&app)?.join(IMAGES_DIR);
    import_into(Path::new(&source_path), &images_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const PNG: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, b'I', b'H', b'D', b'R'];
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
        let copied = fs::read_dir(&images).map(|it| it.count()).unwrap_or(0);
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
        assert!(import_into(Path::new("images/relative.png"), &dir.join("images")).is_err());
        assert!(import_into(&dir.join("absente.png"), &dir.join("images")).is_err());
        assert!(import_into(&dir, &dir.join("images")).is_err());
        let _ = fs::remove_dir_all(&dir);
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
}
