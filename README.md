# Map Traveller

Petite fenêtre Windows à garder au-dessus de **Dofus** (mode fenêtré ou sans bordure) : un clic sur une carte copie la commande `/travel` voulue dans le presse-papiers, il ne reste qu'à la **coller soi-même** dans le chat du jeu.

> **Ce que l'application ne fait pas.** Elle ne colle ni ne tape jamais rien dans le jeu, ne lit pas sa mémoire, n'intercepte pas le réseau et n'automatise aucune action. Elle fonctionne hors ligne, sans compte ni télémétrie. Sa seule connexion possible est la recherche de mises à jour sur GitHub, et en mode manuel (par défaut) elle n'a lieu que si vous cliquez sur « Rechercher » (voir [Mises à jour](#mises-à-jour)).

## Installer

1. Sur la page **Releases** du dépôt, télécharger `MapTraveller_X.Y.Z_x64-setup.exe` (dernière version).
2. Le lancer. L'installation se fait pour l'utilisateur courant, **sans droits administrateur**. Node.js et Rust ne sont pas nécessaires.
3. **SmartScreen** : l'installateur n'est pas signé par un certificat Windows ; Windows peut afficher « Windows a protégé votre ordinateur ». Cliquer sur « Informations complémentaires », puis « Exécuter quand même ».
4. **WebView2** (le moteur d'affichage de Windows) : déjà présent sur Windows 10 à jour et Windows 11 ; s'il manque, l'installateur le télécharge.

**Désinstaller** : Paramètres Windows › Applications › Map Traveller › Désinstaller. Vos données sont dans `%APPDATA%\MapTraveller\`, un dossier distinct de celui que vise l'option de suppression des données du désinstalleur (`app.maptraveller`) : il devrait être conservé (à vérifier sur Windows). Pour tout effacer, supprimer ce dossier à la main.

## Premiers pas

1. Lancer Map Traveller : la fenêtre s'ouvre au premier plan, avec le catalogue livré (donjons, PNJ, hôtels des ventes et ateliers).
2. Taper quelques lettres (`bijou`, `temple`…) : la grille se filtre aussitôt.
3. **Clic gauche** sur une carte : la commande sans le `/zaap` initial est copiée. **Clic droit** : la commande complète.
4. Dans le jeu, coller (`Ctrl+V`) dans le chat et valider.
5. Depuis le jeu, `Ctrl+Alt+Espace` ouvre la **palette de recherche** : taper, `Entrée`, la commande est copiée et la palette se referme.

## Copier une commande

| Action sur une carte | Copie |
|---|---|
| Clic gauche | la commande **sans le `/zaap` initial** |
| Clic droit | la commande **complète**, Zaap compris |
| Étoile (coin de la carte) | ajoute ou retire des favoris, sans rien copier |

Exemple (coordonnées fictives) : `/zaap 5 -18;/travel 1 1;/travel 2 2` donne `/travel 1 1;/travel 2 2` au clic gauche et la commande entière au clic droit. Seul le **premier** segment est retiré, et seulement s'il s'agit d'un `/zaap` ; le reste est copié exactement tel quel. Une commande vide ne copie rien et un message le signale.

**Cartes à deux étapes** (PNJ et Donjons). Pour un trajet qui demande un passage manuel (portail, PNJ, entrée d'une dimension), la carte est coupée en deux triangles par une diagonale : le triangle haut-gauche (repère « 1 ») copie le trajet jusqu'à l'accès, le triangle bas-droite (repère « 2 ») le trajet sur place. Chaque triangle suit les mêmes règles de clic. Franchir le passage reste à faire soi-même.

**Parcours Farm.** Un clic (gauche ou droit) sur une carte Farm ouvre le parcours : une petite carte par position (`1,1`, `2,2`…).

- **Début** : copie le parcours complet, Zaap initial compris.
- **Clic sur une position** : c'est la **dernière position atteinte** ; la suite du parcours est copiée aussitôt, sans second clic.
- **Dernière position** : rien n'est copié, un message signale la fin du parcours.

La position cliquée reste surlignée et les précédentes estompées, le temps de la session. La reprise se fait par numéro d'étape : un parcours qui repasse par les mêmes coordonnées fonctionne.

## Palette de recherche

`Ctrl+Alt+Espace` ouvre, depuis n'importe quelle fenêtre, une barre de recherche au centre de l'écran principal. Les résultats apparaissent dessous dès la première lettre (huit lignes visibles, puis défilement) ; la palette se referme après une copie ou quand on clique ailleurs.

| Touche | Effet |
|---|---|
| `↑` `↓` | changer de ligne |
| `Entrée` ou clic | copier la variante sélectionnée ; `Entrée` agit toujours sur ce qui est tapé, même saisi plus vite que l'affichage, et ne copie rien si le champ est vide |
| `Ctrl+Entrée` ou clic droit | copier l'autre variante |
| `←` `→` | sur une ligne à deux cases, passer de « sans Zaap » à « avec Zaap » |
| `Échap` | fermer sans copier |

- **Recherche tolérante** (aussi dans la fenêtre principale) : par nom, alias, tag, zone ou catégorie (`donjon …`, `farm …`). Elle ignore les accents, les majuscules, la ponctuation, les mots de liaison (« de », « du », « l' »…) et l'ordre des mots. Si rien ne correspond exactement, elle tolère une faute de frappe (deux à partir de 8 lettres) sur les mots de 4 lettres et plus.
- **Ordre des résultats**, du meilleur au moins bon : alias exact, nom exact, début du nom ou d'un alias, tous les mots trouvés, initiales (`rdv` ou `rv` pour « Reine des Voleurs »), mot trouvé à l'intérieur d'un autre, faute de frappe ; à égalité, les favoris puis l'ordre du catalogue.
- **Alias** : deux sortes. Le **dictionnaire** (Paramètres › Alias) vaut pour toutes les destinations : un mot y remplace sa signification (`hdv` pour « hôtel des ventes »), un mot de plus affine (`hdv bonta`). Les **alias d'une fiche** (formulaire, Plus d'options) ne désignent qu'elle : un alias déjà porté par une autre destination est refusé. Voir [Paramètres](#paramètres).
- Les modifications du catalogue et des alias sont prises en compte dès l'enregistrement, sans redémarrer ni rouvrir la palette.
- **Une ligne par étape** : une carte à deux étapes donne « — Étape 1 » et « — Étape 2 », l'une sous l'autre.
- **Avec ou sans Zaap** : sur une ligne qui commence par `/zaap`, deux cases à droite, *sans Zaap* et *avec Zaap* ; la case en surbrillance est celle qu'`Entrée` copie, un clic sur une case copie la sienne. La case par défaut se règle dans Paramètres › Palette.
- **Farm** : le nom du parcours donne « parcours complet » puis une ligne par position ; le nom suivi d'une position reprend la suite (avec un parcours fictif « Tremble », `farm tremble 2 2` copie les étapes après `2,2`).
- **Zaap le plus proche** : `proche -20,-20` (ou `proche -20 -20`) liste les trois zaaps les plus proches de cette position. `Entrée` copie le zaap puis le trajet vers la position, `Ctrl+Entrée` le zaap seul. `proche incarnam 2,-4` cherche parmi les zaaps d'Incarnam. La distance est comptée en cartes, à vol d'oiseau : la mer et les obstacles ne sont pas pris en compte.

## Gérer ses destinations

- **`+`** (à droite des onglets) : « Nouvelle destination ». La catégorie de l'onglet actif est présélectionnée.
- **Crayon** (« Gérer les destinations ») : un crayon apparaît sur chaque carte et ouvre son formulaire. Les clics gauche et droit des cartes copient toujours. `Échap` quitte ce mode.
- Formulaire : **Nom**, **Catégorie** (PNJ, Donjon, Lieu-dit, Farm), **Image** (facultative, « Choisir… » : PNG, JPEG ou WebP, 10 Mo au plus, copiée dans vos données), **Trajet en deux étapes** (PNJ et Donjons, affiche « Commande 1 » et « Commande 2 »), **Commande** (enregistrée exactement telle que saisie), **Plus d'options** (zone, alias, tags, ordre d'affichage). L'aperçu montre ce que copiera chaque clic, ou les positions reconnues d'un parcours Farm.
- **Enregistrer** (`Ctrl+Entrée`) écrit aussitôt sur le disque. **Dupliquer** crée une copie (sans les alias, propres à chaque fiche) ; **Supprimer** demande une confirmation et retire aussi la carte des favoris. **Annuler** ou `Échap` ferme le formulaire (confirmation s'il reste des modifications).
- « Retirer » enlève l'image d'une carte sans supprimer le fichier : aucun fichier image n'est jamais supprimé automatiquement.

## Paramètres

L'engrenage de la barre de titre ouvre les Paramètres. Chaque réglage est enregistré dès qu'il change.

1. **Mises à jour** : version installée, mode (Manuel ou Automatique), bouton « Rechercher ».
2. **Données** : emplacement de vos données, boutons « Ouvrir » et « Copier le chemin », contenu du dossier.
3. **Affichage** : « Toujours au premier plan » (même réglage que l'épingle de la barre de titre) et « Réduire dans la zone de notification ».
4. **Palette** : variante par défaut, *Sans Zaap* ou *Avec Zaap* (ce que copie `Entrée`).
5. **Alias** : le dictionnaire de la recherche, commun à la fenêtre et à la palette. Les alias fournis (`hdv`, `rdv`) se désactivent ou se remplacent ; les vôtres s'ajoutent, se modifient et se suppriment.
6. **Raccourcis** : les deux raccourcis globaux. Cliquer sur le champ, puis appuyer sur la combinaison (Ctrl ou Alt, plus une lettre, un chiffre, F1 à F12 ou Espace) ; « Rétablir par défaut » revient à l'origine. Un raccourci déjà pris par une autre application est refusé et l'ancien est conservé.

## Raccourcis clavier

| Où | Touche | Effet |
|---|---|---|
| Partout (global, réglable dans Paramètres › Raccourcis) | `Ctrl+Alt+T` | afficher ou masquer la fenêtre |
| Partout (global, réglable) | `Ctrl+Alt+Espace` | ouvrir ou fermer la palette |
| Fenêtre | taper du texte | lance la recherche |
| Fenêtre | `Ctrl+F` | place le curseur dans la recherche |
| Fenêtre | `Échap` | ferme le panneau ouvert (parcours Farm, Paramètres), sinon efface la recherche, sinon quitte le mode gestion |
| Formulaire | `Ctrl+Entrée` / `Échap` | enregistrer / annuler |
| Palette | voir [Palette de recherche](#palette-de-recherche) | |

## Zone de notification et fermeture

Map Traveller a une icône dans la zone de notification (près de l'horloge, parfois parmi les icônes cachées sous la flèche `^`).

- **Clic gauche** sur l'icône : afficher ou masquer la fenêtre. **Clic droit** : menu **Afficher**, **Ouvrir la palette**, **Quitter**.
- Réglage « Réduire dans la zone de notification » actif (par défaut) : le bouton réduire et `Ctrl+Alt+T` ferment la fenêtre et laissent l'application dans la zone de notification ; elle revient à sa place après un court chargement. Réglage inactif : réduire envoie la fenêtre dans la barre des tâches.
- Formulaire ouvert : la fenêtre est seulement réduite ou masquée, la saisie est conservée.
- Le bouton **fermer** quitte l'application, comme **Quitter** dans le menu de l'icône. Relancer l'application réaffiche la fenêtre déjà ouverte (une seule instance).
- La palette reste prête en permanence : son raccourci fonctionne aussi quand la fenêtre est dans la zone de notification.

## Mises à jour

| Mode | Comportement |
|---|---|
| **Manuel** (par défaut) | Aucune connexion sans votre clic. « Rechercher » indique si vous avez la dernière version ou propose « Installer et redémarrer » ; rien n'est téléchargé avant ce second clic. |
| **Automatique** | Quelques secondes après l'ouverture de la fenêtre (au plus une fois toutes les deux minutes), une vérification a lieu ; une nouvelle version est téléchargée, installée, puis l'application redémarre. Jamais pendant qu'un formulaire est ouvert, rien tant que l'application est dans la zone de notification, aucun message si le réseau manque. |

- **Ce qui est envoyé** : une requête HTTPS vers la page des Releases du dépôt (`latest.json`), puis, si vous installez, le téléchargement de l'installateur. GitHub voit votre adresse IP et le fichier demandé, comme pour tout téléchargement. Aucun identifiant, aucune statistique, rien de votre catalogue.
- **Signature** : chaque installateur publié est signé ; l'application vérifie la signature avant d'installer et refuse un fichier non signé ou modifié.
- L'installation est passive (une barre de progression), puis l'application redémarre et affiche « Mise à jour X.Y.Z installée ». Vos données ne sont pas touchées. Le système ne revient jamais à une version antérieure.
- Les versions 0.4.0 et antérieures ne savent pas se mettre à jour : installer une fois la nouvelle version à la main (fermer Map Traveller, lancer le nouvel installateur, qui remplace l'ancien sur place).

## Vos données

Tout est dans `%APPDATA%\MapTraveller\` (Paramètres › Données › « Ouvrir ») :

| Fichier | Contenu |
|---|---|
| `catalog.json` | vos destinations |
| `favorites.json` | vos favoris |
| `settings.json` | vos réglages (premier plan, zone de notification, palette, raccourcis, mode de mise à jour) |
| `aliases.json` | vos alias et les alias fournis désactivés (créé à la première personnalisation) |
| `official.json` | les destinations livrées déjà proposées : une destination livrée que vous supprimez ne revient pas |
| `images/` | images importées (renommées `img-…`), leurs vignettes `img-….thumb.webp`, et les images du catalogue livré |
| `*.bak` | la version précédente de chaque fichier, dont `catalog.json.bak` |

- Chaque écriture est atomique (fichier temporaire puis remplacement). Un fichier illisible n'est jamais réécrit : l'application passe en lecture seule pour ce fichier et le signale ; restaurer alors le `.bak` correspondant, application fermée.
- **Sauvegarder** : copier tout le dossier. **Restaurer** : le recopier, application fermée. Fermer l'application avant de modifier ces fichiers à la main.
- Le catalogue livré **s'ajoute** à vos données : au premier lancement il est copié, et après une mise à jour seules les entrées jamais proposées sont ajoutées. Une carte que vous avez modifiée n'est jamais remplacée.
- Windows contient aussi deux dossiers techniques `app.maptraveller` (position de la fenêtre dans `%APPDATA%`, cache d'affichage dans `%LOCALAPPDATA%`), sans aucune de vos données.

## Catalogue livré

355 destinations réelles : 126 donjons, 32 PNJ (temples de classe, banques, Almanax…) et 197 hôtels des ventes et ateliers, avec 173 images. Elles sont **générées** depuis les données extraites du client du jeu (publication `v6.0_3.7.13.17` de [dofus-sqlite](https://github.com/ledouxm/dofus-sqlite)), jamais saisies à la main. La commande est celle du zaap le plus proche **à vol d'oiseau** (référentiel de 48 zaaps relevé sur [Teckium](https://teckium.fr/pnj-dofus-3/zaap/95-cite-d-astrub/)), puis `/travel` vers la cible ; un donjon d'un autre monde dont l'entrée est sur la carte du Monde des Douze devient une carte à deux étapes.

**Ces commandes n'ont pas été testées en jeu.** Le zaap choisi peut être de l'autre côté de la mer ou d'un obstacle : corrigez la carte dans le formulaire si besoin, votre version sera conservée.

## FAQ

- **La palette n'apparaît pas devant le jeu.** En plein écran exclusif, Windows peut l'en empêcher : passer le jeu en mode fenêtré ou sans bordure.
- **Je ne trouve pas l'icône.** Windows range souvent une nouvelle icône parmi les icônes cachées (flèche `^` de la barre des tâches) ; on peut la faire glisser à côté de l'horloge.
- **SmartScreen bloque l'installation.** L'installateur n'est pas signé par un certificat Windows : « Informations complémentaires », puis « Exécuter quand même ».
- **Le zaap « proche » est de l'autre côté de la mer.** La distance est comptée à vol d'oiseau, sans tenir compte du terrain : choisir un autre des trois zaaps proposés, ou corriger la carte.
- **Revenir à une version antérieure.** Les mises à jour ne reviennent jamais en arrière. Sauvegarder d'abord `%APPDATA%\MapTraveller\`, puis installer à la main l'installateur de la version voulue depuis la page des Releases (comportement de l'installateur dans ce sens : à vérifier). Une version 0.1.x refuse un catalogue au schéma 3, sans le modifier.

## Confidentialité et droits

Map Traveller est un projet personnel, **sans affiliation avec Ankama**. Dofus et ses contenus (noms, positions, images du catalogue livré) appartiennent à leurs auteurs ; les données viennent de [dofus-sqlite](https://github.com/ledouxm/dofus-sqlite) (extraction du client) et les positions des zaaps de [Teckium](https://teckium.fr/pnj-dofus-3/zaap/95-cite-d-astrub/). L'ergonomie de l'application PNJ sert de référence, sans en reprendre de ressource. Aucune donnée ne quitte votre ordinateur, hormis la recherche de mises à jour décrite plus haut.

Licence : à préciser.

## Après la 1.0

- Import / export ZIP de vos données (catalogue, images, favoris, réglages), et import JSON seul.
- Nettoyage explicite des images orphelines.
- Validation sur Windows 11 propre, mise à l'échelle 100 % et 150 %, plusieurs écrans (liste de contrôle : [docs/recette-v1.md](docs/recette-v1.md)).

## Contribuer

Développement, tests et outillage : [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Publication d'une version : [docs/RELEASING.md](docs/RELEASING.md). Historique : [CHANGELOG.md](CHANGELOG.md).
