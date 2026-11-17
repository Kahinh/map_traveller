//! Fenêtre palette de recherche (issue n°3).
//!
//! - Déclarée dans `tauri.conf.json` avec `"create": false` : toutes ses propriétés (taille,
//!   sans décorations, toujours au premier plan, absente de la barre des tâches, invisible,
//!   couleur de fond) y sont lues. Elle est créée masquée DÈS LE LANCEMENT (`preload_palette`,
//!   appelée dans `setup`, issue n°14) pour que la première ouverture soit aussi rapide que les
//!   suivantes, puis seulement masquée et réaffichée. Si ce préchargement échoue, elle est créée
//!   à la première utilisation, comme avant.
//! - Hauteur dynamique (issue n°19) : la fenêtre s'ouvre réduite à la barre de recherche
//!   (`BAR_HEIGHT`) ; l'interface demande ensuite la hauteur de son contenu par la commande
//!   `set_palette_height`. C'est la fenêtre elle-même qui change de taille : aucune zone vide
//!   ni transparente sous la barre.
//! - Affichage : placée sur l'écran principal (haut de fenêtre fixe, voir `center_on_primary`),
//!   puis focus, puis événement `palette:shown`.
//! - Perte de focus → masquée, sauf dans les `FOCUS_GRACE` qui suivent un affichage.
//! - Masquage : un seul chemin (`hide`), quelle qu'en soit la cause (raccourci, perte de focus,
//!   Échap ou copie par `hide_palette`, Alt+F4). Il masque la fenêtre, émet `palette:hidden` vers
//!   la palette (qui se remet à zéro) et, sous Windows, met la WebView au repos
//!   (`SetIsVisible(false)` : plus de rendu ni d'animation). Pas de suspension du processus :
//!   la réouverture doit rester instantanée.
//! - Le retour du focus à la fenêtre précédente est laissé au comportement natif de Windows.

use std::sync::{Mutex, PoisonError};
use std::time::{Duration, Instant};

use tauri::{
    App, AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewWindow, WebviewWindowBuilder, Window,
};

use crate::{spawn_logged, window_config};

/// Libellé de la fenêtre : cible des capabilities (`capabilities/palette.json`) et exclue
/// du plugin qui mémorise la position des fenêtres.
pub const PALETTE_LABEL: &str = "palette";

/// Événement émis vers la palette après chaque affichage (écouté par `src/lib/tauri/palette.ts`).
pub const SHOWN_EVENT: &str = "palette:shown";

/// Événement émis vers la palette après chaque masquage, quelle qu'en soit la cause : la page
/// remet alors sa recherche à zéro, avant même la prochaine ouverture.
pub const HIDDEN_EVENT: &str = "palette:hidden";

/// Largeur logique de la palette ; doit rester égale à `width` de `tauri.conf.json`.
const WIDTH: f64 = 560.0;
/// Hauteur de la barre de recherche seule (46 px + bordures) : hauteur de la fenêtre à
/// l'ouverture et sans résultat. Doit rester égale à `height` de `tauri.conf.json`.
const BAR_HEIGHT: f64 = 48.0;
/// Hauteur maximale : barre, une ligne de message, huit lignes de résultats, pied d'aide.
/// La mise en page (`src/styles/palette.css`) ne demande jamais plus.
const MAX_HEIGHT: f64 = 430.0;

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
            if let Err(e) = hide(&window) {
                eprintln!("{e}");
            }
            return;
        }
    }
    open_palette(app);
}

/// Ouvre la palette (menu de la zone de notification) : comme `toggle_palette`, mais n'a jamais
/// pour effet de la masquer.
pub fn open_palette(app: &AppHandle) {
    let app = app.clone();
    spawn_logged(move || show_palette(&app));
}

/// Masque la palette sans la détruire : seul chemin de masquage (voir l'en-tête du module).
pub fn hide(window: &WebviewWindow) -> Result<(), String> {
    // Déjà masquée : rien à faire. Chaque masquage fait perdre le focus, ce qui rappelle `hide` ;
    // sans ce test, `palette:hidden` serait émis deux fois.
    if !window.is_visible().unwrap_or(true) {
        return Ok(());
    }
    window
        .hide()
        .map_err(|e| format!("Masquage de la palette impossible : {e}"))?;
    let emitted = window
        .emit_to(PALETTE_LABEL, HIDDEN_EVENT, ())
        .map_err(|e| format!("Événement {HIDDEN_EVENT} non émis : {e}"));
    set_webview_visible(window, false);
    emitted
}

/// Masque la palette si elle existe (fenêtre reçue d'un événement : `Window`, pas `WebviewWindow`).
fn hide_existing(app: &AppHandle) -> Result<(), String> {
    match app.get_webview_window(PALETTE_LABEL) {
        Some(window) => hide(&window),
        None => Ok(()),
    }
}

/// Alt+F4 sur la palette (`lib.rs`) : masquée, jamais détruite.
pub fn on_close_requested(window: &Window) {
    if let Err(e) = hide_existing(window.app_handle()) {
        eprintln!("{e}");
    }
}

/// Met la WebView au repos (ou la réveille) : WebView2 cesse de peindre et d'animer une page
/// invisible. Sans objet hors Windows.
#[cfg(windows)]
fn set_webview_visible(window: &WebviewWindow, visible: bool) {
    let result = window.with_webview(move |webview| {
        // SAFETY : appel COM sur le contrôleur WebView2 de cette fenêtre, que Tauri exécute sur
        // le fil de l'interface, propriétaire du contrôleur.
        if let Err(e) = unsafe { webview.controller().SetIsVisible(visible) } {
            eprintln!("Visibilité de la WebView de la palette non modifiée : {e}");
        }
    });
    if let Err(e) = result {
        eprintln!("WebView de la palette inaccessible : {e}");
    }
}

#[cfg(not(windows))]
fn set_webview_visible(_window: &WebviewWindow, _visible: bool) {}

/// Crée la palette, masquée, si elle n'existe pas encore. Appelée dans `setup` (fil principal,
/// avant la boucle d'événements). Un échec n'empêche pas le démarrage ; la palette sera alors
/// créée à la première utilisation.
pub fn preload_palette(app: &App) {
    let _guard = SHOW_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    if app.get_webview_window(PALETTE_LABEL).is_some() {
        return;
    }
    if let Err(e) = create_palette(app) {
        eprintln!("{e}");
    }
}

/// Crée la palette si besoin, la centre sur l'écran principal, l'affiche, lui donne le focus
/// et émet `palette:shown`. À appeler hors du fil principal (voir `toggle_palette`).
pub fn show_palette(app: &AppHandle) -> Result<(), String> {
    let _guard = SHOW_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let window = match app.get_webview_window(PALETTE_LABEL) {
        Some(window) => window,
        None => create_palette(app)?,
    };
    // Toujours rouverte réduite à la barre : jamais la taille de l'affichage précédent.
    if let Err(e) = window.set_size(LogicalSize::new(WIDTH, BAR_HEIGHT)) {
        eprintln!("Taille de la palette non réinitialisée : {e}");
    }
    center_on_primary(&window);
    mark_shown();
    // Réveillée avant d'être montrée : jamais une fenêtre visible sur une WebView au repos.
    set_webview_visible(&window, true);
    window
        .show()
        .map_err(|e| format!("Affichage de la palette impossible : {e}"))?;
    if let Err(e) = window.set_focus() {
        eprintln!("Focus de la palette impossible : {e}");
    }
    app.emit_to(PALETTE_LABEL, SHOWN_EVENT, ())
        .map_err(|e| format!("Événement {SHOWN_EVENT} non émis : {e}"))
}

/// Crée la fenêtre (invisible) à partir de sa déclaration dans `tauri.conf.json`.
fn create_palette<M: Manager<tauri::Wry>>(app: &M) -> Result<WebviewWindow, String> {
    let config = window_config(app, PALETTE_LABEL)?;
    let builder = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|e| format!("Configuration de la palette invalide : {e}"))?;
    builder
        .build()
        .map_err(|e| format!("Création de la fenêtre palette impossible : {e}"))
}

/// Place la fenêtre sur l'écran principal, en pixels physiques, d'après le facteur d'échelle de
/// CET écran (la fenêtre y prendra cette échelle) : centrée en largeur, et en hauteur comme si
/// elle avait sa taille maximale. Le haut de la fenêtre, donc la barre de recherche, reste ainsi
/// au même endroit quelle que soit la hauteur ; les résultats se développent vers le bas.
/// Sans écran principal connu : centrage par défaut de Tauri.
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
    let height = (MAX_HEIGHT * scale).round() as i32;
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
    if let Err(e) = hide_existing(window.app_handle()) {
        eprintln!("{e}");
    }
}

/// Masque la palette sans la détruire (`hide`). Sans effet si elle n'a jamais été créée.
#[tauri::command]
pub fn hide_palette(app: AppHandle) -> Result<(), String> {
    hide_existing(&app)
}

/// Hauteur à appliquer pour une hauteur demandée par l'interface : bornée entre la barre seule
/// et le maximum. `None` si la valeur n'est pas un nombre fini (rien n'est alors changé).
pub fn clamp_height(requested: f64) -> Option<f64> {
    if requested.is_finite() {
        Some(requested.clamp(BAR_HEIGHT, MAX_HEIGHT))
    } else {
        None
    }
}

/// Ajuste la hauteur de la fenêtre palette à son contenu (issue n°19) : la fenêtre elle-même
/// change de taille, il n'y a donc jamais de zone vide sous la barre ni de surface qui capte
/// les clics. Largeur et coin haut gauche inchangés. Sans effet si la palette n'existe pas.
#[tauri::command]
pub fn set_palette_height(app: AppHandle, height: f64) -> Result<(), String> {
    let height = clamp_height(height).ok_or_else(|| "Hauteur de palette invalide.".to_string())?;
    match app.get_webview_window(PALETTE_LABEL) {
        Some(window) => window
            .set_size(LogicalSize::new(WIDTH, height))
            .map_err(|e| format!("Redimensionnement de la palette impossible : {e}")),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn height_is_clamped_between_bar_and_maximum() {
        assert_eq!(clamp_height(10.0), Some(BAR_HEIGHT));
        assert_eq!(clamp_height(BAR_HEIGHT), Some(BAR_HEIGHT));
        assert_eq!(clamp_height(200.0), Some(200.0));
        assert_eq!(clamp_height(5000.0), Some(MAX_HEIGHT));
        assert_eq!(clamp_height(-1.0), Some(BAR_HEIGHT));
    }

    #[test]
    fn non_finite_height_is_refused() {
        assert_eq!(clamp_height(f64::NAN), None);
        assert_eq!(clamp_height(f64::INFINITY), None);
        assert_eq!(clamp_height(f64::NEG_INFINITY), None);
    }
}
