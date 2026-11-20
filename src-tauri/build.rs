// Commandes de l'application déclarées à Tauri : chacune reçoit une permission
// `allow-<commande>`, et une fenêtre ne peut appeler que celles que sa capability accorde
// (`capabilities/`). Sans cette liste, toute fenêtre pourrait appeler toutes les commandes.
// Doit rester identique à `generate_handler!` dans `src/lib.rs`.
const COMMANDS: &[&str] = &[
    "load_store",
    "save_store",
    "data_dir",
    "open_data_dir",
    "import_image",
    "read_image",
    "save_thumbnail",
    "hide_palette",
    "set_palette_height",
    "open_farm",
    "get_farm_id",
    "hide_farm",
    "minimize_main",
    "set_main_busy",
    "get_shortcuts",
    "set_shortcut",
    "reset_shortcuts",
];

fn main() {
    let manifest = tauri_build::AppManifest::new().commands(COMMANDS);
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(manifest))
        .expect("échec de la préparation du build Tauri");
}
