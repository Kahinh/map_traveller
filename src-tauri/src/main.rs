// Pas de console supplémentaire en release sur Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    map_traveller_lib::run()
}
