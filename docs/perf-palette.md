# Performance de la recherche de la palette

Mesures de l'issue n°24, reproductibles par `npm run bench:palette` (`bench/palette.bench.ts`, hors de `npm test`).

**Ce sont des mesures Node, pas WebView2 sous Windows.** Elles mesurent le moteur (index, classement, fabrication des lignes, `searchPalette`), pas le rendu, le focus ni le presse-papiers. Les temps réels se relèvent sur l'application installée avec le drapeau `map-traveller:perf` (voir [recette-v1.md](recette-v1.md), « Palette instantanée »).

## Protocole

- Catalogues **fictifs** de 100, 1 000 et 10 000 destinations, plus une « Reine des Voleurs » d'alias `RDV` ; chaque destination a deux alias de fiche (un court, `k2s`, et un de deux mots), un tag et une zone ; dictionnaire global de 40 termes.
- 200 essais par requête, **cache des coûts vidé avant chaque essai** (première frappe d'un mot : le cas le plus lent ; en frappe réelle, les mots déjà tapés sont repris du cache).
- Requêtes : alias de fiche exact, terme du dictionnaire (`hdv`), `rdv`, une, deux et trois lettres, deux mots, faute de frappe (seconde passe).
- Construction : médiane de 7 constructions ; mémoire : `heapUsed` avant / après, ramasse-miettes forcé (`--expose-gc`).
- Machine : Intel Xeon 2,1 GHz, 2 cœurs virtuels partagés (conteneur Linux), Node v22.23.4. Machine bruitée : les écarts de ±30 % d'une exécution à l'autre sont du bruit.

## Budgets de l'issue

| Mesure | Cible | 10 000 destinations (p95) |
|---|---|---|
| Alias exact | < 5 ms | 1,5 ms (alias de fiche), 3,1 ms (terme du dictionnaire), 0,7 ms (`rdv`) |
| Requêtes courantes | < 10 ms | 6,8 ms au pire (une lettre) |
| Mise à jour visible, raccourci → focus, Entrée → copie | 50 ms, 100 ms, immédiat | non mesurables ici : recette Windows |

Catalogue livré réel (355 destinations, même machine, à froid) : `rdv` 3,3 ms → « Trône de la Cour Sombre » seul ; `hdv` 1,1 ms ; `hdv bonta` 0,5 ms ; `melou donjon` 0,9 ms (faute de frappe) ; construction ~13 ms au premier appel.

## Avant / après (#24)

Avant : moteur de la revue V1.0 (coûts additionnés, sans paliers ni acronymes). Après : paliers, acronymes, textes joints pour le palier « début du nom ».

| Destinations | Construction avant | Construction après | Mémoire avant | Mémoire après |
|---:|---:|---:|---:|---:|
| 100 | 1,1 ms | 2,7 ms | 0,1 Mo | 0,1 Mo |
| 1 000 | 7,5 ms | 17,1 ms | 1,0 Mo | 1,3 Mo |
| 10 000 | 107 ms | 144 ms | 7,5 Mo | 11,1 Mo |

Le surcoût de construction (acronymes du nom et de chaque alias, textes joints, deux tables de textes entiers au lieu d'une) est payé une fois par changement du catalogue ou des alias, hors du chemin de frappe : au lancement (palette préchargée) et à chaque enregistrement (`store:changed`), palette masquée.

| Destinations | Requête | p95 avant (ms) | p95 après (ms) |
|---:|---|---:|---:|
| 1 000 | alias de fiche exact | 0,26 | 0,51 |
| 1 000 | `hdv` | 0,35 | 0,59 |
| 1 000 | une lettre | 0,72 | 0,83 |
| 1 000 | deux mots | 0,18 | 0,15 |
| 1 000 | faute de frappe | 0,28 | 0,21 |
| 10 000 | alias de fiche exact | 1,21 | 1,46 |
| 10 000 | `hdv` | 2,68 | 3,13 |
| 10 000 | `rdv` | 1,31 | 0,67 |
| 10 000 | une lettre | 6,43 | 6,78 |
| 10 000 | deux lettres | 2,29 | 3,88 |
| 10 000 | trois lettres | 1,83 | 3,23 |
| 10 000 | deux mots | 1,20 | 1,56 |
| 10 000 | faute de frappe | 1,48 | 2,06 |

Le surcoût par frappe (une à trois lettres) vient du palier « début du nom ou d'un alias », testé sur chaque destination trouvée, et des acronymes, cherchés pour toute requête d'un seul mot. Il reste sous les budgets avec une marge d'un facteur 1,5 à 3 sur 10 000 destinations.

## Résultats complets (après)

| Destinations | Requête | p50 (ms) | p95 (ms) | p99 (ms) |
|---:|---|---:|---:|---:|
| 100 | alias de fiche exact | 0,105 | 0,196 | 0,286 |
| 100 | alias global exact (hdv) | 0,082 | 0,161 | 0,988 |
| 100 | « rdv » | 0,024 | 0,038 | 0,070 |
| 100 | 1 lettre | 0,107 | 0,252 | 1,14 |
| 100 | 2 lettres | 0,047 | 0,089 | 0,117 |
| 100 | 3 lettres | 0,035 | 0,071 | 0,089 |
| 100 | deux mots | 0,035 | 0,053 | 0,083 |
| 100 | faute de frappe | 0,101 | 0,199 | 0,736 |
| 1000 | alias de fiche exact | 0,126 | 0,505 | 2,53 |
| 1000 | alias global exact (hdv) | 0,266 | 0,585 | 1,65 |
| 1000 | « rdv » | 0,097 | 0,120 | 0,139 |
| 1000 | 1 lettre | 0,387 | 0,833 | 1,03 |
| 1000 | 2 lettres | 0,139 | 0,348 | 0,456 |
| 1000 | 3 lettres | 0,171 | 0,304 | 0,326 |
| 1000 | deux mots | 0,090 | 0,153 | 0,168 |
| 1000 | faute de frappe | 0,116 | 0,205 | 0,307 |
| 10000 | alias de fiche exact | 0,924 | 1,46 | 2,10 |
| 10000 | alias global exact (hdv) | 2,33 | 3,13 | 5,64 |
| 10000 | « rdv » | 0,570 | 0,668 | 0,854 |
| 10000 | 1 lettre | 3,87 | 6,78 | 7,53 |
| 10000 | 2 lettres | 1,48 | 3,88 | 4,09 |
| 10000 | 3 lettres | 1,42 | 3,23 | 3,37 |
| 10000 | deux mots | 1,31 | 1,56 | 1,60 |
| 10000 | faute de frappe | 1,66 | 2,06 | 2,23 |

## Arbitrages

- **Pas de bibliothèque fuzzy** (Fuse.js, MiniSearch) : le moteur tient les budgets sur 10 000 destinations, et la tolérance aux fautes reste une seconde passe qui ne s'exécute que si rien d'exact n'est trouvé.
- **Pas de moteur côté Rust** : un aller-retour IPC par frappe coûterait plus que la recherche elle-même.
- **Pas de debounce** : chaque frappe recalcule ; `Entrée` refait la recherche de façon synchrone si le rendu est en retard (`enterChoice`).
