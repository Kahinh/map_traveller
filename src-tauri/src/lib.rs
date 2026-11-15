//! Map Traveller — point d'entrée Tauri.
//!
//! Le Rust gère uniquement : stockage local (JSON, images), fenêtres, raccourcis globaux et
//! intégration Windows (dont l'ouverture du dossier de données dans l'Explorateur). Les règles de copie sont des fonctions pures côté TypeScript (`src/features/`).
//! Les mises à jour se limitent ici à l'enregistrement des plugins `updater` et `process`.
//!
//! Durée de vie (issue n°14) : le processus vit tant qu'on ne quitte pas EXPLICITEMENT (bouton
//! fermer de la fenêtre principale, « Quitter » de la zone de notification, relance après une
//! mise à jour). Réduire dans la zone de notification détruit la fenêtre principale
//! (`main_window.rs`) ; l'icône (`tray.rs`), les raccourcis et la palette masquée restent.

mod images;
mod main_window;
mod palette;
mod shortcuts;
mod storage;
mod tray;

use main_window::MAIN_LABEL;
use tauri::{Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_global_shortcut::ShortcutState;

    tauri::Builder::default()
        // Doit être enregistré en premier : un 2e lancement réaffiche la fenêtre existante.
        // La fenêtre est recréée si elle a été détruite (zone de notification).
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            main_window::show(app);
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
                        Some(shortcuts::Action::ToggleMain) => main_window::toggle(app),
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
                    // palette masquée laisserait un processus sans fenêtre visible. Sortie
                    // explicite (`exit`) : laissée passer par `RunEvent::ExitRequested` ci-dessous.
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
            // Zone de notification : un échec n'empêche pas le démarrage ; la fenêtre principale
            // n'est alors jamais détruite (réduire = barre des tâches).
            match tray::init(app.handle()) {
                Ok(()) => main_window::set_tray_ready(),
                Err(e) => eprintln!("{e}"),
            }
            // Palette créée masquée dès maintenant : première ouverture immédiate.
            palette::preload_palette(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage::load_store,
            storage::save_store,
            storage::data_dir,
            storage::open_data_dir,
            images::import_image,
            palette::hide_palette,
            main_window::minimize_main,
            main_window::set_main_busy,
            shortcuts::get_shortcuts,
            shortcuts::set_shortcut,
            shortcuts::reset_shortcuts,
        ])
        .build(tauri::generate_context!())
        .expect("échec du démarrage de Map Traveller")
        .run(|_app, event| {
            // Sortie demandée par le système (`code: None`), par exemple quand plus aucune
            // fenêtre n'existe : refusée, l'application reste dans la zone de notification.
            // Les sorties explicites (`exit`, `restart`) portent un code et passent.
            if let RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
            }
        });
}
