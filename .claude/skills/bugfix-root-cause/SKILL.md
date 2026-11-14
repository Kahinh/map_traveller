---
name: bugfix-root-cause
description: Corriger un bug de Map Traveller par la cause racine — reproduire par un test, corriger au bon niveau (pur / Tauri / UI), vérifier l'absence de régression. À utiliser pour tout comportement incorrect signalé.
---

# bugfix-root-cause

1. Reformuler le symptôme : entrée exacte (texte de `command`, clic, étape) → résultat obtenu vs attendu.
2. Localiser via CodeGraph (`codegraph query <symbole>`) puis lecture ciblée.
3. **Reproduire par un test qui échoue** (Vitest pour toute logique pure). Pas de correctif sans reproduction, sauf impossibilité justifiée (UI Windows, Rust sans cargo).
4. Corriger la cause, pas le symptôme. Pas de rustine dans un composant si l'erreur est dans une fonction pure.
5. `npm run typecheck && npm run lint && npm test`.
6. Rapport : cause, correctif, test ajouté, ce qui reste non vérifié.
