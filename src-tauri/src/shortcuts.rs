//! Raccourcis clavier globaux configurables (issue n°3).
//!
//! - Trois actions : afficher / masquer la fenêtre principale, ouvrir la palette, copier la
//!   position suivante du parcours Farm affiché (`farm_window::next_step`).
//! - Au démarrage : lecture TOLÉRANTE de `settings.json` (absent, illisible, clé manquante ou
//!   invalide → valeur par défaut), puis enregistrement. Un échec n'empêche jamais le démarrage :
//!   il est mémorisé (`registered: false`) et affiché dans les Paramètres.
//! - L'association raccourci → action vit dans un état géré par l'application, sous verrou ; le
//!   gestionnaire du plugin (`lib.rs`) l'interroge par `action_for`.
//! - Changement (`set_shortcut`) : le NOUVEAU raccourci est enregistré d'abord ; en cas d'échec,
//!   l'ancien est conservé. En cas de succès, l'ancien est libéré puis `settings.json` est réécrit
//!   (écriture atomique) en conservant toutes ses autres clés.
//! - Aucune permission de raccourci global n'est donnée à l'interface : tout passe par ces commandes.
//!
//! Format accepté, insensible à la casse : modificateurs `Ctrl`, `Alt`, `Shift` (au moins `Ctrl`
//! ou `Alt`) puis UNE touche parmi `A`–`Z`, `0`–`9`, `F1`–`F12`, `Space`, séparés par `+`.
//! Forme enregistrée : `Ctrl+Alt+Shift+Touche`, dans cet ordre.

use std::sync::{Mutex, PoisonError};

use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

use crate::storage::{
    app_data_dir, lock_settings, read_json_object, read_json_object_for_write, write_atomic, SETTINGS_FILE,
    SHORTCUTS_KEY,
};

/// Défauts : `Ctrl+Alt+T` (fenêtre principale), `Ctrl+Alt+Space` (palette), `Ctrl+Alt+N`
/// (position suivante d'un parcours Farm). Éviter `Alt+Espace` (menu système de Windows) et
/// `Ctrl+Espace` (changement de méthode de saisie).
const DEFAULT_TOGGLE_MAIN: &str = "Ctrl+Alt+T";
const DEFAULT_PALETTE: &str = "Ctrl+Alt+Space";
const DEFAULT_FARM_NEXT: &str = "Ctrl+Alt+N";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    ToggleMain,
    Palette,
    FarmNext,
}

/// Toutes les actions, dans l'ordre de priorité (un même raccourci désigne la première).
const ACTIONS: [Action; 3] = [Action::ToggleMain, Action::Palette, Action::FarmNext];

impl Action {
    /// Rang dans `ACTIONS` et dans `Bindings`.
    fn index(self) -> usize {
        match self {
            Action::ToggleMain => 0,
            Action::Palette => 1,
            Action::FarmNext => 2,
        }
    }

    /// Clé dans `settings.json` et dans les échanges avec l'interface.
    fn key(self) -> &'static str {
        match self {
            Action::ToggleMain => "toggleMain",
            Action::Palette => "palette",
            Action::FarmNext => "farmNext",
        }
    }

    fn from_key(key: &str) -> Result<Action, String> {
        ACTIONS
            .into_iter()
            .find(|action| action.key() == key)
            .ok_or_else(|| format!("Action de raccourci inconnue : {key}"))
    }

    /// Libellé affiché dans les messages d'erreur (identique à l'interface).
    fn label(self) -> &'static str {
        match self {
            Action::ToggleMain => "Afficher / masquer la fenêtre",
            Action::Palette => "Ouvrir la palette",
            Action::FarmNext => "Farm : position suivante",
        }
    }

    /// Raccourci par défaut, construit sans analyse (ne peut pas échouer).
    fn default_accelerator(self) -> Accelerator {
        match self {
            Action::ToggleMain => Accelerator {
                text: DEFAULT_TOGGLE_MAIN.to_string(),
                shortcut: Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyT),
            },
            Action::Palette => Accelerator {
                text: DEFAULT_PALETTE.to_string(),
                shortcut: Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space),
            },
            Action::FarmNext => Accelerator {
                text: DEFAULT_FARM_NEXT.to_string(),
                shortcut: Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN),
            },
        }
    }
}

/// Raccourci analysé : forme texte normalisée + valeur du plugin.
#[derive(Debug, Clone, PartialEq)]
pub struct Accelerator {
    pub text: String,
    pub shortcut: Shortcut,
}

/// Raccourci effectif d'une action et état de son enregistrement auprès du système.
#[derive(Debug, Clone)]
struct Binding {
    accelerator: String,
    shortcut: Shortcut,
    registered: bool,
}

/// Raccourci de chaque action, rangé par `Action::index`.
#[derive(Debug, Clone)]
struct Bindings([Binding; 3]);

impl Bindings {
    fn get(&self, action: Action) -> &Binding {
        &self.0[action.index()]
    }

    fn set(&mut self, action: Action, binding: Binding) {
        self.0[action.index()] = binding;
    }
}

/// État géré par l'application (`app.manage`).
pub struct ShortcutStore {
    bindings: Mutex<Bindings>,
}

/// Sérialise les changements (`set_shortcut`, `reset_shortcuts`) de bout en bout.
static CHANGE_LOCK: Mutex<()> = Mutex::new(());

// ---------------------------------------------------------------------------------------------
// Logique pure (testée)
// ---------------------------------------------------------------------------------------------

fn letter_code(c: char) -> Option<Code> {
    let code = match c {
        'A' => Code::KeyA,
        'B' => Code::KeyB,
        'C' => Code::KeyC,
        'D' => Code::KeyD,
        'E' => Code::KeyE,
        'F' => Code::KeyF,
        'G' => Code::KeyG,
        'H' => Code::KeyH,
        'I' => Code::KeyI,
        'J' => Code::KeyJ,
        'K' => Code::KeyK,
        'L' => Code::KeyL,
        'M' => Code::KeyM,
        'N' => Code::KeyN,
        'O' => Code::KeyO,
        'P' => Code::KeyP,
        'Q' => Code::KeyQ,
        'R' => Code::KeyR,
        'S' => Code::KeyS,
        'T' => Code::KeyT,
        'U' => Code::KeyU,
        'V' => Code::KeyV,
        'W' => Code::KeyW,
        'X' => Code::KeyX,
        'Y' => Code::KeyY,
        'Z' => Code::KeyZ,
        _ => return None,
    };
    Some(code)
}

fn digit_code(c: char) -> Option<Code> {
    let code = match c {
        '0' => Code::Digit0,
        '1' => Code::Digit1,
        '2' => Code::Digit2,
        '3' => Code::Digit3,
        '4' => Code::Digit4,
        '5' => Code::Digit5,
        '6' => Code::Digit6,
        '7' => Code::Digit7,
        '8' => Code::Digit8,
        '9' => Code::Digit9,
        _ => return None,
    };
    Some(code)
}

fn function_code(upper: &str) -> Option<Code> {
    let code = match upper {
        "F1" => Code::F1,
        "F2" => Code::F2,
        "F3" => Code::F3,
        "F4" => Code::F4,
        "F5" => Code::F5,
        "F6" => Code::F6,
        "F7" => Code::F7,
        "F8" => Code::F8,
        "F9" => Code::F9,
        "F10" => Code::F10,
        "F11" => Code::F11,
        "F12" => Code::F12,
        _ => return None,
    };
    Some(code)
}

/// Touche principale : code du plugin + nom normalisé.
fn key_code(token: &str) -> Option<(Code, String)> {
    let upper = token.to_ascii_uppercase();
    if upper == "SPACE" {
        return Some((Code::Space, "Space".to_string()));
    }
    let mut chars = upper.chars();
    if let (Some(c), None) = (chars.next(), chars.next()) {
        if let Some(code) = letter_code(c) {
            return Some((code, c.to_string()));
        }
        if let Some(code) = digit_code(c) {
            return Some((code, c.to_string()));
        }
        return None;
    }
    function_code(&upper).map(|code| (code, upper.clone()))
}

/// Analyse et normalise un raccourci (voir le format en tête de fichier). Message en français
/// en cas de refus.
pub fn parse_accelerator(input: &str) -> Result<Accelerator, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Raccourci vide.".to_string());
    }
    let mut ctrl = false;
    let mut alt = false;
    let mut shift = false;
    let mut key: Option<(Code, String)> = None;

    for raw in trimmed.split('+') {
        let token = raw.trim();
        if token.is_empty() {
            return Err(format!("Raccourci invalide : « {trimmed} »."));
        }
        let lower = token.to_ascii_lowercase();
        match lower.as_str() {
            "ctrl" | "control" => ctrl = true,
            "alt" => alt = true,
            "shift" => shift = true,
            "super" | "win" | "windows" | "meta" | "cmd" | "command" => {
                return Err("La touche Windows n'est pas acceptée dans un raccourci.".to_string());
            }
            _ => {
                if key.is_some() {
                    return Err(format!("Une seule touche en plus de Ctrl, Alt ou Maj : « {trimmed} »."));
                }
                match key_code(token) {
                    Some(found) => key = Some(found),
                    None => {
                        return Err(format!(
                            "Touche non prise en charge : « {token} ». Utilisez une lettre, un chiffre, F1 à F12 ou Espace."
                        ));
                    }
                }
            }
        }
    }

    let Some((code, key_name)) = key else {
        return Err("Il manque une touche après les modificateurs.".to_string());
    };
    if !ctrl && !alt {
        return Err("Le raccourci doit contenir Ctrl ou Alt.".to_string());
    }

    let mut modifiers = Modifiers::empty();
    let mut parts: Vec<String> = Vec::new();
    if ctrl {
        modifiers |= Modifiers::CONTROL;
        parts.push("Ctrl".to_string());
    }
    if alt {
        modifiers |= Modifiers::ALT;
        parts.push("Alt".to_string());
    }
    if shift {
        modifiers |= Modifiers::SHIFT;
        parts.push("Shift".to_string());
    }
    parts.push(key_name);

    Ok(Accelerator {
        text: parts.join("+"),
        shortcut: Shortcut::new(Some(modifiers), code),
    })
}

/// Raccourci d'une action lu dans `settings.json` ; valeur par défaut si absent ou invalide.
fn pick(settings: &Map<String, Value>, action: Action) -> Accelerator {
    let text = settings
        .get(SHORTCUTS_KEY)
        .and_then(|shortcuts| shortcuts.get(action.key()))
        .and_then(|value| value.as_str());
    match text.map(parse_accelerator) {
        Some(Ok(accelerator)) => accelerator,
        _ => action.default_accelerator(),
    }
}

/// Raccourcis de démarrage d'après le contenu de `settings.json` (objet vide si illisible),
/// rangés par `Action::index`. Si la fenêtre et la palette ont le même raccourci, les deux
/// reviennent aux valeurs par défaut. « Position suivante » (ajoutée ensuite) sur le raccourci de
/// l'une d'elles : elle seule revient à sa valeur par défaut, sans toucher aux deux autres.
pub fn resolve(settings: &Map<String, Value>) -> [Accelerator; 3] {
    let mut toggle_main = pick(settings, Action::ToggleMain);
    let mut palette = pick(settings, Action::Palette);
    if toggle_main.shortcut == palette.shortcut {
        toggle_main = Action::ToggleMain.default_accelerator();
        palette = Action::Palette.default_accelerator();
    }
    let mut farm_next = pick(settings, Action::FarmNext);
    if farm_next.shortcut == toggle_main.shortcut || farm_next.shortcut == palette.shortcut {
        farm_next = Action::FarmNext.default_accelerator();
    }
    [toggle_main, palette, farm_next]
}

/// Réglages existants avec les raccourcis des actions remplacés (`accelerators`, rangés par
/// `Action::index`) ; toutes les autres clés, y compris d'éventuelles sous-clés inconnues de
/// `shortcuts`, sont conservées.
pub fn merge_shortcuts(settings: Map<String, Value>, accelerators: [&str; 3]) -> Map<String, Value> {
    let mut settings = settings;
    let mut shortcuts = match settings.remove(SHORTCUTS_KEY) {
        Some(Value::Object(map)) => map,
        _ => Map::new(),
    };
    for action in ACTIONS {
        shortcuts.insert(
            action.key().to_string(),
            Value::String(accelerators[action.index()].to_string()),
        );
    }
    settings.insert(SHORTCUTS_KEY.to_string(), Value::Object(shortcuts));
    settings
}

fn bindings_json(bindings: &Bindings) -> Value {
    let mut map = Map::new();
    for action in ACTIONS {
        let binding = bindings.get(action);
        map.insert(
            action.key().to_string(),
            json!({ "accelerator": binding.accelerator, "registered": binding.registered }),
        );
    }
    Value::Object(map)
}

// ---------------------------------------------------------------------------------------------
// Intégration (état géré, plugin, disque)
// ---------------------------------------------------------------------------------------------

/// Enregistre un raccourci de démarrage ; un échec est mémorisé, jamais propagé.
fn register_at_startup(app: &AppHandle, accelerator: Accelerator) -> Binding {
    let registered = match app.global_shortcut().register(accelerator.shortcut) {
        Ok(()) => true,
        Err(e) => {
            // Raccourci déjà pris par une autre application : l'app reste utilisable.
            eprintln!("Raccourci global {} indisponible : {e}", accelerator.text);
            false
        }
    };
    Binding {
        accelerator: accelerator.text,
        shortcut: accelerator.shortcut,
        registered,
    }
}

/// Au démarrage (`setup`) : lit les réglages, enregistre les raccourcis, crée l'état.
/// Ne renvoie jamais d'erreur.
pub fn init(app: &AppHandle) {
    // Lecture tolérante : un fichier absent ou illisible donne les raccourcis par défaut.
    let settings = app_data_dir(app)
        .map(|dir| read_json_object(&dir.join(SETTINGS_FILE)))
        .unwrap_or_default();
    let [toggle_main, palette, farm_next] = resolve(&settings);
    let toggle_main = register_at_startup(app, toggle_main);
    let palette = register_at_startup(app, palette);
    // Défaut de « position suivante » déjà pris par l'une des deux autres : non enregistré
    // (signalé dans les Paramètres), l'autre action garde son raccourci.
    let farm_next = if farm_next.shortcut == toggle_main.shortcut || farm_next.shortcut == palette.shortcut {
        Binding {
            accelerator: farm_next.text,
            shortcut: farm_next.shortcut,
            registered: false,
        }
    } else {
        register_at_startup(app, farm_next)
    };
    app.manage(ShortcutStore {
        bindings: Mutex::new(Bindings([toggle_main, palette, farm_next])),
    });
}

/// Première action (ordre de `ACTIONS`) dont le raccourci est `shortcut`.
fn find_action(bindings: &Bindings, shortcut: &Shortcut) -> Option<Action> {
    ACTIONS
        .into_iter()
        .find(|action| bindings.get(*action).shortcut == *shortcut)
}

/// Action associée au raccourci reçu par le plugin, ou `None`.
pub fn action_for(app: &AppHandle, shortcut: &Shortcut) -> Option<Action> {
    let store = app.try_state::<ShortcutStore>()?;
    let bindings = store.bindings.lock().unwrap_or_else(PoisonError::into_inner);
    find_action(&bindings, shortcut)
}

/// Copie de l'état courant.
fn current_bindings(app: &AppHandle) -> Result<Bindings, String> {
    let store = app
        .try_state::<ShortcutStore>()
        .ok_or_else(|| "Raccourcis non initialisés.".to_string())?;
    let bindings = store.bindings.lock().unwrap_or_else(PoisonError::into_inner);
    let copy = bindings.clone();
    Ok(copy)
}

/// Remplace l'état courant.
fn store_bindings(app: &AppHandle, next: Bindings) -> Result<(), String> {
    let store = app
        .try_state::<ShortcutStore>()
        .ok_or_else(|| "Raccourcis non initialisés.".to_string())?;
    let mut bindings = store.bindings.lock().unwrap_or_else(PoisonError::into_inner);
    *bindings = next;
    Ok(())
}

/// Écrit les raccourcis dans `settings.json` (écriture atomique, autres clés conservées).
fn persist(app: &AppHandle, bindings: &Bindings) -> Result<(), String> {
    let path = app_data_dir(app)?.join(SETTINGS_FILE);
    let _guard = lock_settings();
    let accelerators = ACTIONS.map(|action| bindings.get(action).accelerator.as_str());
    let merged = merge_shortcuts(read_json_object_for_write(&path)?, accelerators);
    let text = serde_json::to_string_pretty(&Value::Object(merged))
        .map_err(|e| format!("Réglages non sérialisables : {e}"))?;
    write_atomic(&path, &text)
}

fn persist_or_explain(app: &AppHandle, bindings: &Bindings) -> Result<(), String> {
    persist(app, bindings).map_err(|e| format!("Raccourci actif pour cette session, mais non mémorisé : {e}"))
}

/// Raccourcis effectifs et, pour chacun, s'il est actuellement enregistré :
/// `{ "toggleMain": { "accelerator", "registered" }, "palette": { … }, "farmNext": { … } }`.
#[tauri::command]
pub fn get_shortcuts(app: AppHandle) -> Result<Value, String> {
    let bindings = current_bindings(&app)?;
    Ok(bindings_json(&bindings))
}

/// Change le raccourci d'une action. Renvoie le nouvel état (même forme que `get_shortcuts`).
/// Exécutée hors du fil principal (`async`) : l'enregistrement d'un raccourci repasse par le fil
/// principal et ne doit pas l'attendre depuis lui-même.
#[tauri::command(async)]
pub fn set_shortcut(app: AppHandle, action: String, accelerator: String) -> Result<Value, String> {
    let _change = CHANGE_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let action = Action::from_key(&action)?;
    let wanted = parse_accelerator(&accelerator)?;
    let mut bindings = current_bindings(&app)?;
    let current = bindings.get(action).clone();

    if let Some(other) = ACTIONS
        .into_iter()
        .find(|other| *other != action && bindings.get(*other).shortcut == wanted.shortcut)
    {
        return Err(format!(
            "{} est déjà le raccourci de « {} ».",
            wanted.text,
            other.label()
        ));
    }

    let same = wanted.shortcut == current.shortcut;
    if !(same && current.registered) {
        // Le nouveau d'abord : en cas d'échec, l'ancien reste actif et l'état ne change pas.
        if let Err(e) = app.global_shortcut().register(wanted.shortcut) {
            return Err(format!(
                "Impossible d'utiliser {} : il est sans doute déjà pris par une autre application. \
                 Le raccourci précédent est conservé. (Détail : {e})",
                wanted.text
            ));
        }
        if !same && current.registered {
            if let Err(e) = app.global_shortcut().unregister(current.shortcut) {
                eprintln!(
                    "Libération de l'ancien raccourci {} impossible : {e}",
                    current.accelerator
                );
            }
        }
    }

    bindings.set(
        action,
        Binding {
            accelerator: wanted.text,
            shortcut: wanted.shortcut,
            registered: true,
        },
    );
    store_bindings(&app, bindings.clone())?;
    persist_or_explain(&app, &bindings)?;
    Ok(bindings_json(&bindings))
}

/// Rétablit les raccourcis par défaut. Les raccourcis actuels sont libérés d'abord (ce qui
/// permet d'échanger deux raccourcis) ; un défaut indisponible reste signalé `registered: false`.
/// Exécutée hors du fil principal (`async`) : l'enregistrement d'un raccourci repasse par le fil
/// principal et ne doit pas l'attendre depuis lui-même.
#[tauri::command(async)]
pub fn reset_shortcuts(app: AppHandle) -> Result<Value, String> {
    let _change = CHANGE_LOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let current = current_bindings(&app)?;

    for action in ACTIONS {
        let binding = current.get(action);
        let standard = action.default_accelerator();
        if binding.registered && binding.shortcut != standard.shortcut {
            if let Err(e) = app.global_shortcut().unregister(binding.shortcut) {
                eprintln!("Libération du raccourci {} impossible : {e}", binding.accelerator);
            }
        }
    }

    let mut next = current.clone();
    for action in ACTIONS {
        let binding = current.get(action);
        let standard = action.default_accelerator();
        let registered = if binding.registered && binding.shortcut == standard.shortcut {
            true
        } else {
            match app.global_shortcut().register(standard.shortcut) {
                Ok(()) => true,
                Err(e) => {
                    eprintln!("Raccourci global {} indisponible : {e}", standard.text);
                    false
                }
            }
        };
        next.set(
            action,
            Binding {
                accelerator: standard.text,
                shortcut: standard.shortcut,
                registered,
            },
        );
    }

    store_bindings(&app, next.clone())?;
    persist_or_explain(&app, &next)?;
    Ok(bindings_json(&next))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::parse_json_object;

    fn settings(text: &str) -> Map<String, Value> {
        parse_json_object(text.as_bytes())
    }

    fn ctrl_alt(code: Code) -> Shortcut {
        Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), code)
    }

    #[test]
    fn defaults_are_valid_and_distinct() {
        for action in ACTIONS {
            let standard = action.default_accelerator();
            assert_eq!(parse_accelerator(&standard.text), Ok(standard.clone()));
        }
        for a in ACTIONS {
            for b in ACTIONS {
                if a != b {
                    assert_ne!(a.default_accelerator().shortcut, b.default_accelerator().shortcut);
                }
            }
        }
    }

    #[test]
    fn parses_and_normalizes() {
        let parsed = parse_accelerator(" alt + ctrl + t ").unwrap();
        assert_eq!(parsed.text, "Ctrl+Alt+T");
        assert_eq!(parsed.shortcut, ctrl_alt(Code::KeyT));

        let parsed = parse_accelerator("Control+Alt+space").unwrap();
        assert_eq!(parsed.text, "Ctrl+Alt+Space");
        assert_eq!(parsed.shortcut, ctrl_alt(Code::Space));

        let parsed = parse_accelerator("Shift+Ctrl+F12").unwrap();
        assert_eq!(parsed.text, "Ctrl+Shift+F12");
        assert_eq!(
            parsed.shortcut,
            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::F12)
        );

        let parsed = parse_accelerator("Alt+7").unwrap();
        assert_eq!(parsed.text, "Alt+7");
        assert_eq!(parsed.shortcut, Shortcut::new(Some(Modifiers::ALT), Code::Digit7));
    }

    #[test]
    fn refuses_invalid_accelerators() {
        for input in [
            "",
            "   ",
            "T",
            "Shift+T",
            "Ctrl+Alt",
            "Ctrl+",
            "Ctrl++T",
            "Ctrl+Alt+T+U",
            "Ctrl+Alt+F13",
            "Ctrl+Alt+Enter",
            "Ctrl+Alt+é",
            "Super+T",
            "Ctrl+Win+T",
            "Ctrl+Alt+TT",
        ] {
            assert!(parse_accelerator(input).is_err(), "devrait être refusé : {input:?}");
        }
    }

    #[test]
    fn resolve_is_tolerant() {
        let defaults = ACTIONS.map(Action::default_accelerator);
        // Fichier absent ou illisible.
        assert_eq!(resolve(&Map::new()), defaults);
        assert_eq!(resolve(&settings("")), defaults);
        assert_eq!(resolve(&settings("{ corrompu")), defaults);
        assert_eq!(resolve(&settings("[1, 2]")), defaults);
        // Ancien format, sans raccourcis.
        assert_eq!(resolve(&settings(r#"{"alwaysOnTop":true}"#)), defaults);
        // Valeurs de mauvais type ou invalides : défaut, clé par clé.
        assert_eq!(resolve(&settings(r#"{"shortcuts":"Ctrl+Alt+K"}"#)), defaults);
        let [toggle, palette, farm] = resolve(&settings(
            r#"{"shortcuts":{"toggleMain":42,"palette":"ctrl+alt+k","farmNext":"alt+f2"}}"#,
        ));
        assert_eq!(toggle, Action::ToggleMain.default_accelerator());
        assert_eq!(palette.text, "Ctrl+Alt+K");
        assert_eq!(farm.text, "Alt+F2");
        let [toggle, palette, farm] = resolve(&settings(r#"{"shortcuts":{"toggleMain":"T","palette":"Ctrl+Alt+P"}}"#));
        assert_eq!(toggle, Action::ToggleMain.default_accelerator());
        assert_eq!(palette.text, "Ctrl+Alt+P");
        assert_eq!(farm, Action::FarmNext.default_accelerator());
    }

    #[test]
    fn resolve_refuses_duplicates() {
        let both = resolve(&settings(
            r#"{"shortcuts":{"toggleMain":"Ctrl+Alt+K","palette":"alt+ctrl+k"}}"#,
        ));
        assert_eq!(both, ACTIONS.map(Action::default_accelerator));

        // « Position suivante » sur le raccourci d'une autre action : elle seule revient au défaut.
        let [toggle, palette, farm] = resolve(&settings(
            r#"{"shortcuts":{"toggleMain":"Ctrl+Alt+M","palette":"Ctrl+Alt+P","farmNext":"alt+ctrl+p"}}"#,
        ));
        assert_eq!(toggle.text, "Ctrl+Alt+M");
        assert_eq!(palette.text, "Ctrl+Alt+P");
        assert_eq!(farm, Action::FarmNext.default_accelerator());
    }

    #[test]
    fn merge_keeps_other_keys() {
        let existing =
            settings(r#"{"alwaysOnTop":false,"futur":{"a":1},"shortcuts":{"toggleMain":"Ctrl+Alt+T","autre":"x"}}"#);
        let merged = Value::Object(merge_shortcuts(existing, ["Ctrl+Alt+M", "Ctrl+Alt+P", "Ctrl+Alt+N"]));
        assert_eq!(merged["alwaysOnTop"], Value::Bool(false));
        assert_eq!(merged["futur"]["a"], Value::from(1));
        assert_eq!(merged["shortcuts"]["toggleMain"], Value::from("Ctrl+Alt+M"));
        assert_eq!(merged["shortcuts"]["palette"], Value::from("Ctrl+Alt+P"));
        assert_eq!(merged["shortcuts"]["farmNext"], Value::from("Ctrl+Alt+N"));
        assert_eq!(merged["shortcuts"]["autre"], Value::from("x"));

        // `shortcuts` d'un type inattendu : remplacé par un objet propre.
        let mut odd = Map::new();
        odd.insert(SHORTCUTS_KEY.to_string(), Value::from(3));
        let merged = Value::Object(merge_shortcuts(odd, ["Ctrl+Alt+M", "Ctrl+Alt+P", "Ctrl+Alt+N"]));
        assert_eq!(merged["shortcuts"]["palette"], Value::from("Ctrl+Alt+P"));
    }

    #[test]
    fn action_keys_round_trip() {
        for (i, action) in ACTIONS.into_iter().enumerate() {
            assert_eq!(Action::from_key(action.key()), Ok(action));
            assert_eq!(action.index(), i);
        }
        assert!(Action::from_key("autre").is_err());
    }

    #[test]
    fn same_shortcut_goes_to_the_first_action() {
        let binding = |accelerator: Accelerator| Binding {
            accelerator: accelerator.text,
            shortcut: accelerator.shortcut,
            registered: true,
        };
        let bindings = Bindings(ACTIONS.map(|action| binding(action.default_accelerator())));
        assert_eq!(find_action(&bindings, &ctrl_alt(Code::KeyN)), Some(Action::FarmNext));
        assert_eq!(find_action(&bindings, &ctrl_alt(Code::KeyQ)), None);

        // Défaut de « position suivante » déjà pris par la palette : la palette l'emporte.
        let shared = Bindings([
            binding(Action::ToggleMain.default_accelerator()),
            binding(Action::FarmNext.default_accelerator()),
            binding(Action::FarmNext.default_accelerator()),
        ]);
        assert_eq!(find_action(&shared, &ctrl_alt(Code::KeyN)), Some(Action::Palette));
    }
}
