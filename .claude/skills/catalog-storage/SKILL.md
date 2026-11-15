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
| `settings.json` | toujours devant, raccourci, position/taille |
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

- Recherche : `rankDestinations` classe par préfixe du nom (0) > début de mot (1) > contenu du nom (2) > alias / tags / zone / catégorie (3), puis favori, puis `compareDestinations`. Un mot désigne une catégorie s'il est le **début** d'un mot-clé de `CATEGORY_KEYWORDS`, sur 2 lettres au moins (`matchesCategory`) : jamais par simple inclusion.
- La palette relit `catalog.json` et `favorites.json` à chaque affichage, sans copie du catalogue.
- `settings.json` : modèle pur dans `src/features/settings/settings.ts` (`parseSettings` tolérant, `mergeSettings` conserve les clés inconnues). La clé `shortcuts` est écrite uniquement par Rust (`shortcuts.rs`, verrou partagé avec `save_store`).

## Éditeur et images

- Toute modification passe par `upsertDestination` / `removeDestination` (`src/features/catalog/editor.ts`), puis `saveCatalog`, puis l'état (`useCatalog`). Jamais l'inverse.
- `command` / `command2` sont enregistrées octet pour octet ; seuls `name`, `zone`, alias et tags sont nettoyés. Hors PNJ/Donjons, `twoStep` est enregistré à `false` mais `command2` est conservée.
- Images : `import_image` (`src-tauri/src/images.rs`) contrôle la taille (10 Mo, `MAX_IMAGE_BYTES`) avant lecture et le format réel par signature (PNG, JPEG, WebP), copie sous `images/img-<horodatage>-<pid>-<compteur>.<ext>` sans jamais écraser, et renvoie un chemin relatif. Retirer ou remplacer une image ne supprime aucun fichier ; les orphelines ne seront nettoyées que par une action explicite.

## Procédure

1. Adapter `src/features/catalog/schema.ts` (+ tests).
2. Côté Rust, adapter `src-tauri/src/storage.rs`, sans `unwrap()` sur le disque.
3. Mettre à jour la section « Données utilisateur » du README.
