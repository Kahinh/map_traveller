---
name: bugfix-root-cause
description: Corriger un bug de Map Traveller par la cause racine — reproduire par un test, corriger au bon niveau (pur / Tauri / UI), vérifier l'absence de régression. À utiliser pour tout comportement incorrect signalé.
---

# bugfix-root-cause

1. Reformuler le symptôme : entrée exacte (texte de `command`, clic, étape) → résultat obtenu vs attendu.
2. Localiser via CodeGraph (`codegraph query <symbole>`) puis lecture ciblée.
3. **Reproduire par un test qui échoue** (Vitest pour toute logique pure). Rust : test `#[cfg(test)]` lancé par `cargo test` (possible sous Linux, voir CLAUDE.md). Pas de correctif sans reproduction, sauf impossibilité justifiée (comportement natif Windows, code `cfg(windows)`).
4. Corriger la cause, pas le symptôme. Pas de rustine dans un composant si l'erreur est dans une fonction pure.
5. `npm run check` (et `cargo test` / `cargo clippy --all-targets -- -D warnings` si du Rust a changé). Trois tentatives au maximum sur un même échec ; au-delà, s'arrêter et exposer ce qui a été essayé.
6. Rapport : cause, correctif, test ajouté, ce qui reste non vérifié.
7. Ajouter une note dans `docs/agent-notes.md` : le test ajouté est le garde-fou.
