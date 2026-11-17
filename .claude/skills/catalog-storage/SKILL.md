---
name: catalog-storage
description: Schéma du catalogue JSON, validation, persistance (%APPDATA%\MapTraveller), favoris, paramètres, images importées et import/export ZIP de Map Traveller. À utiliser pour toute modification de src/features/catalog, src-tauri/src/storage*, resources/catalog.seed.json ou du format des données.
---

# catalog-storage

Source : cahier des charges §6.3, §7, §8.

## Fichiers utilisateur (`app_data_dir`)

| Fichier | Rôle |
|---|---|
| `catalog.json` | catalogue éditable (`schemaVersion`, `destinations[]`) |
| `catalog.json.bak` | version précédente, restaurable |
| `favorites.json` | `{ "ids": [...] }` par identifiant stable |
| `settings.json` | toujours devant, réduction dans la zone de notification (`tray`), mises à jour (`updates`), palette (`palette.defaultVariant`), raccourcis (`shortcuts`, Rust seul) |
| `aliases.json` | alias de recherche personnalisés (`custom`) et alias livrés désactivés (`disabledDefaults`) ; créé à la première personnalisation |
| `images/` | images copiées, nom interne unique, référencées en `images/<nom>` |

## Invariants

- `resources/catalog.seed.json` est en lecture seule et n'est copié **que** si `catalog.json` est absent. Une mise à jour n'écrase jamais les données utilisateur.
- Toute écriture : `*.tmp` puis renommage, `.bak` du précédent.
- Validation avant écriture et à la lecture (`validateCatalog`) : ids uniques non vides, catégorie ∈ `npc|dungeon|place|farm`, `command` string, `image` relatif ou `null`.
- Un import corrompu ne touche pas au catalogue existant.
- Schéma courant : **3**. Champs `twoStep: boolean` (PNJ et Donjons uniquement, sinon erreur) et `command2: string` (texte brut, jamais modifié, conservé même si `twoStep` est faux). Un catalogue v2 est accepté : les champs absents prennent `false` et `''`.
- Changement de schéma → incrémenter `schemaVersion` + migration (valeurs par défaut dans `validateCatalog`, ou fonction dédiée si une transformation est nécessaire) + test.
- Aucune URL distante, aucun chemin absolu dans le JSON.
- Seed : coordonnées **fictives** uniquement.

## Recherche et réglages

- Recherche : un seul moteur pour la grille (`filterDestinations`) et la palette (`searchIndexRank`), dans `src/features/catalog/`.
  - `searchText.ts` : `normalizeText` (accents, casse, ligatures), `tokenize` (découpe sur tout ce qui n'est ni lettre ni chiffre), `queryTokens` (sans mots de liaison, sauf s'ils sont seuls), `boundedPrefixDistance`.
  - `searchIndex.ts` : index par **vocabulaire** construit une fois par catalogue et par dictionnaire (`buildSearchIndex`, `getSearchIndex`). Coût d'un mot par destination (`COST`) : début du nom ou alias entier de la fiche (0) > début d'un autre mot du nom (1) > contenu dans le nom (2) > début d'un mot d'alias (3) > tag, zone, catégorie (4) > faute de frappe (6). Tous les mots doivent correspondre ; le coût total est la **somme** : l'ordre des mots tapés ne compte pas. À coût égal : favori, puis `compareDestinations`.
  - Fautes de frappe : **seconde passe uniquement**, quand la recherche exacte ne renvoie rien ; mots de 4 lettres et plus, même initiale, nom et alias seulement.
  - Un mot désigne une catégorie s'il est le **début** d'un mot-clé de `CATEGORY_KEYWORDS`, sur 2 lettres au moins, ou égale un mot de `CATEGORY_EXACT_KEYWORDS` (`categoriesForWord`) : jamais par simple inclusion.
- Alias (`src/features/aliases/aliases.ts`) : dictionnaire **global**, un terme (un seul mot) → une ou plusieurs significations. Un terme vaut la meilleure de ses significations, chacune exigeant tous ses mots en début de mot. Alias livrés dans `resources/aliases.default.json` (embarqués, jamais copiés) ; personnalisations dans `aliases.json`. Dictionnaire effectif = livrés − désactivés, un alias personnalisé remplaçant l'alias livré du même terme. Écriture par `useAliases` (disque avant l'état) : clés inconnues du fichier et d'une entrée conservées, entrées illisibles réécrites telles quelles ; un fichier illisible, d'une `schemaVersion` plus récente ou dont la racine n'est pas un objet n'est jamais réécrit (`aliasesFileProblem`). Le champ `aliases` d'une destination existe toujours, mais le mécanisme attendu est le dictionnaire : ne pas demander de saisie carte par carte.
- La palette relit `catalog.json`, `aliases.json` et `favorites.json` à chaque affichage ; un fichier dont le texte n'a pas changé n'est ni revalidé ni réindexé. Elle n'écrit jamais.
- `settings.json` : modèle pur dans `src/features/settings/settings.ts` (`parseSettings` tolérant, `mergeSettings` conserve les clés inconnues). La clé `shortcuts` est écrite uniquement par Rust (`shortcuts.rs`, verrou partagé avec `save_store`).

- `settings.json` contient `alwaysOnTop`, `updates.mode` (`manual` par défaut), `tray.minimizeToTray` (`true` par défaut, écrit par l'interface, lu par Rust dans `main_window.rs` au moment de réduire, lecture tolérante des deux côtés ; clés inconnues de `tray` conservées) `palette.defaultVariant` (`withoutZaap` par défaut, `withZaap` ; écrit par la fenêtre principale, relu par la palette à chaque affichage ; clés inconnues de `palette` conservées) et `shortcuts` (Rust seul). La position et la taille de la fenêtre ne sont pas dans `settings.json` : le plugin window-state les garde dans `%APPDATA%\app.maptraveller`. Les réglages passent par `useSettings` (rien n'est écrit avant la fin du chargement ; écritures l'une après l'autre).
- Le chemin du dossier de données ne s'écrit jamais dans l'interface : il vient de la commande `data_dir`, mise en cache par `src/lib/tauri/dataDir.ts`. `open_data_dir` l'ouvre, sans paramètre.

## Éditeur et images

- Toute modification passe par `upsertDestination` / `removeDestination` (`src/features/catalog/editor.ts`), puis `saveCatalog`, puis l'état (`useCatalog`). Jamais l'inverse.
- `command` / `command2` sont enregistrées octet pour octet ; seuls `name`, `zone`, alias et tags sont nettoyés. Hors PNJ/Donjons, `twoStep` est enregistré à `false` mais `command2` est conservée.
- Images : `import_image` (`src-tauri/src/images.rs`) contrôle la taille (10 Mo, `MAX_IMAGE_BYTES`) avant lecture et le format réel par signature (PNG, JPEG, WebP), copie sous `images/img-<horodatage>-<pid>-<compteur>.<ext>` sans jamais écraser, et renvoie un chemin relatif. Retirer ou remplacer une image ne supprime aucun fichier ; les orphelines ne seront nettoyées que par une action explicite.

## Procédure

1. Adapter `src/features/catalog/schema.ts` (+ tests).
2. Côté Rust, adapter `src-tauri/src/storage.rs`, sans `unwrap()` sur le disque.
3. Mettre à jour la section « Données utilisateur » du README.
