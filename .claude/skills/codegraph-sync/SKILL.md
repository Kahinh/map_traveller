---
name: codegraph-sync
description: Synchroniser ou réindexer l'index CodeGraph de Map Traveller. À utiliser quand l'utilisateur demande « sync codegraph », « /codegraph-sync », ou quand une requête CodeGraph renvoie des résultats manifestement périmés.
---

# codegraph-sync

1. `codegraph sync` à la racine du dépôt (ou `codegraph index` si `.codegraph/codegraph.db` est absent).
2. `codegraph status` et afficher fichiers / nœuds / arêtes.
3. Confirmer que l'index est à jour.

## Requêtes utiles

```bash
codegraph query leftClickCommand
sqlite3 .codegraph/codegraph.db "SELECT name, kind, file_path, start_line FROM nodes WHERE lower(name) LIKE '%farm%';"
sqlite3 .codegraph/codegraph.db "SELECT s.name, s.file_path FROM edges e JOIN nodes s ON e.source=s.id JOIN nodes t ON e.target=t.id WHERE e.kind='calls' AND t.name='copyText';"
```
