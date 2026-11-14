# CLAUDE.md — Map Traveller

Application Windows flottante (Tauri 2 + Rust + React/TypeScript/Vite) qui copie dans le presse-papiers des commandes `/zaap` / `/travel` saisies par l'utilisateur. Locale, hors ligne, JSON uniquement.

Spécification de référence : [docs/cahier-des-charges.md](docs/cahier-des-charges.md). En cas de doute, elle prime.

## Commandes

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
src/features/commands/   # PUR : clic gauche / clic droit
src/features/farm/       # PUR : parsing parcours + reprise par indice
src/features/catalog/    # PUR : types, validation, recherche, tri
src/lib/tauri/           # pont système (clipboard, stockage) avec fallback navigateur
src/components/          # composants React (rendu + interactions uniquement)
src/app/                 # App, état global
src/styles/tokens.css    # tokens DA — seule source des couleurs
src-tauri/src/           # Rust : stockage atomique, images, fenêtre, plugins
resources/catalog.seed.json  # seed lecture seule, coordonnées FICTIVES
tests/                   # Vitest
```

## Invariants (ne jamais enfreindre)

1. `command` = texte brut. Jamais reconstruit, normalisé, réordonné ni tronqué silencieusement.
2. Clic gauche : retire **uniquement** le premier segment s'il est `/zaap` (frontière de mot) + son `;`. Clic droit : intégral.
3. Farm : reprise par **indice d'étape** ; clic sur l'étape i copie les segments originaux après i ; dernière étape → rien + signal ; « Démarrer » → commande complète.
4. Logique de découpe = fonctions pures testées. Aucun import Tauri/React dans `src/features/`.
5. Données utilisateur dans `app_data_dir` ; le seed n'écrase jamais `catalog.json` ; écriture atomique + `.bak` ; chemins d'image relatifs.
6. Jamais de collage/saisie dans le jeu, lecture mémoire, sniffing, réseau, télémétrie.
7. **Jamais de trajet réel inventé** : coordonnées fictives dans seed, tests et docs.
8. Couleurs via `tokens.css` uniquement. Clics gauche/droit des cartes réservés à la copie / ouverture Farm.
9. Permissions Tauri minimales.

## Workflow Claude

- Recherche de code : **CodeGraph d'abord** (`codegraph query <nom>` ou `sqlite3 .codegraph/codegraph.db ...`), puis lecture ciblée.
- Skills projet : `feature-delivery`, `bugfix-root-cause`, `copy-rules`, `catalog-storage`, `ui-da-pnj`, `ci-release-windows`, `codegraph-sync`, `commit-and-push-on-request`.
- Agents : `architecte` (cadrage) → `implementation` → `reviewer` (tâche moyenne/complexe). Spécialistes : `tauri-rust`, `ui-da`.
- Ne jamais committer ni pousser sans demande explicite.
- Langue : français pour la doc, les messages UI et les commits.
