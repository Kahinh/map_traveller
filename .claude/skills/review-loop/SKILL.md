---
name: review-loop
description: Boucle de revue bornée après une tâche moyenne ou complexe de Map Traveller — un relecteur en lecture seule produit des constats, un correcteur traite ceux qui sont retenus, trois tours au maximum. À utiliser quand l'utilisateur demande une revue avec corrections, ou en fin de `feature-delivery` sur un changement qui touche plusieurs couches.
---

# review-loop

But : fermer la boucle « écrire → vérifier → corriger » sans tourner en rond ni noyer le contexte.

## Rôles

- **Orchestrateur** (toi) : lance les tours, choisit les constats à corriger, tient le compte. Il ne relit pas le code lui-même et ne corrige rien lui-même pendant la boucle.
- **Relecteur** : agent `reviewer`, lecture seule. Il renvoie des constats, pas de prose.
- **Correcteur** : agent `implementation` (ou `tauri-rust` / `ui-da` selon la zone), limité aux constats retenus.

## Un tour

1. `npm run check` (ou `npm run check:full` au dernier tour). Si la commande échoue, c'est le premier constat.
2. Relecteur : lui donner le périmètre (`git diff --stat`) et lui demander une liste de constats, chacun avec : fichier et ligne, gravité (`bloquant`, `important`, `mineur`), ce qui ne va pas, comment le vérifier.
3. Trier : retenir les constats `bloquant` et `important` qui sont **dans le périmètre** de la tâche. Un constat hors périmètre devient une note dans `docs/agent-notes.md` ou une issue, pas une correction.
4. Correcteur : lui donner uniquement les constats retenus, avec la consigne de ne rien toucher d'autre.
5. Afficher l'état du tour : numéro, constats retenus, corrigés, restants.

## Arrêt

- Aucun constat `bloquant` ni `important` : la boucle est terminée.
- **Trois tours au maximum.** Au-delà, s'arrêter et remettre à l'utilisateur la liste des constats non résolus, avec ce qui a été essayé. Ne pas ouvrir un quatrième tour.
- Un même constat qui revient deux fois : s'arrêter et demander, c'est un désaccord de conception, pas un bug.

## Ce que la boucle ne couvre pas

- Le Rust : sans `cargo` local, sa validation est la CI (`npm run ci:watch`), une fois le changement poussé avec l'accord de l'utilisateur.
- Le rendu : un relecteur sans navigateur ne voit rien. Les changements visuels se contrôlent selon « Validation de l'interface » de `CLAUDE.md`.
- Le comportement natif sous Windows : à lister comme non vérifié.

## En sortie

Résumé pour l'utilisateur : ce qui a été trouvé, ce qui a été corrigé, ce qui reste, ce qui n'a pas pu être vérifié. Les frictions réelles vont dans `docs/agent-notes.md`.
