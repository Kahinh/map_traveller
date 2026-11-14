---
name: feature-delivery
description: Orchestrer une nouvelle fonctionnalité de Map Traveller du cahier des charges au code testé (front React, logique pure, Rust/Tauri, données). Ne pas utiliser pour un bug isolé (→ bugfix-root-cause).
---

# feature-delivery

## Procédure

1. Annoncer ce skill. Retrouver la section du cahier des charges (`docs/cahier-des-charges.md`) et les tests d'acceptation (§13) concernés.
2. Cadrer avec l'agent `architecte` si la tâche touche plus d'une couche (pure / UI / Rust / données).
3. Choisir les skills secondaires :
   - règles de copie → `copy-rules`
   - données, fichiers, images → `catalog-storage`
   - visuel → `ui-da-pnj`
   - CI / installateur → `ci-release-windows`
4. Ordre d'implémentation : **tests des fonctions pures → fonctions pures → pont Tauri → UI**.
5. `npm run typecheck && npm run lint && npm test`.
6. Mettre à jour README / `docs/` si le comportement visible change ; cocher la case de la roadmap du README.
7. Agent `reviewer` pour toute tâche moyenne ou complexe.
8. Signaler explicitement ce qui n'a pas pu être vérifié (Rust sans `cargo` local, rendu Windows réel, essai réel en jeu).
9. Si la livraison est poussée sur `main` : monter la version et taguer pour publier le `.exe` (règle du skill `ci-release-windows`).

## Hors périmètre V1 (refuser ou demander)

Backend HTTP, compte, cloud, SQLite, télémétrie, collage automatique dans le jeu, lecture mémoire, trajets réels inventés.
