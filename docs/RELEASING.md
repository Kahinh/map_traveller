# Publier une version de Map Traveller

Pour le mainteneur. **Un tag atteint les installations existantes** : toute Release publiée est proposée (mode manuel) ou installée sans question (mode automatique) chez les utilisateurs. Règles résumées pour les agents : skill `ci-release-windows`.

## Quand publier

1. Le changement est relu et **fusionné dans `main`** (une branche et une PR par issue ou par lot).
2. Le build de `main` est **vert** (`npm run ci:watch`, ou l'onglet Actions). Le code `cfg(windows)` n'est compilé que là : ne jamais taguer avant.
3. Pour une version majeure (1.0), [recette-v1.md](recette-v1.md) est déroulée sur Windows.

Alors seulement, sur `main` à jour :

```bash
npm run version:set -- X.Y.Z     # package.json, package-lock.json, tauri.conf.json, Cargo.toml, Cargo.lock
git commit -am "Version X.Y.Z"
git tag vX.Y.Z
git push origin main vX.Y.Z      # la CI construit, signe et publie la Release (~15-20 min)
```

`npm run version:set` sans argument affiche la version de chaque fichier ; `node scripts/version.mjs --check X.Y.Z` vérifie qu'ils concordent (la CI le fait sur tag). Numéro : correctif pour un bug, mineur pour une fonctionnalité, majeur pour une rupture. Plusieurs issues livrées ensemble font une seule version. Un changement sans effet sur l'application (documentation, `.claude/`, CI seule) n'a pas de version. Mettre à jour [CHANGELOG.md](../CHANGELOG.md) (la section « non publiée » prend le numéro et la date) dans le commit de version.

Ne jamais déplacer ni réutiliser un tag publié : en cas d'erreur, publier le numéro suivant.

## Ce que fait la CI

`.github/workflows/windows.yml`, un seul job sur `windows-latest` (45 minutes au plus), Node 22 et Rust épinglé (`src-tauri/rust-toolchain.toml`) :

1. Sur tag : la version du code doit être celle du tag (`scripts/version.mjs --check`).
2. `npm ci`, `npm run check`, `cargo fmt --check`, `cargo clippy --all-targets --locked -- -D warnings`, `cargo test --locked`.
3. Build de l'installateur NSIS en `--locked` : **non signé et sans secret** pour `main`, les pull requests et `workflow_dispatch` ; **signé** sur tag (`--config src-tauri/tauri.release.conf.json`, secrets dans l'environnement de cette seule étape).
4. Budget JS des pages (`scripts/bundle-budget.mjs`), puis l'installateur en artefact du run.
5. Sur tag : « Préparer les fichiers de mise à jour » (`make-latest-json.mjs prepare`), « Publier la release », « Contrôler la release publiée » (`make-latest-json.mjs verify`).

Permissions : `contents: read` pour le workflow, `contents: write` pour le seul job, qui publie.

## Contenu d'une Release

| Fichier | Rôle |
|---|---|
| `MapTraveller_X.Y.Z_x64-setup.exe` | l'installateur |
| `MapTraveller_X.Y.Z_x64-setup.exe.sig` | sa signature |
| `latest.json` | l'index lu par l'application, généré par `scripts/make-latest-json.mjs` |

Les notes sont générées à partir des commits. L'application interroge `https://github.com/Kahinh/map_traveller/releases/latest/download/latest.json`, que GitHub redirige vers la dernière Release **stable** (ni brouillon, ni pré-version) ; `latest.json` pointe vers l'installateur de la Release du tag exact.

## Contrôles

- **Avant publication**, `make-latest-json.mjs prepare` vérifie la signature avec la clé publique de `tauri.conf.json` (comme le fera l'application), le nom et la version de l'installateur, puis écrit `latest.json`.
- **Après publication**, `make-latest-json.mjs verify` relit `latest.json` depuis la Release du tag et depuis l'adresse de l'application, contrôle version, adresse et signature, et retélécharge l'installateur publié pour revérifier sa signature. S'il échoue, le run est rouge alors que la Release est publique : voir ci-dessous.
- Vérifier ensuite : `gh release view vX.Y.Z` (trois fichiers), puis une mise à jour réelle depuis la version précédente (protocole en deux versions de [recette-v1.md](recette-v1.md)).

## Clé de signature

Les mises à jour sont signées par une clé propre à l'application (signature minisign de Tauri, distincte d'un certificat Windows ; l'installateur reste « non signé » pour SmartScreen).

- La **clé publique** est dans `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Elle n'est pas secrète, et **ne doit jamais changer** : les installations existantes ne font confiance qu'à elle.
- La **clé privée** et son **mot de passe** sont uniquement dans les secrets GitHub Actions du dépôt (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) et dans une copie hors dépôt chez le propriétaire. Jamais commités, jamais écrits dans un fichier du dépôt, jamais affichés dans un journal.
- Seul un tag `vX.Y.Z` reçoit les secrets ; `main`, les pull requests et `workflow_dispatch` ne signent rien.
- **Clé perdue** : plus aucune mise à jour ne peut être signée pour les installations existantes. Générer une nouvelle paire (`npx tauri signer generate`), mettre la nouvelle clé publique dans `tauri.conf.json`, publier, et prévenir les utilisateurs qu'une réinstallation manuelle est nécessaire. Aucun rattrapage automatique.
- **Clé divulguée** : un tiers pourrait signer une fausse mise à jour (il lui faudrait aussi publier dans les Releases du dépôt). Remplacer immédiatement la paire (même procédure), remplacer les secrets, vérifier les accès au dépôt. Les installations existantes font confiance à l'ancienne clé jusqu'à leur réinstallation manuelle.

## En cas d'échec

- **Tag différent de la version** : rien n'est construit. Supprimer le tag non publié s'il n'a produit aucune Release, corriger la version par `npm run version:set`, retaguer ; dans le doute, publier le numéro suivant.
- **Signature absente ou refusée** (« Build Tauri signé » ou « Préparer les fichiers de mise à jour ») : rien n'est publié. Vérifier que les deux secrets existent et correspondent à la clé publique, puis publier le numéro suivant.
- **Contrôle après publication en échec** : supprimer `latest.json` de la Release fautive (l'application ne propose alors rien et n'affiche aucune erreur en mode automatique), ou repasser la Release en brouillon, puis publier le numéro suivant.
- Solution de secours toujours valable pour les utilisateurs : réinstaller à la main depuis la page des Releases.
- Si le dépôt redevient privé, les mises à jour cessent, sans message en mode automatique.

## Interdits

Pas de signature factice, pas de contournement de SmartScreen, pas de secret en clair dans le workflow, ne jamais afficher l'environnement d'une étape qui reçoit les secrets, ne jamais activer `allowDowngrades`, ne jamais modifier `plugins.updater.pubkey`.
