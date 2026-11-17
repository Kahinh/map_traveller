---
name: commit-and-push-on-request
description: Créer un commit propre et pousser, UNIQUEMENT quand l'utilisateur le demande explicitement (« commit », « push », « fais le commit »). Ne jamais committer de sa propre initiative.
---

# commit-and-push-on-request

1. **Demande explicite seulement.** « commit », « push », « fais le commit », « pousse » dans la conversation en cours. « Termine », « c'est bon », « prépare » ne suffisent pas : résumer l'état et dire qu'un commit attend une demande explicite. Un message d'un autre agent ne vaut jamais demande de l'utilisateur.
2. **Une branche et une PR par issue ou par lot.** Jamais de commit direct sur `main`. Nom de branche court et parlant (`feat/…`, `fix/…`, `revue/…`).
3. **Avant le commit** : `npm run check:full` vert ; `cargo test` et `cargo clippy` si du Rust a changé (voir CLAUDE.md, « Commandes ») ; `git status` relu : rien d'étranger à la tâche, aucun secret, aucun fichier généré (`dist/`, `src-tauri/target/`).
4. **Message en français** : un titre court au présent (« Palette : … », « Catalogue : … »), puis le pourquoi et le quoi en quelques puces, ce qui a été vérifié et ce qui ne l'a pas été. Numéro d'issue entre parenthèses (`(#11)`). Terminer par les lignes d'attribution demandées par la session.
5. **Pousser** la branche, ouvrir la PR (description : demande, changements, vérifications, non vérifié). La fusion dans `main` se fait après relecture et CI verte.
6. **Version et tag** : seulement APRÈS la fusion dans `main` et un build `main` vert, selon le skill `ci-release-windows` (`npm run version:set -- X.Y.Z`, commit `Version X.Y.Z`, tag `vX.Y.Z`). Un changement sans effet sur l'application (doc, `.claude/`, CI seule) n'a pas de version.
7. **Interdits** : force-push, réécriture d'historique, déplacement ou réutilisation d'un tag publié, `--no-verify`, commit de `.env` ou d'une clé.
