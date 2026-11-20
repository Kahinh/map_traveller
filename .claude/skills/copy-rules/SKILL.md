---
name: copy-rules
description: Règles de copie de Map Traveller — clic gauche (sans /zaap initial), clic droit (commande complète), copie Farm position par position d'étape. À utiliser pour toute modification de src/features/commands, src/features/farm ou de leurs tests, et pour tout bug « mauvaise commande copiée ».
---

# copy-rules

Source de vérité : invariants 1 à 3 et 12 de `CLAUDE.md`, puis ce skill et les tests (`tests/copyRules.test.ts`, `tests/cardParts.test.ts`, `tests/farmRoute.test.ts`). Le cahier des charges des versions 0.x (`docs/archive/`) n'est plus qu'un historique.

## Invariants

1. Le champ `command` est du **texte brut** saisi par l'utilisateur. On ne le reconstruit jamais, on ne le normalise jamais.
2. **Clic gauche** (`leftClickCommand`) : si le **premier segment** (jusqu'au premier `;`) est une commande `/zaap` (frontière de mot : `/zaap` suivi d'un espace, d'une fin ou d'un `;` — pas `/zaapi`), retirer ce segment **et** son `;`. Le reste est copié octet pour octet. Sinon : copie intégrale. Jamais de `replace` global sur `/zaap`.
3. **Clic droit** (`rightClickCommand`) : copie intégrale.
   - **Carte à deux étapes** (`twoStep`, PNJ et Donjons) : `cardParts(d)` renvoie les zones (1 = `command`, 2 = `command2`) et `partCommand(part, bouton)` applique les règles 2 et 3 à la commande de la zone. Ne jamais réécrire la règle Zaap ailleurs que dans `copyRules.ts`.
4. Commande vide / blanche → `null` (rien copié, avertissement discret : `useCopyFeedback`, genre `warning`, et bulle d'état).
   - Le menu contextuel du navigateur est bloqué sur les cartes (`contextmenu` → `preventDefault`) ; un clic droit ne déclenche jamais aussi la copie du clic gauche.
5. **Farm** (`parseFarmRoute`, `farmStepCommand`, `farmStartCommand`) — le jeu n'enchaîne pas plusieurs `/travel` :
   - découpage en segments sur `;` en conservant le texte original de chaque segment ;
   - un `/zaap` initial éventuel est mis à part (`zaapPrefix`), il n'est **pas** une étape ;
   - chaque `/travel X Y` est une étape avec un **indice** ; coordonnées = libellé uniquement ;
   - segments non reconnus → listés dans `issues`, jamais supprimés en silence ;
   - clic sur l'étape `i` → son seul segment, texte original sans blancs de bord (`farmStepCommand`) ;
   - « Début », affiché seulement si le parcours commence par un `/zaap` (`farmStartCommand`) → texte brut de la commande jusqu'à la fin du premier `/travel` (Zaap, segments intermédiaires et première position) ; il fait de l'étape 0 la position courante ;
   - coordonnées répétées : seul l'indice compte ;
   - clic gauche ou droit sur une carte Farm de la grille (ou ligne Farm de la palette) : ouvre la fenêtre du parcours (`open_farm`, `src/farm/`), toujours au premier plan, jamais de copie ; clic gauche ou droit sur une case : même action, copie immédiate, la fenêtre reste ouverte et la dernière case cliquée reste en évidence pour la session.
6. Multi-ligne : les retours à la ligne sont conservés tels quels ; ajouter un test pour tout nouveau cas inhabituel.

## Palette

`src/features/palette/` (issue n°11) : `cardEntries` = **une ligne par zone** de `cardParts` (étape 1, étape 2), chacune avec ses variantes `partVariants(part)` (déduites de `partCommand(part, 'left' | 'right')` : vide → aucune, sans Zaap → une, `/zaap` seul → une, sinon sans / avec Zaap), la variante préférée (`settings.palette.defaultVariant`, `orderVariants`) en premier. Entrée / clic gauche = variante active, Ctrl+Entrée / clic droit sur la ligne = l'autre ; clic sur une case = sa variante. Lignes « proche X,Y » (n°7) : trajet complet puis zaap seul, ordre fixe. Parcours Farm : **une seule ligne** (`farmEntry`, genre `farm`), sans variante ; Entrée ou clic ouvre la fenêtre du parcours puis masque la palette. Genres de variante (`PaletteVariantKind`, une seule table de libellés `VARIANT_LABELS`) : `withoutZaap`, `withZaap` (cartes), `trip`, `zaapOnly` (« proche X,Y »). Touche Entrée (issue n°24) : `enterChoice` (`src/features/palette/enter.ts`) décide sur la **valeur du champ** au moment de la touche ; si elle diffère de la requête des résultats affichés, la recherche est refaite de façon synchrone et sa première ligne est copiée dans sa variante par défaut (jamais une ligne d'une requête plus ancienne). Champ vide → rien ; `e.repeat` ignoré ; une seule copie à la fois (`createCopyGate`). Le texte copié vient toujours de `variantText`, donc des variantes construites par `partVariants`.

## Procédure

1. Écrire/adapter d'abord le test dans `tests/` (Vitest), à partir des exemples **fictifs** du cahier des charges.
2. Modifier la fonction pure.
3. `npm test` + `npm run typecheck`.
4. Vérifier qu'aucune caractère n'est perdu : pour une commande sans zaap, `left === right === command`.
