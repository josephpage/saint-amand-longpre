# Reprise du contenu de l'ancien site

L'ancien site (plateforme « Réseau des Communes ») n'a ni export ni API. Le scraper
(`tools/scraper`) l'explore comme un visiteur, reconnaît chaque gabarit de page et produit un
snapshot structuré (`data/scrape/snapshot.json` et `data/scrape/media/`).

## Fonctionnement

1. **Exploration** (`crawl.ts`) : parcours en largeur depuis la page d'accueil et les rubriques,
   300 ms entre deux requêtes, cache disque (`data/scrape/cache`) pour ne pas solliciter à nouveau
   le serveur. Sont exclus : petites annonces (données personnelles de particuliers), météo, sondages,
   calendriers de réservation des salles (navigation infinie), liens relatifs cassés.
2. **Classement** (`classify.ts`) : chaque adresse est associée à un gabarit (page d'information,
   actualité, évènement, séance, élu, salle, association, commerce, numéro utile, album…).
3. **Extraction** (`extract.ts`) : titre, contenu, pièces jointes, diaporamas, champs structurés
   (horaires, capacités, coordonnées, délégations…).
4. **Normalisation** :
   - HTML nettoyé (`clean-html.ts`) : styles en ligne, polices, images locales cassées et
     paragraphes vides supprimés ;
   - arborescence recalculée selon le nouveau plan (`config.ts`, `PAGE_PATHS`), les sous-rubriques
     héritant du chemin de leur parent ;
   - dates d'actualités déduites du texte (l'ancien site ne les publie pas) ; à défaut, la date de
     l'actualité suivante est reprise et l'actualité est marquée « date estimée » ;
   - catégories d'actualités déduites par mots-clés ;
   - liens internes réécrits vers les nouvelles adresses ;
   - une redirection 301 par ancienne adresse.
5. **Médias** (`media.ts`) : original récupéré plutôt que la vignette, type détecté sur le contenu
   (certains fichiers sont servis sans type), dimensions lues avec Sharp.
6. **Validation** du snapshot avec le schéma zod partagé (`packages/model`).

Dernier passage (28/09/2026) : 90 pages, 135 actualités, 2 évènements, 195 séances du conseil,
15 élus, 2 salles, 103 fiches d'annuaire, 985 médias, 503 redirections.

## Jeu de données de test

`pnpm fixtures` produit `data/fixtures` (versionné, environ 7 Mo) à partir du scraping : toutes les
pages et fiches, les 30 dernières actualités, les 24 dernières séances, images réduites en WebP, un
PDF de démonstration à la place des documents, plus quatre évènements à venir et une alerte, tous
signalés « exemple ». C'est la source par défaut du site en développement, en CI et pour les tests
de bout en bout.

## Import dans WordPress

`pnpm cms:import [--source fixtures|scrape] [--url … --user … --password …]` :

- téléverse les médias (images réduites à 2 400 px de large) et renseigne texte alternatif et titre ;
- crée l'arborescence des pages (rubriques puis sous-pages), les actualités, évènements, séances,
  élus, salles, fiches d'annuaire, alertes, réglages et redirections ;
- convertit le texte en bloc « Classique », les galeries en blocs Galerie et les pièces jointes en
  blocs Fichier, modifiables dans l'éditeur ;
- est idempotent : l'identifiant d'origine est stocké dans `_sal_source_id`, une relance met à jour.

## Points à relire après import

- Les 77 actualités à date estimée (filtre possible sur le champ `_sal_date_estimee`).
- Les coquilles d'origine (« Urbansime », « Etat civil » sans accent…).
- Les élus : liste issue de l'ancien site, à confronter au conseil installé en mars 2026.
- Les pages orphelines rangées dans « Vivre ici » (PLU, SCoT, SPANC, SIDELC…).
