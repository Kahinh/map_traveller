# CLAUDE.md — Map Traveller

Application Windows flottante (Tauri 2 + Rust + React/TypeScript/Vite) qui copie dans le presse-papiers des commandes `/zaap` / `/travel` saisies par l'utilisateur. Locale, JSON uniquement ; aucun réseau hormis la recherche de mises à jour sur les Releases GitHub (manuelle par défaut).

Référence : les **invariants** ci-dessous, puis les skills (`.claude/skills/`) et le [README](README.md) (comportement visible). En cas de doute, les invariants priment. Le cahier des charges des versions 0.x est archivé ([docs/archive/cahier-des-charges.md](docs/archive/cahier-des-charges.md)) : historique, il ne fait plus foi.

## Commandes

`npm run help` affiche le menu complet. **Utiliser les cibles du menu** plutôt que de reconstruire une commande : elles portent les bons arguments, et la CI lance les mêmes.

| Moment | Cible |
|---|---|
| Avant de commencer | `npm run context -- <mots>` |
| Pendant le travail | `npm run check` (typecheck + lint + tests) |
| Un seul test | `npm test -- tests/<fichier>.test.ts` |
| Avant de rendre la main | `npm run check:full` (ajoute le build des trois pages) |
| Après un push, pour le Rust | `npm run ci:watch` |

`npm run check:full` = `check` + build des trois pages + budget JS de chaque page (`scripts/bundle-budget.mjs`). Prérequis, interface seule (`npm run dev`) et application complète : [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

**Rust** : `cargo test` et `cargo clippy --all-targets -- -D warnings` (dans `src-tauri/`) sont possibles en local sous Linux après installation des bibliothèques GTK (liste dans `docs/CONTRIBUTING.md`) ; la version est épinglée par `src-tauri/rust-toolchain.toml` (la même que la CI). Le code `cfg(windows)` n'est vérifié que par la CI (`npm run ci:watch`) : le dire explicitement dans tout rapport.

## Architecture

```
src/features/commands/   # PUR : clic gauche / clic droit, zones d'une carte (cardParts)
src/features/farm/       # PUR : parsing parcours, texte copié par position et par « Début »
src/features/catalog/    # PUR : types, validation, tri, catalogue livré (official.ts : ajout des entrées jamais proposées, official.json), éditeur (editor.ts : brouillon, validation, aperçu, upsert/remove), vignettes des images importées (thumbnails.ts : chemin et taille), recherche (searchText.ts : normalisation, mots ; searchIndex.ts : index, coûts, classement ; search.ts : façade), grille fenêtrée (gridWindow.ts)
src/features/aliases/    # PUR : dictionnaire GLOBAL d'alias de recherche (alias livrés + aliases.json), lecture tolérante, édition sans mutation
src/features/palette/    # PUR : lignes de palette (entries.ts, arrêt au plafond, lignes réutilisées par l'index, une ligne par parcours Farm), sélection (navigation.ts), touche Entrée et garde anti double copie (enter.ts), hauteur de fenêtre (windowHeight.ts), empreinte des fichiers relus (fingerprint.ts), percentiles (percentiles.ts)
src/features/settings/   # PUR : modèle des réglages (clés inconnues conservées), rubrique palette seule (paletteSettings.ts, lue par la palette), capture d'un raccourci (accelerator.ts), path.ts
src/features/updates/    # PUR : contrat (types.ts), machine à états, erreurs et décisions au lancement (updates.ts)
src/features/zaaps/      # PUR : référentiel des zaaps (validation), « proche X,Y » (parseNearQuery, nearestZaaps : distance de Manhattan, même monde, ex aequo par nom), defaultZaaps.ts (référentiel livré)
src/features/shared/     # PUR : lecture JSON commune (json.ts : isRecord, parseJsonText, « schéma plus récent »), texte d'une erreur (errors.ts : errorText), collateur `fr` commun (collator.ts), bornes des coordonnées tapées (coordinates.ts)
src/farm/                # fenêtre d'un parcours Farm (entrée farm.html, toujours au premier plan) : FarmWindow (lecture seule du catalogue, relecture sur `store:changed`, parcours reçu par `get_farm_id` puis `farm:open`, dernière position cliquée par parcours pour la session)
src/palette/             # fenêtre palette (entrée palette.html) : Palette (rendu et clavier), usePaletteData (lecture des fichiers, relecture sur `store:changed`), PaletteRow, perf.ts (mesures locales : dev ou drapeau `map-traveller:perf`) — n'importe rien de la grille ; lecture au montage, relecture d'un fichier sur `store:changed` (émis par Rust après `save_store`), remise à zéro sur `palette:hidden`, focus et relecture sur `palette:shown`
src/lib/                 # writeGate.ts (garde commune des fichiers réécrits : rien avant la lecture, rien si elle a échoué, écritures à la file), errors.ts (réexporte errorText)
src/lib/tauri/           # pont système (clipboard, stockage, palette, raccourcis, fenêtre, mises à jour) avec fallback navigateur ; env.ts (IS_TAURI, message unique INSTALLED_ONLY) ; storeRead.ts (lecture seule des fichiers, partagée avec la palette) et storage.ts (écritures et fusions, fenêtre principale) ; images.ts partagé avec la palette (adresses, vignette manquante), imageImport.ts (dialogue, fenêtre principale) et thumbnails.ts (fabrication des vignettes, fenêtre principale)
src/components/          # composants React (rendu + interactions uniquement) : WindowHeader, Toolbar, CategoryTabs, CatalogGrid, CompactCard, SplitCardArt, StatusBubble, Panel, FarmPanel, SettingsPanel, DestinationForm, Keys, controls.tsx (Switch, Segmented, SettingRow), useRovingFocus, overflowFade (bord estompé d'une rangée d'onglets qui déborde) ; form/ (FormField, useDestinationDraft, DraftPreview, ImageField, CommandFields, MoreOptions, FormActions) ; settings/ (une rubrique par fichier)
src/app/                 # App (état de panneau et composition) ; useCatalog, useAliases, useFavorites (disque AVANT l'état, via writeGate), useSettings (writeGate, écritures à la file ; l'état suit chaque réglage tout de suite) ; useUpdater (moteur de mise à jour) ; usePanel (focus rendu à la fermeture), useAppKeyboard (un seul abonnement), useCatalogView, useFarmProgress, useCopyFeedback, useGridWindow (seules les rangées visibles + 2 sont rendues)
src/styles/              # tokens.css (tokens DA — seule source des couleurs), app.css, palette.css, kbd.css (touches)
src-tauri/src/           # Rust : stockage atomique durable (storage.rs), import d'images, relecture et vignettes (images.rs), fenêtre palette (palette.rs, préchargée au lancement, WebView au repos une fois masquée), fenêtre d'un parcours Farm (farm_window.rs, créée à la première ouverture, puis masquée), raccourcis globaux (shortcuts.rs), fenêtre principale et réduction dans la zone de notification (main_window.rs), icône et menu de la zone de notification (tray.rs), plugins (lib.rs)
src-tauri/build.rs       # liste des commandes de l'application : chaque fenêtre n'appelle que celles de sa capability (capabilities/default.json, capabilities/palette.json, capabilities/farm.json)
src-tauri/Cargo.lock     # suivi ; builds et tests en --locked ; version tenue par scripts/version.mjs
src-tauri/rust-toolchain.toml  # version de Rust épinglée, la même que la CI
resources/catalog.seed.json  # catalogue livré (issue n°8), lecture seule, GÉNÉRÉ par scripts/catalog/ depuis les données du jeu : ne pas éditer à la main
resources/images/  # images du catalogue livré (WebP 256 px), copiées dans images/ au lancement quand elles y manquent
resources/aliases.default.json  # alias de recherche livrés, lecture seule, embarqués dans le paquet (jamais copiés chez l'utilisateur)
resources/zaaps.json  # référentiel des zaaps (issue n°7) : données RÉELLES relevées d'une source citée (`source`), non vérifiées en jeu, embarquées dans la palette
scripts/make-latest-json.mjs       # index latest.json, contrôles avant et après publication
scripts/bundle-budget.mjs          # budget du JS initial de chaque page (check:full et CI)
bench/                             # npm run bench:palette (hors npm test) ; résultats dans docs/perf-palette.md
scripts/version.mjs                # version écrite et contrôlée partout (npm run version:set)
scripts/catalog/  # génération du catalogue livré (build-official-catalog.mjs) et de ses images (convert-images.py)
src-tauri/tauri.release.conf.json  # surcharge des builds de tag (fichiers de mise à jour signés)
tests/                   # Vitest ; tauriContract.test.ts : commandes, événements et dimensions identiques entre l'interface, Rust et le CSS
```

## Où commencer

| Tâche | Lire en premier | Skill |
|---|---|---|
| Ce qui est copié par un clic ou une touche | `src/features/commands/`, `src/features/farm/`, leurs tests | `copy-rules` |
| Recherche (grille et palette), alias | `src/features/catalog/searchIndex.ts`, `searchText.ts`, `src/features/aliases/`, `tests/searchIndex.test.ts` | `catalog-storage` |
| Format du catalogue, réglages, fichiers | `src/features/catalog/schema.ts`, `src/features/settings/`, `src-tauri/src/storage.rs` | `catalog-storage` |
| Cartes, panneaux, formulaire, palette (visuel) | `src/styles/tokens.css`, `src/styles/app.css`, `src/components/` | `ui-da-pnj` |
| Palette de recherche | `src/features/palette/`, `src/palette/`, `src-tauri/src/palette.rs` | `copy-rules`, `ui-da-pnj` |
| Fenêtre d'un parcours Farm | `src/farm/`, `src/components/FarmSteps.tsx`, `src-tauri/src/farm_window.rs` | `copy-rules`, `ui-da-pnj` |
| Publication, versions | `.github/workflows/windows.yml`, `scripts/`, `docs/RELEASING.md` | `ci-release-windows` |
| Mises à jour dans l'application | `src/features/updates/`, `src/app/useUpdater.ts`, `src/lib/tauri/updater.ts`, `src/components/settings/UpdatesSection.tsx` | `ci-release-windows` |
| Zone de notification, réduire, fermer | `src-tauri/src/main_window.rs`, `src-tauri/src/tray.rs`, `src/components/settings/DisplaySection.tsx` | — |
| Catalogue livré | `scripts/catalog/build-official-catalog.mjs`, `src/features/catalog/official.ts`, `tests/officialCatalog.test.ts` | `catalog-storage` |
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
3. **Taille** : ne pas émuler la taille de la fenêtre (captures rognées) ; fixer `#root` à 510 × 300. Pour `palette.html` : largeur 560, sans fixer la hauteur (elle suit le contenu : mesurer `.palette`, de 48 px pour la barre seule à 430 px au plus).
4. **Survol** : un survol simulé n'est pas fiable. Forcer l'état par une feuille de style de test, ou lire le style calculé.
5. **Question précise** par capture (« le nom tient-il sur deux lignes sans toucher le repère ? »), jamais « est-ce joli ? ».
6. **Deux tentatives de correction au maximum** à partir de captures ; au-delà, s'arrêter et montrer le résultat.
7. Ce qui n'est visible que sur l'application installée (dialogues Windows, palette devant le jeu, mises à jour) est à lister comme **non vérifié**.

## Invariants (ne jamais enfreindre)

1. `command` = texte brut. Jamais reconstruit, normalisé, réordonné ni tronqué silencieusement.
2. Clic gauche : retire **uniquement** le premier segment s'il est `/zaap` (frontière de mot) + son `;`. Clic droit : intégral. Carte à deux étapes (PNJ/Donjons, `twoStep`) : même règle zone par zone, zone 1 = `command`, zone 2 = `command2`, toujours via `cardParts` / `partCommand`.
3. Farm : le jeu n'enchaîne pas plusieurs `/travel` : une carte Farm (clic gauche ou droit, ou ligne de la palette) ouvre la **fenêtre du parcours** (`farm`, toujours au premier plan), une case par position. Clic sur l'étape i → son seul segment, texte brut (`farmStepCommand`) ; « Début », affiché seulement si le parcours commence par un `/zaap` → le texte brut jusqu'à la fin de la première position (`farmStartCommand`). Étapes repérées par **indice** (une position peut se répéter) ; la dernière position cliquée reste en évidence pour la session.
4. Logique de découpe = fonctions pures testées. Aucun import Tauri/React dans `src/features/`.
5. Données utilisateur dans `app_data_dir` ; le seed n'écrase jamais `catalog.json` ; les entrées livrées ne sont qu'AJOUTÉES (`mergeOfficial`) si leur identifiant est absent et jamais proposé (`official.json`) : une entrée modifiée n'est jamais remplacée, une entrée supprimée ne revient pas ; identifiants livrés `officiel-…` stables ; écriture atomique + `.bak` ; chemins d'image relatifs. Schéma 3 : `twoStep` / `command2` ; un catalogue v2 est accepté avec les valeurs par défaut ; `command2` n'est jamais normalisée ni effacée.
6. Jamais de collage/saisie dans le jeu, lecture mémoire, sniffing, télémétrie. **Seul réseau autorisé** : la recherche (`latest.json`) et le téléchargement des mises à jour sur les Releases GitHub du dépôt, par le plugin updater ; en mode manuel (défaut), aucune requête sans clic de l'utilisateur. Aucun identifiant, aucune statistique.
7. **Jamais de trajet réel inventé** : coordonnées fictives dans les tests et les docs. Exceptions, toujours d'une source citée et jamais complétées de mémoire : `resources/zaaps.json` (positions relevées, une entrée ne s'y ajoute qu'avec sa source) et `resources/catalog.seed.json` (généré par `scripts/catalog/build-official-catalog.mjs` depuis les données extraites du client du jeu, publication dofus-sqlite citée dans le script ; commande = zaap le plus proche puis `/travel`, recalculée par `tests/officialCatalog.test.ts`). Pour changer une entrée livrée : changer le générateur, pas le JSON.
8. Couleurs via `tokens.css` uniquement. Clics gauche/droit des cartes réservés à la copie / ouverture Farm.
9. Permissions Tauri minimales. Seule exécution de programme autorisée : `open_data_dir` (`storage.rs`), qui lance l'Explorateur Windows (chemin complet sous `SystemRoot`) sur `app_data_dir()` : aucun paramètre, chemin passé comme argument distinct, sans attendre le processus, sous `cfg(windows)` uniquement. Pas de plugin opener ni shell.
10. Éditeur : aucune mutation d'une `Destination` ni du tableau (nouveaux objets, identité conservée pour les autres) ; l'identifiant ne change jamais en modification ; l'état n'est mis à jour qu'APRÈS `saveCatalog` ; aucun fichier image n'est supprimé automatiquement. Vignettes (`images/<nom>.thumb.webp`, 256 px) : fabriquées dans la page, enregistrées par `save_thumbnail` (fenêtre principale seulement, WebP contrôlé) ; une vignette peut être remplacée, un original jamais modifié.
11. Clavier de la fenêtre principale (`useAppKeyboard`) : la frappe directe, Échap et Ctrl+F ne détournent jamais un champ de saisie autre que la recherche, et sont inactifs formulaire ouvert (le formulaire ne gère qu'Échap et Ctrl+Entrée). Les raccourcis **globaux** (`shortcuts.rs`) agissent toujours, formulaire ouvert compris : la fenêtre est alors masquée ou réduite, jamais détruite (invariant 15).
12. Palette : aucune règle de copie réécrite (`cardParts` / `partCommand` / `partVariants`). Une ligne par étape ; les cases latérales sont les variantes avec / sans Zaap (`partVariants`), dans l'ordre fixé par `settings.palette.defaultVariant`. Un parcours Farm = **une seule ligne**, sans variante : Entrée ou clic ouvre la fenêtre du parcours (`open_farm`) puis masque la palette (ne pas masquer si l'ouverture échoue). Seule exception, `proche X,Y` (issue n°7) : la position tapée sert à classer les zaaps et devient la cible du `/travel` ajouté APRÈS la commande du zaap, elle-même copiée telle quelle (Entrée : zaap puis trajet ; Ctrl+Entrée : zaap seul). Entrée / clic gauche = variante active, Ctrl+Entrée / clic droit sur la ligne = l'autre variante, clic sur une case = sa variante. Entrée agit sur la valeur du champ, jamais sur des résultats en retard (`enterChoice`) ; champ vide → aucune copie ; une seule copie à la fois. Copier avant de masquer ; ne pas masquer si la copie échoue. Focus toujours dans le champ. Au repos : aucun minuteur. Hauteur dynamique : champ vide ou aucun résultat = la barre seule ; c'est la FENÊTRE qui change de taille (`set_palette_height`, bornée en Rust), jamais une zone vide ou transparente ; un appel par changement de hauteur, pas par frappe. Son paquet n'embarque ni la grille, ni les panneaux.
13. `settings.json` a deux auteurs. La clé `shortcuts` n'appartient qu'à Rust (`set_shortcut`, sous verrou) ; l'interface ne la réécrit jamais. Toute écriture conserve les clés inconnues, y compris dans `updates`, où l'interface ne remplace que `mode` (`manual` par défaut), dans `tray`, où elle ne remplace que `minimizeToTray`, et dans `palette`, où elle ne remplace que `defaultVariant` (lu par la palette, jamais écrit par elle). `tray.minimizeToTray` est écrit par l'interface et lu par Rust au moment de réduire (`true` si absent ou invalide, des deux côtés).
14. Mises à jour : la palette n'a aucune permission updater ni process ; l'installation n'est jamais lancée formulaire ouvert ; la clé privée de signature n'apparaît jamais dans le dépôt ni dans un journal ; ne jamais modifier `plugins.updater.pubkey` (les installations existantes ne font confiance qu'à elle) ; ne jamais activer `allowDowngrades`.
15. Fermer la fenêtre principale quitte toute l'application (la palette masquée ne doit pas laisser un processus sans fenêtre). La palette et la fenêtre d'un parcours Farm sont masquées, jamais détruites. Seule exception à « pas de processus sans fenêtre » : réduire (bouton ou raccourci, réglage `tray.minimizeToTray` actif) détruit la fenêtre principale et laisse l'icône de la zone de notification ; jamais quand le formulaire est ouvert (`set_main_busy`), jamais sans icône. `RunEvent::ExitRequested` sans code est refusé ; seules les sorties explicites (Fermer, « Quitter » du menu, relance après mise à jour) terminent le processus.

## Workflow Claude

- **Proportionner l'effort.** Petite modification à faible risque : la faire, lire le diff, lancer `npm run check`. Un plan n'est utile que si la tâche traverse plusieurs couches, touche aux données des utilisateurs, à la publication ou à la sécurité, ou si la demande est ambiguë. Un plan reste court : hypothèses, questions ouvertes, fichiers probables, commandes de validation.
- **Fermer la boucle** : écrire, vérifier, lire la sortie, corriger. Trois tours au maximum sur un même échec, puis s'arrêter et exposer le problème (skill `review-loop`).
- **Garder la trace des frictions** : en fin de tâche, noter dans `docs/agent-notes.md` chaque correction demandée par l'utilisateur et chaque erreur trouvée en revue. Une erreur vue deux fois devient un test, un script ou une règle.
- Les règles ci-dessus disent pourquoi elles existent. Si une règle ne semble pas s'appliquer au cas présent et que la raison n'est pas claire : s'arrêter et demander, plutôt que de l'appliquer à l'aveugle ou de la contourner.
- Recherche de code : **CodeGraph d'abord** (`codegraph query <nom>` ou `sqlite3 .codegraph/codegraph.db ...`), puis lecture ciblée.
- Skills projet : voir `.claude/skills/` (un dossier par skill ; `unslop` a sa note d'usage dans `SOURCE.md`).
- Agents (`.claude/agents/`) : `architecte` (cadrage) → `implementation` → `reviewer` (tâche moyenne/complexe). Spécialistes : `tauri-rust`, `ui-da`.
- Ne jamais committer ni pousser sans demande explicite.
- **Toute livraison fusionnée dans `main` se termine par une version et un tag**, APRÈS la fusion et un build `main` vert (`npm run version:set -- X.Y.Z`, commit `Version X.Y.Z`, `git tag vX.Y.Z`, push) : sans tag, GitHub ne publie pas de `.exe`. Détail et cas particuliers : skill `ci-release-windows` et [docs/RELEASING.md](docs/RELEASING.md).
- Langue : français pour la doc, les messages UI et les commits.
