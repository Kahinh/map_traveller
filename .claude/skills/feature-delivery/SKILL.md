---
name: feature-delivery
description: Orchestrer une nouvelle fonctionnalité de Map Traveller de l'issue au code testé (front React, logique pure, Rust/Tauri, données). Ne pas utiliser pour un bug isolé (→ bugfix-root-cause).
---

# feature-delivery

## Procédure

0. Proportionner : une petite modification sans risque ne passe pas par cette procédure (la faire, lire le diff, `npm run check`). Lancer `npm run context -- <mots>` pour savoir quoi lire.
1. Annoncer ce skill. Relire l'issue, les invariants de `CLAUDE.md` concernés et la section du README qui décrit le comportement visible.
2. Cadrer avec l'agent `architecte` si la tâche touche plus d'une couche (pure / UI / Rust / données).
3. Choisir les skills secondaires :
   - règles de copie → `copy-rules`
   - données, fichiers, images → `catalog-storage`
   - visuel → `ui-da-pnj`
   - CI / installateur → `ci-release-windows`
4. Ordre d'implémentation : **tests des fonctions pures → fonctions pures → pont Tauri → UI**.
5. `npm run check` pendant le travail, `npm run check:full` avant de rendre la main ; si du Rust a changé, `cargo test` et `cargo clippy --all-targets -- -D warnings` dans `src-tauri/`. Changement visuel : contrôle dans le navigateur selon « Validation de l'interface » de `CLAUDE.md`.
6. Mettre à jour README / `docs/` si le comportement visible change, et une ligne de `CHANGELOG.md` (section non publiée).
7. Agent `reviewer` pour toute tâche moyenne ou complexe ; s'il faut corriger après revue, suivre le skill `review-loop` (trois tours au maximum).
8. Signaler explicitement ce qui n'a pas pu être vérifié (code `cfg(windows)`, rendu Windows réel, essai réel en jeu) et l'ajouter à `docs/recette-v1.md` s'il doit être contrôlé à la main avant une publication.
9. Noter dans `docs/agent-notes.md` les frictions réelles de la tâche (corrections demandées, erreurs trouvées en revue, outil trompeur).
10. Une fois la livraison fusionnée dans `main` et le build vert : monter la version et taguer pour publier le `.exe` (règle du skill `ci-release-windows`).

## Hors périmètre V1 (refuser ou demander)

Backend HTTP, compte, cloud, SQLite, télémétrie, collage automatique dans le jeu, lecture mémoire, trajets réels inventés. Prévu après la 1.0, à cadrer d'abord avec l'utilisateur : import / export ZIP, nettoyage des images orphelines.
