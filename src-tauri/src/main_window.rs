//! Fenêtre principale : afficher, masquer, réduire, zone de notification (issue n°14).
//!
//! - Réglage `tray.minimizeToTray` de `settings.json`, lu au moment d'agir (lecture tolérante,
//!   `true` si la clé est absente ou invalide). L'interface l'écrit comme ses autres réglages.
//! - Réglage actif : le bouton réduire (commande `minimize_main`) et le raccourci « afficher /
//!   masquer » DÉTRUISENT la fenêtre (plus aucune page chargée) après avoir sauvegardé sa position
//!   (plugin window-state). Elle est recréée à la demande à partir de sa déclaration dans
//!   `tauri.conf.json` ; le plugin window-state la remet à sa place (`on_window_ready`).
//! - Réglage inactif : réduire = barre des tâches, raccourci = masquer (comportement historique).
//! - Formulaire ouvert (`set_main_busy(true)`) : la fenêtre n'est JAMAIS détruite ; elle est
//!   seulement réduite ou masquée, la saisie reste en mémoire. Idem si l'icône de la zone de
//!   notification n'a pas pu être créée.
//! - Le bouton fermer n'est pas concerné : il quitte toute l'application (`lib.rs`).
//!
//! Toutes les actions partent sur un fil dédié, l'une après l'autre : sous Windows, créer une
//! fenêtre web depuis un gestionnaire du fil principal (raccourci, icône, menu) peut bloquer
//! l'application (même précaution que `palette.rs`).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, PoisonError};

use serde_json::{Map, Value};
use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder, Window};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

use crate::storage::{app_data_dir, read_json_object, SETTINGS_FILE};

/// Libellé de la fenêtre principale (`tauri.conf.json`, `capabilities/default.json`).
pub const MAIN_LABEL: &str = "main";

/// Clé de `settings.json` et sous-clé du réglage (écrites par l'interface).
const TRAY_KEY: &str = "tray";
const MINIMIZE_TO_TRAY_KEY: &str = "minimizeToTray";

/// Vrai pendant l'édition d'une destination (signalé par l'interface).
static BUSY: AtomicBool = AtomicBool::new(false);

/// Vrai une fois l'icône de la zone de notification créée. Sans icône, la fenêtre n'est jamais
/// détruite : elle ne pourrait revenir que par le raccourci ou un nouveau lancement.
static TRAY_READY: AtomicBool = AtomicBool::new(false);

/// Sérialise les actions sur la fenêtre principale : deux appuis rapides ne créent pas deux
/// fenêtres et ne détruisent pas une fenêtre en cours de création.
static ACTION_LOCK: Mutex<()> = Mutex::new(());

#[derive(Debug, Clone, Copy)]
enum Request {
    /// Raccourci « afficher / masquer », clic gauche sur l'icône.
    Toggle,
    /// Menu « Afficher », deuxième lancement.
    Show,
    /// Bouton réduire de la barre de titre.
    Minimize,
}

/// Ce que devient une fenêtre visible quand elle ne va pas dans la zone de notification.
#[derive(Debug, Clone, Copy)]
enum Fallback {
    Hide,
    Minimize,
}

// ---------------------------------------------------------------------------------------------
// Logique pure (testée)
// ---------------------------------------------------------------------------------------------

/// Valeur de `tray.minimizeToTray` : seul un booléen est lu, `true` sinon (défaut).
pub fn minimize_to_tray_enabled(settings: &Map<String, Value>) -> bool {
    match settings
        .get(TRAY_KEY)
        .and_then(|tray| tray.get(MINIMIZE_TO_TRAY_KEY))
    {
        Some(Value::Bool(enabled)) => *enabled,
        _ => true,
    }
}

// ---------------------------------------------------------------------------------------------
// Intégration
// ---------------------------------------------------------------------------------------------

/// Appelée par `lib.rs` quand l'icône de la zone de notification est en place.
pub fn set_tray_ready() {
    TRAY_READY.store(true, Ordering::SeqCst);
}

fn minimize_to_tray(app: &AppHandle) -> bool {
    if !TRAY_READY.load(Ordering::SeqCst) {
        return false;
    }
    match app_data_dir(app) {
        Ok(dir) => minimize_to_tray_enabled(&read_json_object(&dir.join(SETTINGS_FILE))),
        Err(_) => true,
    }
}

/// Afficher / masquer : fenêtre visible → zone de notification (ou masquée) ; sinon affichée,
/// recréée si elle a été détruite.
pub fn toggle(app: &AppHandle) {
    run(app, Request::Toggle);
}

/// Affiche la fenêtre principale, en la recréant si elle a été détruite.
pub fn show(app: &AppHandle) {
    run(app, Request::Show);
}

fn run(app: &AppHandle, request: Request) {
    let app = app.clone();
    std::thread::spawn(move || {
        let _guard = ACTION_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
        let result = match request {
            Request::Toggle => toggle_now(&app),
            Request::Show => show_now(&app),
            Request::Minimize => minimize_now(&app),
        };
        if let Err(e) = result {
            eprintln!("{e}");
        }
    });
}

fn toggle_now(app: &AppHandle) -> Result<(), String> {
    match app.get_webview_window(MAIN_LABEL) {
        Some(window) => {
            let visible =
                window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false);
            if visible {
                put_away(app, &window, Fallback::Hide)
            } else {
                reveal(&window)
            }
        }
        None => create_and_show(app),
    }
}

fn show_now(app: &AppHandle) -> Result<(), String> {
    match app.get_webview_window(MAIN_LABEL) {
        Some(window) => reveal(&window),
        None => create_and_show(app),
    }
}

fn minimize_now(app: &AppHandle) -> Result<(), String> {
    match app.get_webview_window(MAIN_LABEL) {
        Some(window) => put_away(app, &window, Fallback::Minimize),
        None => Ok(()),
    }
}

/// Zone de notification si le réglage est actif et qu'aucune saisie n'est en cours ; sinon
/// masquée ou réduite, la page restant chargée.
fn put_away(app: &AppHandle, window: &WebviewWindow, fallback: Fallback) -> Result<(), String> {
    if !BUSY.load(Ordering::SeqCst) && minimize_to_tray(app) {
        return send_to_tray(app, window);
    }
    let result = match fallback {
        Fallback::Hide => window.hide(),
        Fallback::Minimize => window.minimize(),
    };
    result.map_err(|e| format!("Masquage de la fenêtre impossible : {e}"))
}

/// Sauvegarde la position puis détruit la fenêtre. `destroy` n'émet pas `CloseRequested` :
/// l'application ne quitte pas (voir `lib.rs`) et le plugin window-state ne sauvegarde rien de
/// lui-même, d'où l'appel explicite.
fn send_to_tray(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    if let Err(e) = app.save_window_state(StateFlags::all()) {
        eprintln!("Position de la fenêtre non mémorisée : {e}");
    }
    window
        .destroy()
        .map_err(|e| format!("Passage dans la zone de notification impossible : {e}"))
}

fn reveal(window: &WebviewWindow) -> Result<(), String> {
    let _ = window.unminimize();
    window
        .show()
        .map_err(|e| format!("Affichage de la fenêtre impossible : {e}"))?;
    if let Err(e) = window.set_focus() {
        eprintln!("Focus de la fenêtre impossible : {e}");
    }
    Ok(())
}

/// Recrée la fenêtre à partir de `tauri.conf.json` (taille, sans décorations, premier plan…) ;
/// le plugin window-state lui rend sa position et sa taille.
fn create_and_show(app: &AppHandle) -> Result<(), String> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == MAIN_LABEL)
        .cloned()
        .ok_or_else(|| "Fenêtre principale absente de tauri.conf.json.".to_string())?;
    // Nouvelle page : aucun formulaire ouvert.
    BUSY.store(false, Ordering::SeqCst);
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|e| format!("Configuration de la fenêtre principale invalide : {e}"))?
        .build()
        .map_err(|e| format!("Création de la fenêtre principale impossible : {e}"))?;
    reveal(&window)
}

pub(crate) fn ensure_main(window: &Window) -> Result<(), String> {
    if window.label() == MAIN_LABEL {
        Ok(())
    } else {
        Err("Commande réservée à la fenêtre principale.".to_string())
    }
}

/// Bouton réduire de la barre de titre (voir l'en-tête du module).
#[tauri::command]
pub fn minimize_main(app: AppHandle, window: Window) -> Result<(), String> {
    ensure_main(&window)?;
    run(&app, Request::Minimize);
    Ok(())
}

/// L'interface signale qu'une saisie est en cours (formulaire ouvert) : la fenêtre ne doit pas
/// être détruite tant que c'est vrai.
#[tauri::command]
pub fn set_main_busy(window: Window, busy: bool) -> Result<(), String> {
    ensure_main(&window)?;
    BUSY.store(busy, Ordering::SeqCst);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn object(text: &str) -> Map<String, Value> {
        match serde_json::from_str::<Value>(text) {
            Ok(Value::Object(map)) => map,
            _ => Map::new(),
        }
    }

    #[test]
    fn minimize_to_tray_defaults_to_true() {
        assert!(minimize_to_tray_enabled(&object("{}")));
        assert!(minimize_to_tray_enabled(&object(r#"{ "tray": {} }"#)));
        assert!(minimize_to_tray_enabled(&object(r#"{ "tray": null }"#)));
        assert!(minimize_to_tray_enabled(&object(r#"{ "tray": "non" }"#)));
        assert!(minimize_to_tray_enabled(&object(
            r#"{ "tray": { "minimizeToTray": "false" } }"#
        )));
        assert!(minimize_to_tray_enabled(&object(
            r#"{ "tray": { "minimizeToTray": 0 } }"#
        )));
    }

    #[test]
    fn minimize_to_tray_reads_the_boolean() {
        assert!(minimize_to_tray_enabled(&object(
            r#"{ "tray": { "minimizeToTray": true } }"#
        )));
        assert!(!minimize_to_tray_enabled(&object(
            r#"{ "tray": { "minimizeToTray": false, "autre": 1 } }"#
        )));
    }
}
