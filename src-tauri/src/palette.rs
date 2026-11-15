//! Fenêtre palette de recherche (issue n°3).
//!
//! - Déclarée dans `tauri.conf.json` avec `"create": false` : toutes ses propriétés (taille,
//!   sans décorations, toujours au premier plan, absente de la barre des tâches, invisible,
//!   couleur de fond) y sont lues. Elle est créée à la PREMIÈRE utilisation, puis seulement
//!   masquée et réaffichée.
//! - Affichage : centrée sur l'écran principal, puis focus, puis événement `palette:shown`.
//! - Perte de focus → masquée, sauf dans les `FOCUS_GRACE` qui suivent un affichage.
//! - Le retour du focus à la fenêtre précédente est laissé au comportement natif de Windows.

use std::sync::{Mutex, PoisonError};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow, WebviewWindowBuilder, Window};

/// Libellé de la fenêtre : cible des capabilities (`capabilities/palette.json`) et exclue
/// du plugin qui mémorise la position des fenêtres.
pub const PALETTE_LABEL: &str = "palette";

/// Événement émis vers la palette après chaque affichage (écouté par `src/lib/tauri/palette.ts`).
const SHOWN_EVENT: &str = "palette:shown";

/// Taille logique de la palette ; doit rester égale à `width` / `height` de `tauri.conf.json`.
const WIDTH: f64 = 560.0;
const HEIGHT: f64 = 380.0;

/// Une perte de focus reçue juste après l'affichage est ignorée (sinon la palette se
/// refermerait en s'ouvrant).
const FOCUS_GRACE: Duration = Duration::from_millis(150);

/// Instant du dernier affichage.
static SHOWN_AT: Mutex<Option<Instant>> = Mutex::new(None);

/// Sérialise les affichages : deux appuis rapides ne créent pas deux fenêtres.
static SHOW_LOCK: Mutex<()> = Mutex::new(());

/// Bascule demandée par le raccourci global : masque la palette si elle est visible,
/// l'affiche sinon.
///
/// L'affichage part sur un fil dédié : sous Windows, créer une fenêtre web depuis le
/// gestionnaire d'un raccourci (fil principal, contexte synchrone) peut bloquer l'application.
pub fn toggle_palette(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(PALETTE_LABEL) {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            return;
        }
    }
    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = show_palette(&app) {
            eprintln!("{e}");
        }
    });
}

/// Crée la palette si besoin, la centre sur l'écran principal, l'affiche, lui donne le focus
/// et émet `palette:shown`. À appeler hors du fil principal (voir `toggle_palette`).
pub fn show_palette(app: &AppHandle) -> Result<(), String> {
    let _guard = SHOW_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let window = match app.get_webview_window(PALETTE_LABEL) {
        Some(window) => window,
        None => create_palette(app)?,
    };
    center_on_primary(&window);
    mark_shown();
    window
        .show()
        .map_err(|e| format!("Affichage de la palette impossible : {e}"))?;
    if let Err(e) = window.set_focus() {
        eprintln!("Focus de la palette impossible : {e}");
    }
    app.emit_to(PALETTE_LABEL, SHOWN_EVENT, ())
        .map_err(|e| format!("Événement {} non émis : {e}", SHOWN_EVENT))
}

/// Crée la fenêtre (invisible) à partir de sa déclaration dans `tauri.conf.json`.
fn create_palette(app: &AppHandle) -> Result<WebviewWindow, String> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == PALETTE_LABEL)
        .cloned()
        .ok_or_else(|| "Fenêtre palette absente de tauri.conf.json.".to_string())?;
    let builder = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|e| format!("Configuration de la palette invalide : {e}"))?;
    builder
        .build()
        .map_err(|e| format!("Création de la fenêtre palette impossible : {e}"))
}

/// Place la fenêtre au centre de l'écran principal, en pixels physiques, d'après le facteur
/// d'échelle de CET écran (la fenêtre y prendra cette échelle). Sans écran principal connu :
/// centrage par défaut de Tauri.
fn center_on_primary(window: &WebviewWindow) {
    let monitor = match window.primary_monitor() {
        Ok(Some(monitor)) => monitor,
        _ => {
            let _ = window.center();
            return;
        }
    };
    let scale = monitor.scale_factor();
    let screen = monitor.size();
    let origin = monitor.position();
    let width = (WIDTH * scale).round() as i32;
    let height = (HEIGHT * scale).round() as i32;
    let x = origin.x + (screen.width as i32 - width) / 2;
    let y = origin.y + (screen.height as i32 - height) / 2;
    if let Err(e) = window.set_position(PhysicalPosition::new(x, y)) {
        eprintln!("Positionnement de la palette impossible : {e}");
    }
}

fn mark_shown() {
    let mut shown = SHOWN_AT.lock().unwrap_or_else(PoisonError::into_inner);
    *shown = Some(Instant::now());
}

/// Vrai pendant `FOCUS_GRACE` après le dernier affichage.
fn shown_recently() -> bool {
    let shown = SHOWN_AT.lock().unwrap_or_else(PoisonError::into_inner);
    let at: Option<Instant> = *shown;
    match at {
        Some(at) => at.elapsed() < FOCUS_GRACE,
        None => false,
    }
}

/// Perte de focus d'une fenêtre : masque la palette (clic ailleurs, Alt+Tab), sauf juste
/// après son affichage. Sans effet sur les autres fenêtres.
pub fn on_focus_lost(window: &Window) {
    if window.label() != PALETTE_LABEL || shown_recently() {
        return;
    }
    let _ = window.hide();
}

/// Masque la palette sans la détruire. Sans effet si elle n'a jamais été créée.
#[tauri::command]
pub fn hide_palette(app: AppHandle) -> Result<(), String> {
    match app.get_webview_window(PALETTE_LABEL) {
        Some(window) => window
            .hide()
            .map_err(|e| format!("Masquage de la palette impossible : {e}")),
        None => Ok(()),
    }
}
