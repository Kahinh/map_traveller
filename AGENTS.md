# AGENTS.md — Map Traveller

Point d'entrée pour tout agent de code. Les règles du projet sont dans **[CLAUDE.md](CLAUDE.md)** : ce fichier n'en duplique rien.

Avant d'écrire une ligne :

1. Lire `CLAUDE.md` (architecture, invariants, où commencer, validation).
2. `npm run help` : le menu des commandes du dépôt. Préférer une cible du menu à une commande reconstruite.
3. `npm run context -- <mots de la tâche>` : les fichiers à lire en premier.
4. `docs/agent-notes.md` : les pièges déjà rencontrés ; `docs/CONTRIBUTING.md` : prérequis (dont Rust sous Linux).

Avant de rendre la main : `npm run check:full`, puis dire explicitement ce qui n'a pas pu être vérifié.
