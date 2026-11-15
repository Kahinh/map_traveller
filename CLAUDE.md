# CLAUDE.md — Map Traveller

Application Windows flottante (Tauri 2 + Rust + React/TypeScript/Vite) qui copie dans le presse-papiers des commandes `/zaap` / `/travel` saisies par l'utilisateur. Locale, JSON uniquement ; aucun réseau hormis la recherche de mises à jour sur les Releases GitHub (manuelle par défaut).

Spécification de référence : [docs/cahier-des-charges.md](docs/cahier-des-charges.md). En cas de doute, elle prime.

## Commandes

`npm run help` affiche le menu complet. **Utiliser les cibles du menu** plutôt que de reconstruire une commande : elles portent les bons arguments, et la CI lance les mêmes.

| Moment | Cible |
|---|---|
| Avant de commencer | `npm run context -- <mots>` |
| Pendant le travail | `npm run check` (typecheck + lint + tests) |
| Un seul test | `npm test -- tests/<fichier>.test.ts` |
| Avant de rendre la main | `npm run check:full` (ajoute le build des deux pages) |
| Après un push, pour le Rust | `npm run ci:watch` |

```bash
npm install            # dépendances front + CLI Tauri
npm run dev            # UI seule dans le navigateur (fallback navigator.clipboard + localStorage)
npm run tauri dev      # application complète (nécessite Rust + WebView2)
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm test               # vitest run
npm run tauri build    # installateur NSIS (normalement fait par la CI)
```

`cargo` n'est pas forcément installé sur la machine de dev : le code Rust est alors vérifié par la CI (`.github/workflows/windows.yml`). Le dire explicitement dans tout rapport.

## Architecture

```
src/features/commands/   # PUR : clic gauche / clic droit, zones d'une carte (cardParts)
src/features/farm/       # PUR : parsing parcours + reprise par indice
src/features/catalog/    # PUR : types, validation, tri, éditeur (editor.ts : brouillon, validation, aperçu, upsert/remove), recherche (searchText.ts : normalisation, mots ; searchIndex.ts : index, coûts, classement ; search.ts : façade), grille fenêtrée (gridWindow.ts)
src/features/aliases/    # PUR : dictionnaire GLOBAL d'alias de recherche (alias livrés + aliases.json), lecture tolérante, édition sans mutation
src/features/palette/    # PUR : lignes de palette (entries.ts), position tapée + lignes Farm (farmQuery.ts), sélection (navigation.ts)
src/features/settings/   # PUR : modèle des réglages (clés inconnues conservées), capture d'un raccourci (accelerator.ts), path.ts
src/features/updates/    # PUR : contrat (types.ts), machine à états, erreurs et décisions au lancement (updates.ts)
src/palette/             # fenêtre palette (entrée palette.html) : Palette, PaletteRow — n'importe rien de la grille
src/lib/tauri/           # pont système (clipboard, stockage, palette, raccourcis) avec fallback navigateur
src/components/          # composants React (rendu + interactions uniquement) : Panel, FarmPanel, DestinationForm…
src/app/                 # App, état global, useCatalog et useAliases (écriture disque AVANT mise à jour de l'état), useSettings (écritures à la file), useUpdater (moteur de mise à jour, monté dans App), useCopyFeedback, useGridWindow (seules les rangées visibles + 2 sont rendues)
src/styles/tokens.css    # tokens DA — seule source des couleurs
src-tauri/src/           # Rust : stockage atomique (storage.rs), import d'images (images.rs), fenêtre palette (palette.rs), raccourcis globaux (shortcuts.rs), plugins
resources/catalog.seed.json  # seed lecture seule, coordonnées FICTIVES
resources/aliases.default.json  # alias de recherche livrés, lecture seule, embarqués dans le paquet (jamais copiés chez l'utilisateur)
scripts/make-latest-json.mjs       # index latest.json, contrôles avant et après publication
src-tauri/tauri.release.conf.json  # surcharge des builds de tag (fichiers de mise à jour signés)
tests/                   # Vitest
```

## Où commencer

| Tâche | Lire en premier | Skill |
|---|---|---|
| Ce qui est copié par un clic ou une touche | `src/features/commands/`, `src/features/farm/`, leurs tests | `copy-rules` |
| Recherche (grille et palette), alias | `src/features/catalog/searchIndex.ts`, `searchText.ts`, `src/features/aliases/`, `tests/searchIndex.test.ts` | `catalog-storage` |
| Format du catalogue, réglages, fichiers | `src/features/catalog/schema.ts`, `src/features/settings/`, `src-tauri/src/storage.rs` | `catalog-storage` |
| Cartes, panneaux, formulaire, palette (visuel) | `src/styles/tokens.css`, `src/styles/app.css`, `src/components/` | `ui-da-pnj` |
| Palette de recherche | `src/features/palette/`, `src/palette/`, `src-tauri/src/palette.rs` | `copy-rules`, `ui-da-pnj` |
| Publication, versions, mises à jour | `.github/workflows/windows.yml`, `scripts/` | `ci-release-windows` |
| Bug signalé | reproduire par un test avant de corriger | `bugfix-root-cause` |

## Ne pas toucher sans demander

- `plugins.updater.pubkey` et `identifier` dans `tauri.conf.json` : les installations existantes en dépendent.
- Les secrets GitHub et tout ce qui touche à la signature.
- Un tag déjà publié, une Release publiée.
- Le format de `catalog.json` sans monter `schemaVersion` : les données des utilisateurs en dépendent. Même règle pour `aliases.json`.
- Le dictionnaire d'alias livré (`resources/aliases.default.json`) : ne rien y ajouter sans demande, ne rien inventer.
- L'historique Git (réécriture, force-push).
- Dans le doute sur la portée d'un changement : s'arrêter et demander.

## Validation de l'interface

Les tests ne voient ni un chevauchement, ni un texte illisible, ni un débordement. Tout changement visuel se contrôle dans le navigateur (`npm run dev`, puis `npm run dev:stop`).

1. **Le texte d'abord** : état du DOM, `getComputedStyle`, `elementsFromPoint`, console sans erreur. Une capture ne vient qu'ensuite.
2. **Données de contrôle** : `tests/fixtures/demo-catalog.json` couvre chaque cas (deux étapes, Farm avec position répétée, nom long, commande vide). Le charger dans `localStorage` sous la clé `map-traveller:catalog`, puis vider `localStorage` en fin de contrôle.
3. **Taille** : ne pas émuler la taille de la fenêtre (captures rognées) ; fixer `#root` à 510 × 300, ou 560 × 380 pour `palette.html`.
4. **Survol** : un survol simulé n'est pas fiable. Forcer l'état par une feuille de style de test, ou lire le style calculé.
5. **Question précise** par capture (« le nom tient-il sur deux lignes sans toucher le repère ? »), jamais « est-ce joli ? ».
6. **Deux tentatives de correction au maximum** à partir de captures ; au-delà, s'arrêter et montrer le résultat.
7. Ce qui n'est visible que sur l'application installée (dialogues Windows, palette devant le jeu, mises à jour) est à lister comme **non vérifié**.

## Invariants (ne jamais enfreindre)

1. `command` = texte brut. Jamais reconstruit, normalisé, réordonné ni tronqué silencieusement.
2. Clic gauche : retire **uniquement** le premier segment s'il est `/zaap` (frontière de mot) + son `;`. Clic droit : intégral. Carte à deux étapes (PNJ/Donjons, `twoStep`) : même règle zone par zone, zone 1 = `command`, zone 2 = `command2`, toujours via `cardParts` / `partCommand`.
3. Farm : reprise par **indice d'étape** ; clic sur l'étape i copie les segments originaux après i ; dernière étape → rien + signal ; « Démarrer » → commande complète.
4. Logique de découpe = fonctions pures testées. Aucun import Tauri/React dans `src/features/`.
5. Données utilisateur dans `app_data_dir` ; le seed n'écrase jamais `catalog.json` ; écriture atomique + `.bak` ; chemins d'image relatifs. Schéma 3 : `twoStep` / `command2` ; un catalogue v2 est accepté avec les valeurs par défaut ; `command2` n'est jamais normalisée ni effacée.
6. Jamais de collage/saisie dans le jeu, lecture mémoire, sniffing, télémétrie. **Seul réseau autorisé** : la recherche (`latest.json`) et le téléchargement des mises à jour sur les Releases GitHub du dépôt, par le plugin updater ; en mode manuel (défaut), aucune requête sans clic de l'utilisateur. Aucun identifiant, aucune statistique.
7. **Jamais de trajet réel inventé** : coordonnées fictives dans seed, tests et docs.
8. Couleurs via `tokens.css` uniquement. Clics gauche/droit des cartes réservés à la copie / ouverture Farm.
9. Permissions Tauri minimales. Seule exécution de programme autorisée : `open_data_dir` (`storage.rs`), qui lance l'Explorateur Windows (chemin complet sous `SystemRoot`) sur `app_data_dir()` : aucun paramètre, chemin passé comme argument distinct, sans attendre le processus, sous `cfg(windows)` uniquement. Pas de plugin opener ni shell.
10. Éditeur : aucune mutation d'une `Destination` ni du tableau (nouveaux objets, identité conservée pour les autres) ; l'identifiant ne change jamais en modification ; l'état n'est mis à jour qu'APRÈS `saveCatalog` ; aucun fichier image n'est supprimé automatiquement.
11. Le raccourci clavier global ignore les champs de saisie et ne fait rien quand le formulaire est ouvert.
12. Palette : aucune règle de copie réécrite (`cardParts` / `partCommand` / `parseFarmRoute` / `farmStartCommand` / `farmResumeCommand`). Les coordonnées tapées ne servent qu'à retrouver des étapes existantes ; reprise Farm par indice, une ligne par occurrence. Entrée = clic gauche, Ctrl+Entrée = clic droit. Copier avant de masquer ; ne pas masquer si la copie échoue. Focus toujours dans le champ. Au repos : aucun minuteur. Son paquet n'embarque ni la grille, ni les panneaux.
13. `settings.json` a deux auteurs. La clé `shortcuts` n'appartient qu'à Rust (`set_shortcut`, sous verrou) ; l'interface ne la réécrit jamais. Toute écriture conserve les clés inconnues, y compris dans `updates`, où l'interface ne remplace que `mode` (`manual` par défaut).
15. Mises à jour : la palette n'a aucune permission updater ni process ; l'installation n'est jamais lancée formulaire ouvert ; la clé privée de signature n'apparaît jamais dans le dépôt ni dans un journal ; ne jamais modifier `plugins.updater.pubkey` (les installations existantes ne font confiance qu'à elle) ; ne jamais activer `allowDowngrades`.
14. Fermer la fenêtre principale quitte toute l'application (la palette masquée ne doit pas laisser un processus sans fenêtre). La palette est masquée, jamais détruite.

## Workflow Claude

- **Proportionner l'effort.** Petite modification à faible risque : la faire, lire le diff, lancer `npm run check`. Un plan n'est utile que si la tâche traverse plusieurs couches, touche aux données des utilisateurs, à la publication ou à la sécurité, ou si la demande est ambiguë. Un plan reste court : hypothèses, questions ouvertes, fichiers probables, commandes de validation.
- **Fermer la boucle** : écrire, vérifier, lire la sortie, corriger. Trois tours au maximum sur un même échec, puis s'arrêter et exposer le problème (skill `review-loop`).
- **Garder la trace des frictions** : en fin de tâche, noter dans `docs/agent-notes.md` chaque correction demandée par l'utilisateur et chaque erreur trouvée en revue. Une erreur vue deux fois devient un test, un script ou une règle.
- Les règles ci-dessus disent pourquoi elles existent. Si une règle ne semble pas s'appliquer au cas présent et que la raison n'est pas claire : s'arrêter et demander, plutôt que de l'appliquer à l'aveugle ou de la contourner.
- Recherche de code : **CodeGraph d'abord** (`codegraph query <nom>` ou `sqlite3 .codegraph/codegraph.db ...`), puis lecture ciblée.
- Skills projet : `feature-delivery`, `bugfix-root-cause`, `copy-rules`, `catalog-storage`, `ui-da-pnj`, `ci-release-windows`, `codegraph-sync`, `commit-and-push-on-request`, `review-loop`.
- Agents : `architecte` (cadrage) → `implementation` → `reviewer` (tâche moyenne/complexe). Spécialistes : `tauri-rust`, `ui-da`.
- Ne jamais committer ni pousser sans demande explicite.
- **Toute livraison poussée sur `main` se termine par une version et un tag** (`npm run version:set -- X.Y.Z`, commit `Version X.Y.Z`, `git tag vX.Y.Z`, push) : sans tag, GitHub ne publie pas de `.exe`. Détail et cas particuliers : skill `ci-release-windows`.
- Langue : français pour la doc, les messages UI et les commits.
