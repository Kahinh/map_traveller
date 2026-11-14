---
name: copy-rules
description: Règles de copie de Map Traveller — clic gauche (sans /zaap initial), clic droit (commande complète), reprise Farm par indice d'étape. À utiliser pour toute modification de src/features/commands, src/features/farm ou de leurs tests, et pour tout bug « mauvaise commande copiée ».
---

# copy-rules

Source de vérité : cahier des charges §4 et §5 (`docs/cahier-des-charges.md`).

## Invariants

1. Le champ `command` est du **texte brut** saisi par l'utilisateur. On ne le reconstruit jamais, on ne le normalise jamais.
2. **Clic gauche** (`leftClickCommand`) : si le **premier segment** (jusqu'au premier `;`) est une commande `/zaap` (frontière de mot : `/zaap` suivi d'un espace, d'une fin ou d'un `;` — pas `/zaapi`), retirer ce segment **et** son `;`. Le reste est copié octet pour octet. Sinon : copie intégrale. Jamais de `replace` global sur `/zaap`.
3. **Clic droit** (`rightClickCommand`) : copie intégrale.
4. Commande vide / blanche → `null` (rien copié, avertissement UI).
5. **Farm** (`parseFarmRoute`, `farmResumeCommand`) :
   - découpage en segments sur `;` en conservant le texte original de chaque segment ;
   - un `/zaap` initial éventuel est mis à part (`zaapPrefix`), il n'est **pas** une étape ;
   - chaque `/travel X Y` est une étape avec un **indice** ; coordonnées = libellé uniquement ;
   - segments non reconnus → listés dans `issues`, jamais supprimés en silence ;
   - « Démarrer depuis le début » → commande complète (Zaap inclus) ;
   - clic sur l'étape `i` → segments originaux des étapes `i+1..n` joints par `;` ; dernière étape → `null` (fin de parcours).
   - coordonnées répétées : seul l'indice compte.
6. Multi-ligne : les retours à la ligne sont conservés tels quels ; ajouter un test pour tout nouveau cas inhabituel.

## Procédure

1. Écrire/adapter d'abord le test dans `tests/` (Vitest), à partir des exemples **fictifs** du cahier des charges.
2. Modifier la fonction pure.
3. `npm test` + `npm run typecheck`.
4. Vérifier qu'aucune caractère n'est perdu : pour une commande sans zaap, `left === right === command`.
