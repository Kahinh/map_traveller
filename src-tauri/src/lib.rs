//! Map Traveller — point d'entrée Tauri.
//!
//! Le Rust gère uniquement : stockage local (JSON, images), fenêtre et intégration Windows.
//! Les règles de copie sont des fonctions pures côté TypeScript (`src/features/`).

mod storage;

use tauri::{AppHandle, Manager};

/// Affiche la fenêtre principale si elle est cachée/réduite, la cache sinon.
fn toggle_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let visible = w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false);
        if visible {
            let _ = w.hide();
        } else {
            show_main_window(app);
        }
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    // Raccourci global par défaut (CdC §9) — à rendre configurable.
    let toggle_shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyT);

    tauri::Builder::default()
        // Doit être enregistré en premier : un 2e lancement réaffiche la fenêtre existante.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed && shortcut == &toggle_shortcut {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .setup(move |app| {
            storage::ensure_initialized(app.handle())?;
            if let Err(e) = app.global_shortcut().register(toggle_shortcut) {
                // Raccourci déjà pris par une autre application : l'app reste utilisable.
                eprintln!("Raccourci global Ctrl+Alt+T indisponible : {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage::load_store,
            storage::save_store,
            storage::data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de Map Traveller");
}
