//! Map Traveller — point d'entrée Tauri.
//!
//! Le Rust gère uniquement : stockage local (JSON, images), fenêtres, raccourcis globaux et
//! intégration Windows (dont l'ouverture du dossier de données dans l'Explorateur). Les règles de copie sont des fonctions pures côté TypeScript (`src/features/`).
//! Les mises à jour se limitent ici à l'enregistrement des plugins `updater` et `process`.

mod images;
mod palette;
mod shortcuts;
mod storage;

use tauri::{AppHandle, Manager, WindowEvent};

/// Libellé de la fenêtre principale (`tauri.conf.json`, `capabilities/default.json`).
const MAIN_LABEL: &str = "main";

/// Affiche la fenêtre principale si elle est cachée/réduite, la cache sinon.
fn toggle_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_LABEL) {
        let visible = w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false);
        if visible {
            let _ = w.hide();
        } else {
            show_main_window(app);
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_LABEL) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_global_shortcut::ShortcutState;

    tauri::Builder::default()
        // Doit être enregistré en premier : un 2e lancement réaffiche la fenêtre existante.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        // La palette est toujours recentrée sur l'écran principal : sa position n'est pas mémorisée.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&[palette::PALETTE_LABEL])
                .build(),
        )
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        // Mises à jour (issue n°5) : configuration dans `tauri.conf.json` (`plugins.updater`),
        // toute la logique côté interface (`useUpdater`). Le plugin de processus sert à la relance.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                // Raccourcis configurables (`shortcuts.rs`) : l'action est retrouvée dans l'état géré.
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    match shortcuts::action_for(app, shortcut) {
                        Some(shortcuts::Action::ToggleMain) => toggle_main_window(app),
                        Some(shortcuts::Action::Palette) => palette::toggle_palette(app),
                        None => {}
                    }
                })
                .build(),
        )
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == MAIN_LABEL {
                    // Fermer la fenêtre principale quitte TOUTE l'application : sans cela, la
                    // palette masquée laisserait un processus sans fenêtre visible.
                    window.app_handle().exit(0);
                } else if window.label() == palette::PALETTE_LABEL {
                    // Alt+F4 sur la palette : masquée, jamais détruite.
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            WindowEvent::Focused(false) => palette::on_focus_lost(window),
            _ => {}
        })
        .setup(|app| {
            storage::ensure_initialized(app.handle())?;
            // Ne renvoie jamais d'erreur : un raccourci indisponible n'empêche pas le démarrage.
            shortcuts::init(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage::load_store,
            storage::save_store,
            storage::data_dir,
            storage::open_data_dir,
            images::import_image,
            palette::hide_palette,
            shortcuts::get_shortcuts,
            shortcuts::set_shortcut,
            shortcuts::reset_shortcuts,
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de Map Traveller");
}
