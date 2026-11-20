//! Fenêtre d'un parcours Farm : petite fenêtre toujours au premier plan, une case par position.
//!
//! - Déclarée dans `tauri.conf.json` avec `"create": false` (sans décorations, toujours au
//!   premier plan, absente de la barre des tâches, invisible à la création). Créée à la première
//!   ouverture, puis seulement masquée et réaffichée : la page garde ainsi, pour la session, la
//!   dernière position cliquée de chaque parcours.
//! - Ouverture (`open_farm`, depuis la fenêtre principale ou la palette) : l'identifiant du
//!   parcours est retenu ici (`get_farm_id`, lu par la page à son chargement), la fenêtre est
//!   affichée, puis `farm:open` lui donne l'identifiant (page déjà chargée).
//! - Fermeture (bouton de la page par `hide_farm`, ou Alt+F4) : masquée, jamais détruite.
//! - Sa position et sa taille sont mémorisées par le plugin `window-state`.

use std::sync::{Mutex, PoisonError};

use tauri::{AppHandle, Emitter, Manager, WebviewWindow, WebviewWindowBuilder, Window};

use crate::{spawn_logged, window_config};

/// Libellé de la fenêtre : cible de sa capability (`capabilities/farm.json`).
pub const FARM_LABEL: &str = "farm";

/// Événement émis vers la fenêtre à chaque ouverture, charge utile = identifiant du parcours
/// (écouté par `src/lib/tauri/farm.ts`).
pub const OPEN_EVENT: &str = "farm:open";

/// Longueur maximale d'un identifiant accepté (octets) : borne ce qui est retenu et réémis.
const MAX_ID_LEN: usize = 256;

/// Parcours affiché (ou à afficher) : lu par la page à son chargement.
static CURRENT: Mutex<Option<String>> = Mutex::new(None);

/// Sérialise les ouvertures : deux clics rapides ne créent pas deux fenêtres.
static SHOW_LOCK: Mutex<()> = Mutex::new(());

/// Vrai si `id` peut être un identifiant de destination : non vide, de longueur bornée.
pub fn is_valid_id(id: &str) -> bool {
    !id.trim().is_empty() && id.len() <= MAX_ID_LEN
}

/// Ouvre la fenêtre sur le parcours `id`. L'affichage part sur un fil dédié (`spawn_logged`) :
/// une commande synchrone s'exécute sur le fil principal, où créer une fenêtre web peut bloquer
/// l'application sous Windows.
#[tauri::command]
pub fn open_farm(app: AppHandle, id: String) -> Result<(), String> {
    if !is_valid_id(&id) {
        return Err("Identifiant de parcours invalide.".to_string());
    }
    *CURRENT.lock().unwrap_or_else(PoisonError::into_inner) = Some(id.clone());
    spawn_logged(move || show(&app, &id));
    Ok(())
}

/// Parcours à afficher, lu par la page à son chargement (elle peut manquer `farm:open`, émis
/// avant qu'elle écoute).
#[tauri::command]
pub fn get_farm_id() -> Option<String> {
    CURRENT.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

/// Masque la fenêtre (bouton fermer de la page). Sans effet si elle n'a jamais été créée.
#[tauri::command]
pub fn hide_farm(app: AppHandle) -> Result<(), String> {
    match app.get_webview_window(FARM_LABEL) {
        Some(window) => window
            .hide()
            .map_err(|e| format!("Masquage de la fenêtre du parcours impossible : {e}")),
        None => Ok(()),
    }
}

/// Alt+F4 sur la fenêtre (`lib.rs`) : masquée, jamais détruite.
pub fn on_close_requested(window: &Window) {
    if let Err(e) = window.hide() {
        eprintln!("Masquage de la fenêtre du parcours impossible : {e}");
    }
}

/// Crée la fenêtre si besoin, l'affiche, lui donne le focus et émet `farm:open`.
fn show(app: &AppHandle, id: &str) -> Result<(), String> {
    let _guard = SHOW_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let window = match app.get_webview_window(FARM_LABEL) {
        Some(window) => window,
        None => create(app)?,
    };
    window
        .show()
        .map_err(|e| format!("Affichage de la fenêtre du parcours impossible : {e}"))?;
    if let Err(e) = window.set_focus() {
        eprintln!("Focus de la fenêtre du parcours impossible : {e}");
    }
    app.emit_to(FARM_LABEL, OPEN_EVENT, id)
        .map_err(|e| format!("Événement {OPEN_EVENT} non émis : {e}"))
}

/// Crée la fenêtre à partir de sa déclaration dans `tauri.conf.json`.
fn create(app: &AppHandle) -> Result<WebviewWindow, String> {
    let config = window_config(app, FARM_LABEL)?;
    WebviewWindowBuilder::from_config(app, &config)
        .map_err(|e| format!("Configuration de la fenêtre du parcours invalide : {e}"))?
        .build()
        .map_err(|e| format!("Création de la fenêtre du parcours impossible : {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_non_empty_and_bounded() {
        assert!(is_valid_id("officiel-tremble"));
        assert!(!is_valid_id(""));
        assert!(!is_valid_id("   "));
        assert!(is_valid_id(&"a".repeat(MAX_ID_LEN)));
        assert!(!is_valid_id(&"a".repeat(MAX_ID_LEN + 1)));
    }
}
