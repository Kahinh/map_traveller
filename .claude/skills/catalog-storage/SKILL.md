---
name: catalog-storage
description: Schéma du catalogue JSON, validation, persistance (%APPDATA%\MapTraveller), favoris, paramètres, alias, catalogue livré et images importées de Map Traveller. À utiliser pour toute modification de src/features/catalog, src-tauri/src/storage*, resources/catalog.seed.json ou du format des données.
---

# catalog-storage

## Fichiers utilisateur (`app_data_dir`)

| Fichier | Rôle |
|---|---|
| `catalog.json` | catalogue éditable (`schemaVersion`, `destinations[]`) |
| `catalog.json.bak` | version précédente, restaurable |
| `favorites.json` | `{ "ids": [...] }` par identifiant stable |
| `settings.json` | toujours devant, réduction dans la zone de notification (`tray`), mises à jour (`updates`), palette (`palette.defaultVariant`), raccourcis (`shortcuts`, Rust seul) |
| `official.json` | identifiants des entrées livrées déjà proposées (`mergeOfficial`) : une entrée livrée supprimée ne revient pas |
| `aliases.json` | alias de recherche personnalisés (`custom`) et alias livrés désactivés (`disabledDefaults`) ; créé à la première personnalisation |
| `images/` | images importées (`img-…`, nom interne unique), leurs vignettes `img-….thumb.webp`, et les images du catalogue livré copiées depuis `resources/images/` quand elles manquent ; référencées en `images/<nom>` |
| `*.bak` | version précédente de chaque fichier écrit |

## Invariants

- `resources/catalog.seed.json` est en lecture seule et n'est copié **que** si `catalog.json` est absent. Une mise à jour n'écrase jamais les données utilisateur.
- Toute écriture passe par une seule fonction Rust (`storage.rs`) : `*.tmp`, `sync_all`, renommage (réessayé sous Windows sur accès refusé), `.bak` du précédent par le même chemin. Avant de fusionner un fichier existant (réglages, raccourcis), `read_json_object_for_write` : fichier absent → `{}`, autre erreur d'E/S → rien n'est écrit.
- Côté interface, les fichiers réécrits (favoris, réglages, alias) passent par `createWriteGate` (`src/lib/writeGate.ts`) : aucune écriture avant la fin de la lecture, aucune si la lecture a échoué (lecture seule, message), écritures à la file, disque avant l'état. `storeRead.ts` distingue fichier absent (valeur vide) et lecture échouée (erreur).
- Validation avant écriture et à la lecture (`validateCatalog`) : ids uniques non vides, catégorie ∈ `npc|dungeon|place|farm`, `command` string, `image` relatif ou `null`.
- Un `catalog.json` illisible n'est jamais réécrit : l'interface le signale (restaurer `catalog.json.bak`, Paramètres › Données).
- Schéma courant : **3**. Champs `twoStep: boolean` (PNJ et Donjons uniquement, sinon erreur) et `command2: string` (texte brut, jamais modifié, conservé même si `twoStep` est faux). Un catalogue v2 est accepté : les champs absents prennent `false` et `''`.
- Changement de schéma → incrémenter `schemaVersion` + migration (valeurs par défaut dans `validateCatalog`, ou fonction dédiée si une transformation est nécessaire) + test.
- Aucune URL distante, aucun chemin absolu dans le JSON.
- Seed = catalogue livré (issue n°8) : **généré** par `scripts/catalog/build-official-catalog.mjs` (données du jeu, source citée dans le script), jamais édité à la main ; images dans `resources/images/` (`convert-images.py`). Identifiants `officiel-…` stables : ne jamais en changer un (il reviendrait chez les utilisateurs qui l'ont supprimé).
- Catalogue existant : `mergeOfficial` (`src/features/catalog/official.ts`) ajoute les entrées livrées absentes et jamais proposées ; `official.json` retient les identifiants proposés. Rien n'est modifié ni retiré.
- Tests : coordonnées **fictives** uniquement.

## Recherche et réglages

- Recherche : un seul moteur pour la grille (`filterDestinations`) et la palette (`searchIndexRank`), dans `src/features/catalog/`.
  - `searchText.ts` : `normalizeText` (accents, casse, ligatures), `tokenize` (découpe sur tout ce qui n'est ni lettre ni chiffre), `queryTokens` (sans mots de liaison, sauf s'ils sont seuls), `boundedPrefixDistance`.
  - `searchIndex.ts` : index par **vocabulaire** construit une fois par catalogue et par dictionnaire (`buildSearchIndex`, `getSearchIndex`). Classement par **paliers** (`TIER`, tableau en tête du fichier, issue n°24), du meilleur au moins bon : (1) alias exact — requête entière = alias entier de la fiche, ou terme du dictionnaire qui désigne la destination ; (2) nom exact ; (3) début du nom ou d'un alias de la fiche (`nameTexts`, `aliasTexts`) ; (4) tous les mots tapés commencent un mot du nom, d'un alias, d'un tag, de la zone, ou désignent la catégorie (ET, ordre libre) ; (5) acronyme calculé, requête d'un seul mot (`acronymsOf` : initiales du nom et de chaque alias, avec et sans mots de liaison, 2 lettres au moins ; exact puis début) ; (6) un mot trouvé seulement à l'intérieur d'un mot ; (7) faute de frappe. Dans un palier : somme des coûts de champ (`FIELD_COST` : premier mot du nom 0, autre mot du nom 1, alias 2, tag / zone / catégorie 3), puis favori, puis `sortOrder` et nom (`byRank`). Changer un palier = changer `TIER`, le tableau d'en-tête, ce paragraphe et `tests/searchIndex.test.ts` (« un témoin par palier »).
  - Fautes de frappe : **seconde passe uniquement**, quand la recherche exacte (acronymes compris) ne renvoie rien ; mots de 4 lettres et plus, même initiale, nom et alias seulement.
  - Un mot désigne une catégorie s'il est le **début** d'un mot-clé de `CATEGORY_KEYWORDS`, sur 2 lettres au moins, ou égale un mot de `CATEGORY_EXACT_KEYWORDS` (`categoriesForWord`) : jamais par simple inclusion.
- Alias (`src/features/aliases/aliases.ts`) : dictionnaire **global**, un terme (un seul mot) → une ou plusieurs significations. Un terme vaut la meilleure de ses significations, chacune exigeant tous ses mots en début de mot. Alias livrés dans `resources/aliases.default.json` (embarqués, jamais copiés) ; personnalisations dans `aliases.json`. Dictionnaire effectif = livrés − désactivés, un alias personnalisé remplaçant l'alias livré du même terme. Écriture par `useAliases` (disque avant l'état) : clés inconnues du fichier et d'une entrée conservées, entrées illisibles réécrites telles quelles ; un fichier illisible, d'une `schemaVersion` plus récente ou dont la racine n'est pas un objet n'est jamais réécrit (`aliasesFileProblem`). - Alias **de fiche** (`Destination.aliases`, champ « Alias » du formulaire, dans `catalog.json` : aucun second mécanisme) : ne désignent que leur destination (palier 1). Un alias déjà porté par une autre destination ACTIVE est refusé à la saisie (`aliasOwner` / `validateDraft(draft, destinations)`, « Alias déjà utilisé par « X » », comparaison par `textKey`) ; un catalogue qui contient déjà des doublons reste valide, et la recherche les affiche tous (union, ordre déterministe). `duplicateDraft` ne recopie pas les alias.
- La palette lit `catalog.json`, `aliases.json`, `favorites.json` et `settings.json` dès son montage (préchargée au lancement : index prêt avant la première ouverture), relit un fichier dès que Rust signale son écriture (`store:changed`, émis par `save_store` vers la seule palette, charge utile = nom du stockage ; en mode navigateur, `BroadcastChannel` du même nom envoyé par `storage.ts`), et relit tout à chaque affichage en filet de sécurité (fichier modifié à la main). Le catalogue et les alias dont l'empreinte (longueur + FNV-1a, `fingerprint.ts`) n'a pas changé ne sont ni revalidés ni réindexés ; un changement de favoris ou de variante ne reconstruit pas l'index. Elle n'écrit jamais, et n'embarque ni `storage.ts` ni `official.ts` (lecture par `storeRead.ts`, réglages par `paletteSettings.ts`).
- `settings.json` : modèle pur dans `src/features/settings/settings.ts` (`parseSettings` tolérant, `mergeSettings` conserve les clés inconnues). Il contient `alwaysOnTop`, `updates.mode` (`manual` par défaut), `tray.minimizeToTray` (`true` par défaut, écrit par l'interface, lu par Rust dans `main_window.rs` au moment de réduire, lecture tolérante des deux côtés), `palette.defaultVariant` (`withoutZaap` par défaut, ou `withZaap` ; écrit par la fenêtre principale, relu par la palette) et `shortcuts`, écrite uniquement par Rust (`shortcuts.rs`, verrou partagé avec `save_store`). Clés inconnues conservées partout, y compris dans `updates`, `tray` et `palette`. La position et la taille de la fenêtre ne sont pas dans `settings.json` : le plugin window-state les garde dans `%APPDATA%\app.maptraveller`. Les réglages passent par `useSettings`.
- `official.json` : calculé par `mergeOfficial` au chargement du catalogue, écrit par la fenêtre principale (`saveOfficialState`), jamais par la palette ; un identifiant y entre dès que l'entrée livrée a été proposée, qu'elle soit gardée ou non.
- Le chemin du dossier de données ne s'écrit jamais dans l'interface : il vient de la commande `data_dir`, mise en cache par `src/lib/tauri/dataDir.ts`. `open_data_dir` l'ouvre, sans paramètre.

## Éditeur et images

- Toute modification passe par `upsertDestination` / `removeDestination` (`src/features/catalog/editor.ts`), puis `saveCatalog`, puis l'état (`useCatalog`). Jamais l'inverse.
- `command` / `command2` sont enregistrées octet pour octet ; seuls `name`, `zone`, alias et tags sont nettoyés. Hors PNJ/Donjons, `twoStep` est enregistré à `false` mais `command2` est conservée.
- Images : `import_image` (`src-tauri/src/images.rs`) contrôle la taille (10 Mo, `MAX_IMAGE_BYTES`) avant lecture et le format réel par signature (PNG, JPEG, WebP), copie sous `images/img-<horodatage>-<pid>-<compteur>.<ext>` sans jamais écraser, et renvoie un chemin relatif. Chemins réseau (UNC) refusés. Retirer ou remplacer une image ne supprime aucun fichier ; les orphelines ne seront nettoyées que par une action explicite (après la 1.0).
- Vignettes : seulement pour les images importées (`thumbPath` n'accepte que `images/img-…`) ; les images livrées sont déjà en 256 px.
- Image : PNG, JPEG ou WebP choisis par le dialogue Windows, aperçu dans le formulaire avant enregistrement ; aucune URL distante n'est jamais chargée ; un import refusé laisse l'image existante en place.

## Après la 1.0

Import / export ZIP (catalogue, images, favoris, réglages) et import JSON seul avec avertissement sur les images manquantes : **pas dans la 1.0**. Règle déjà valable pour la suite : un import corrompu ne touche jamais au catalogue existant.

## Procédure

1. Adapter `src/features/catalog/schema.ts` (+ tests).
2. Côté Rust, adapter `src-tauri/src/storage.rs`, sans `unwrap()` sur le disque.
3. Mettre à jour la section « Vos données » du README et la liste de la rubrique Données (`DataSection.tsx`).
