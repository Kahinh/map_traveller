# Recette de la 1.0 sur Windows

Contrôles manuels à dérouler sur l'application **installée** (machine Windows réelle) avant de publier la 1.0. Rien de ceci ne se vérifie dans le navigateur de développement ni sous Linux : les tests et la CI prouvent que le code compile et que la logique est juste, pas ce que voit l'utilisateur. Cocher au fur et à mesure ; un échec devient une issue.

Préparer : un Windows 11 propre (ou un compte neuf), le jeu en mode fenêtré, l'installateur de la version candidate, et une copie de `%APPDATA%\MapTraveller\` si l'on part d'une installation existante.

## Installation et données

- [ ] Installation neuve sans droits administrateur ; avertissement SmartScreen noté (texte, boutons) ; WebView2 installé s'il manquait.
- [ ] Premier lancement : 355 cartes, avec leurs images ; dossier `images/` rempli.
- [ ] Mise à jour depuis une installation existante (0.9.0) : les entrées livrées absentes s'ajoutent, les cartes de l'utilisateur restent intactes.
- [ ] Supprimer une carte livrée, relancer : elle ne revient pas (`official.json`).
- [ ] Remplacer une image livrée dans `images/`, relancer : le fichier n'est pas écrasé.
- [ ] Écriture réelle de `catalog.json`, `favorites.json`, `settings.json`, `aliases.json` et de leurs `.bak` ; aucun fichier `*.tmp` restant.
- [ ] `favorites.json` rendu illisible à la main : l'application le signale, les favoris passent en lecture seule, le fichier n'est pas réécrit.
- [ ] `catalog.json` rendu illisible : message « Catalogue illisible », restauration par `catalog.json.bak` d'après les indications.
- [ ] Paramètres › Données : « Ouvrir » lance l'Explorateur sur le dossier ; « Copier le chemin ».
- [ ] Désinstallation : le dossier `%APPDATA%\MapTraveller\` est-il conservé, avec et sans l'option de suppression des données ? Reporter le résultat dans le README.

## Images

- [ ] Import PNG, JPEG, WebP par « Choisir… » ; fichier de plus de 10 Mo refusé ; faux PNG refusé, l'image existante reste.
- [ ] Image sur un partage réseau (`\\serveur\…`) : refusée avec un message clair.
- [ ] Vignette `img-….thumb.webp` fabriquée à l'import ; supprimée à la main, elle est refaite au prochain affichage ; l'original n'est jamais modifié.
- [ ] Affichage des images par le protocole `asset:` dans la grille, le formulaire et la palette ; retour à l'original quand la vignette manque.

## Fenêtre d'un parcours Farm

- [ ] Clic sur une carte Farm (grille) et `Entrée` sur sa ligne de palette : la petite fenêtre s'ouvre devant le jeu, la palette se masque.
- [ ] Chaque case copie son seul `/travel` ; « Début » (parcours avec `/zaap`) copie le Zaap et la première position ; la commande collée fonctionne en jeu.
- [ ] Dernière case cliquée en évidence ; fermer (croix, `Échap`, Alt+F4) puis rouvrir le même parcours : elle l'est toujours.
- [ ] Ouvrir un autre parcours pendant que la fenêtre est ouverte : elle passe au nouveau parcours.
- [ ] Déplacer la fenêtre par sa barre, la redimensionner : position et taille retrouvées au relancement.
- [ ] Réduire la fenêtre principale dans la zone de notification : la fenêtre du parcours reste ; fermer la fenêtre principale quitte tout.
- [ ] Parcours modifié dans le formulaire pendant que sa fenêtre est ouverte : les cases suivent.

## Fenêtre principale

- [ ] Toujours au premier plan devant le jeu ; épingle et Paramètres › Affichage synchronisés et mémorisés.
- [ ] Position et taille retrouvées au relancement ; fenêtre ramenée sur un écran visible après débranchement d'un second écran.
- [ ] Mise à l'échelle 100 % et 150 % : deux rangées de cartes à 510 × 300, textes lisibles, rien qui déborde ; anneau de focus visible (accent plein) sur cartes, onglets, boutons et triangles.
- [ ] Survol réel des cartes et des triangles (voile, contour), étoile qui apparaît au survol.
- [ ] Clavier : Tab parcourt les cartes affichées ; panneau ouvert (Farm, Paramètres) : le focus va au bouton retour et revient à l'élément d'origine à la fermeture.
- [ ] Copie réelle dans le presse-papiers Windows, collage dans le chat du jeu (quelques cartes livrées : la commande est-elle acceptée par le jeu ?).

## Zone de notification

- [ ] Icône présente, infobulle « Map Traveller », icône de l'application (pas un carré vide).
- [ ] Clic gauche : masque / affiche ; **double-clic** : un seul basculement, pas d'aller-retour ; clic droit : menu Afficher, Ouvrir la palette, Quitter.
- [ ] Réduire (réglage actif) : fenêtre détruite, absente de la barre des tâches, moins de processus `msedgewebview2.exe` ; retour par l'icône, « Afficher », `Ctrl+Alt+T` et un second lancement, à la même position.
- [ ] Réglage inactif : réduire va dans la barre des tâches, `Ctrl+Alt+T` masque seulement.
- [ ] Formulaire ouvert avec une saisie : réduire et `Ctrl+Alt+T` ne détruisent pas la fenêtre, la saisie est intacte au retour.
- [ ] Fermer (croix) et « Quitter » terminent le processus (plus aucun `MapTraveller.exe`).
- [ ] Appuis très rapides (réduire puis `Ctrl+Alt+T`) : pas d'erreur, jamais deux fenêtres.

## Palette

- [ ] Première ouverture immédiate après le lancement ; fonctionne fenêtre principale détruite ; « Ouvrir la palette » du menu lui donne le focus.
- [ ] Devant le jeu en mode fenêtré et sans bordure ; comportement en plein écran exclusif noté.
- [ ] Ouverture réduite à la barre (48 px) ; elle grandit et se rétracte à la frappe sans clignotement ; la barre ne bouge pas ; un clic juste sous la barre atteint la fenêtre du dessous.
- [ ] Réouverture : la première image montre la barre vide (aucune ancienne requête, aucun aller-retour de taille) ; une lettre tapée dès l'ouverture n'est pas perdue.
- [ ] **Masquée : WebView au repos**, 0 % de processeur pour ses processus `msedgewebview2.exe` (Gestionnaire des tâches, quelques minutes) ; réouverture toujours instantanée.
- [ ] Perte de focus (clic ailleurs) : la palette se masque.
- [ ] Réglage « Avec Zaap » changé dans la fenêtre principale, palette rouverte : la case par défaut a changé.
- [ ] Alias personnalisé ajouté, palette rouverte : il est pris en compte.
- [ ] 150 % et second écran : taille et position correctes.

### Palette instantanée (#24)

Mesures : dans les outils de développement de la palette (WebView2), `localStorage.setItem('map-traveller:perf', '1')`, relancer l'application, faire les essais, puis `__paletteStats()` dans la console (p50 / p95 / p99 par étape). Rien n'est envoyé : les mesures restent dans la page. Retirer le drapeau ensuite.

- [ ] Raccourci → champ visible et focus : « affichage → focus » p95 < 100 ms (noter aussi le ressenti, car la mesure part de l'événement `palette:shown`, pas de l'appui sur la touche).
- [ ] `rdv` puis `Entrée` tapés en rafale dans le jeu, dix fois : chaque fois la commande de « Trône de la Cour Sombre » (alias « Reine des Voleurs ») est collée, une seule fois ; jamais celle d'un résultat de `r` ou `rd`.
- [ ] `Entrée` maintenue : une seule copie ; `Entrée` sur un champ vide : rien.
- [ ] « frappe → rendu » p95 < 50 ms et « Entrée → presse-papiers » mesurés sur une machine modeste (noter le modèle).
- [ ] Alias de fiche ajouté dans le formulaire, palette ouverte ENSUITE sans redémarrer : `alias` + `Entrée` copie cette fiche (la palette a réindexé pendant qu'elle était masquée). Même essai après suppression d'une fiche et renommage.
- [ ] Alias déjà porté par une autre fiche : le formulaire le refuse en nommant cette fiche.

## Raccourcis globaux

- [ ] `Ctrl+Alt+T` et `Ctrl+Alt+Espace` depuis le jeu.
- [ ] Changement à chaud dans Paramètres › Raccourcis ; un raccourci déjà pris par une autre application est refusé, l'ancien reste actif ; « Rétablir par défaut ».
- [ ] Focus conservé dans le champ pendant l'enregistrement (rubriques Raccourcis et Alias).

## Mises à jour (protocole en deux versions)

- [ ] Version N installée à la main ; mode manuel : « Rechercher » → dernière version ; aucune requête au lancement (Moniteur de ressources, ou lancement hors ligne).
- [ ] Version N+1 publiée : proposée en mode manuel, installée, redémarrage en N+1 avec « Mise à jour N+1 installée » ; catalogue, images, favoris et réglages intacts.
- [ ] N réinstallée, mode automatique, relance : mise à jour seule ; formulaire ouvert pendant le téléchargement : l'installation attend sa fermeture.
- [ ] Erreurs : réseau coupé au lancement (aucun message), pendant le téléchargement (l'ancienne version reste), « Rechercher » hors ligne (message clair).
- [ ] Réaction de SmartScreen et de l'antivirus à l'installation passive.

## Démarrage

- [ ] Échec de démarrage provoqué (dossier de données en lecture seule, par exemple) : un dialogue d'erreur s'affiche avant la fermeture.
