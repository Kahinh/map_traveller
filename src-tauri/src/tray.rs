//! Icône de la zone de notification (issue n°14).
//!
//! - Icône par défaut de l'application, infobulle « Map Traveller ».
//! - Clic gauche : afficher / masquer la fenêtre principale (même action que le raccourci).
//! - Clic droit : menu Afficher, Ouvrir la palette, Quitter.
//! - Aucune permission côté interface : tout est géré ici, en Rust.

use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::AppHandle;

use crate::{main_window, palette};

const TRAY_ID: &str = "map-traveller";
const TOOLTIP: &str = "Map Traveller";

const MENU_SHOW: &str = "tray-show";
const MENU_PALETTE: &str = "tray-palette";
const MENU_QUIT: &str = "tray-quit";

/// Crée l'icône et son menu. Appelée une fois, dans `setup`.
pub fn init(app: &AppHandle) -> Result<(), String> {
    let menu_error = |e: tauri::Error| format!("Menu de la zone de notification impossible : {e}");
    let show =
        MenuItem::with_id(app, MENU_SHOW, "Afficher", true, None::<&str>).map_err(menu_error)?;
    let open_palette =
        MenuItem::with_id(app, MENU_PALETTE, "Ouvrir la palette", true, None::<&str>)
            .map_err(menu_error)?;
    let separator = PredefinedMenuItem::separator(app).map_err(menu_error)?;
    let quit =
        MenuItem::with_id(app, MENU_QUIT, "Quitter", true, None::<&str>).map_err(menu_error)?;
    let menu =
        Menu::with_items(app, &[&show, &open_palette, &separator, &quit]).map_err(menu_error)?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(TOOLTIP)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(on_tray_icon_event);
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    // L'icône est conservée par l'application (table des ressources) : rien à garder ici.
    builder
        .build(app)
        .map(|_icon| ())
        .map_err(|e| format!("Icône de la zone de notification impossible : {e}"))
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    match event.id().0.as_str() {
        MENU_SHOW => main_window::show(app),
        MENU_PALETTE => palette::open_palette(app),
        // Quitter explicitement : seule sortie, avec Fermer, que `lib.rs` laisse passer.
        MENU_QUIT => app.exit(0),
        _ => {}
    }
}

fn on_tray_icon_event(tray: &TrayIcon, event: TrayIconEvent) {
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        main_window::toggle(tray.app_handle());
    }
}
