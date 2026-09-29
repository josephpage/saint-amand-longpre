# Mise en ligne : runbook

Ce document décrit, dans l'ordre, les opérations pour mettre le nouveau site en production.
Durée estimée : une demi-journée, hors propagation DNS. Chaque étape se vérifie avant de passer à la
suivante.

## 0. Prérequis et décisions

Le domaine `saintamandlongpre.fr` reste chez **Gandi** (registrar et DNS) : les serveurs DNS ne
sont pas migrés vers Cloudflare. Le site public est donc un projet **Cloudflare Pages** (un
sous-domaine externe s'y raccorde par un simple CNAME), et le serveur WordPress sert lui-même
`cms.saintamandlongpre.fr` et la redirection du domaine sans `www`.

| Élément                                             | Qui fournit                 | Statut                                                         |
| --------------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| Accès à la zone DNS Gandi `saintamandlongpre.fr`    | Mairie / prestataire actuel | à obtenir                                                      |
| Compte Cloudflare « Mairie de Saint-Amand-Longpré » | Mairie                      | créé (id `1e40a4ba657ea46de2ff64eccd25f65d`)                   |
| Projet Pages `saint-amand-longpre`                  | —                           | créé le 29/09/2026 (`saint-amand-longpre.pages.dev`)           |
| Serveur dédié avec Docker et Docker Compose         | Mairie                      | à confirmer (ports 80 et 443 ouverts)                          |
| Compte Brevo (gratuit, 300 e-mails/jour)            | Mairie                      | à créer                                                        |
| Adresse e-mail de réception des formulaires         | Mairie                      | secretariat@saintamandlongpre.fr (`MAIL_TO`, `wrangler.jsonc`) |
| Dépôt GitHub `josephpage/saint-amand-longpre`       | —                           | créé                                                           |

Répartition des noms de domaine après la bascule :

| Nom                        | Enregistrement chez Gandi                 | Servi par                          |
| -------------------------- | ----------------------------------------- | ---------------------------------- |
| `www.saintamandlongpre.fr` | CNAME `saint-amand-longpre.pages.dev.`    | Cloudflare Pages (site public)     |
| `saintamandlongpre.fr`     | A (et AAAA) : adresse IP du serveur dédié | Caddy : redirection 301 vers `www` |
| `cms.saintamandlongpre.fr` | A (et AAAA) : adresse IP du serveur dédié | Caddy → WordPress                  |
| MX, SPF, DKIM…             | inchangés (messagerie de la mairie)       | —                                  |

## 1. Cloudflare

Tout se fait dans le compte « Mairie de Saint-Amand-Longpré » (CLI `cf` ou tableau de bord). Le
projet Pages existe déjà ; sa configuration (variables, date de compatibilité) est décrite dans
`apps/web/wrangler.jsonc` et appliquée à chaque déploiement.

1. **Domaine personnalisé** du projet Pages : `www.saintamandlongpre.fr`.

   ```sh
   export CLOUDFLARE_ACCOUNT_ID=1e40a4ba657ea46de2ff64eccd25f65d
   cf pages projects domains create saint-amand-longpre --name www.saintamandlongpre.fr
   ```

   Le domaine reste « en attente » jusqu'à la bascule DNS (étape 6) : sans conséquence pour
   l'ancien site.

2. **Jeton d'API** pour GitHub Actions : Mon profil → Jetons d'API → modèle personnalisé,
   permission _Compte → Cloudflare Pages → Modifier_, limité au compte de la mairie.
3. **Turnstile** → Ajouter un widget : noms d'hôte `www.saintamandlongpre.fr` et
   `saint-amand-longpre.pages.dev`, mode « Géré ». Noter la clé de site et la clé secrète.
4. **Web Analytics** → Ajouter un site → `www.saintamandlongpre.fr` → noter le jeton du script (le
   site n'étant pas proxifié par Cloudflare, c'est le script du site qui mesure l'audience).
5. **R2** → créer le bucket `sal-sauvegardes` et une clé d'API R2 (lecture/écriture sur ce bucket).
6. **Secrets du projet Pages** (depuis `apps/web`, après `npx wrangler login` sur le compte de la
   mairie) :

   ```sh
   npx wrangler pages secret put BREVO_API_KEY --project-name saint-amand-longpre
   npx wrangler pages secret put TURNSTILE_SECRET --project-name saint-amand-longpre
   npx wrangler pages secret put PREVIEW_SECRET --project-name saint-amand-longpre   # = PREVIEW_SECRET du serveur
   npx wrangler pages secret put WP_PREVIEW_USER --project-name saint-amand-longpre  # secretariat
   npx wrangler pages secret put WP_PREVIEW_APP_PASSWORD --project-name saint-amand-longpre
   ```

## 2. Serveur WordPress (cms.saintamandlongpre.fr)

1. Chez Gandi, créer l'enregistrement **A** (et **AAAA** si le serveur a une IPv6) `cms` → adresse
   du serveur. Ouvrir les ports 80 et 443 (TCP, et UDP 443) dans le pare-feu du serveur.
2. Sur le serveur :

   ```sh
   git clone https://github.com/josephpage/saint-amand-longpre.git && cd saint-amand-longpre/apps/cms
   cp .env.prod.example .env.prod && chmod 600 .env.prod
   # renseigner .env.prod (openssl rand -base64 48 pour chaque secret ;
   # ADMIN_AUTH_HASH : docker run --rm caddy:2.11.4-alpine caddy hash-password)
   docker compose -f compose.prod.yaml --env-file .env.prod up -d
   docker compose -f compose.prod.yaml --env-file .env.prod run --rm wpcli sh /scripts/setup.sh
   ```

   Caddy obtient seul le certificat HTTPS de `cms.saintamandlongpre.fr` dès que le DNS répond.
   Tant que le domaine sans `www` pointe vers l'ancien hébergeur, Caddy ne peut pas obtenir son
   certificat : il réessaie seul après la bascule (étape 6).

3. Vérifier :
   - `https://cms.saintamandlongpre.fr/wp-admin/` demande d'abord l'identifiant `mairie` et le mot
     de passe supplémentaire, puis la connexion WordPress ;
   - `https://cms.saintamandlongpre.fr/` redirige vers le site public ;
   - la requête GraphQL `{ reglagesMairie { telephone } }` répond (sans mot de passe).
4. Dans WordPress : Profil → **Mots de passe d'application** → créer « import » puis
   « prévisualisation ».

## 3. Reprise du contenu de l'ancien site

Depuis un poste de développement (voir [reprise-contenu.md](reprise-contenu.md)) :

```sh
pnpm scrape                      # rafraîchir juste avant la bascule : pnpm scrape --refresh
pnpm cms:import --source scrape \
  --url https://cms.saintamandlongpre.fr --user secretariat --password "<mot de passe « import »>"
```

L'import est rejouable : relancé, il met à jour les contenus au lieu de les dupliquer. Vérifier dans
l'administration le nombre d'actualités (≈ 135), de séances (≈ 195) et d'élus (15).

À relire par le secrétariat : dates des actualités signalées « date estimée », fiches d'annuaire,
élus (le conseil a été renouvelé en mars 2026), coquilles reprises de l'ancien site.

## 4. Brevo

1. Créer le compte, puis Expéditeurs → ajouter `site@saintamandlongpre.fr` et **authentifier le
   domaine** (enregistrements DKIM et DMARC à ajouter dans la zone DNS Gandi).
2. SMTP & API → créer une **clé API** (secret `BREVO_API_KEY`, étape 1.6).

## 5. Premier déploiement

1. GitHub → Settings → Environments → créer **production** :
   - secrets `CLOUDFLARE_API_TOKEN` (étape 1.2) et `CLOUDFLARE_ACCOUNT_ID`
     (`1e40a4ba657ea46de2ff64eccd25f65d`) ;
   - variables `TURNSTILE_SITE_KEY`, `CF_BEACON_TOKEN`.
2. Settings → Secrets and variables → Actions → Variables : créer `DEPLOY_ENABLED` = `true`
   (tant qu'elle est absente, le workflow de déploiement ne s'exécute pas).
   Puis Actions → **Déploiement** → « Run workflow ». Le site est alors en ligne sur
   `https://saint-amand-longpre.pages.dev` : tout vérifier à cette adresse avant la bascule
   (étape 7, sauf les points liés au domaine).
3. Jeton GitHub pour WordPress : fine-grained token limité au dépôt, permission
   « Contents : Read and write », à placer dans `GITHUB_TOKEN` du fichier `.env.prod`, puis
   `docker compose -f compose.prod.yaml --env-file .env.prod up -d`.

## 6. Bascule DNS chez Gandi

1. **La veille** : abaisser à 300 s le TTL des enregistrements `www` et `@` (A) de la zone.
2. Le jour J, dans la zone DNS Gandi :
   - `www` : remplacer le CNAME `cluster.reseaudescommunes.fr.` par
     `saint-amand-longpre.pages.dev.` ;
   - `@` : remplacer l'enregistrement A `51.178.112.113` (ancien hébergeur) par l'adresse IP du
     serveur dédié (et ajouter l'AAAA le cas échéant). **Ne pas toucher aux enregistrements MX,
     SPF, DKIM** (messagerie).
3. Cloudflare → Workers & Pages → saint-amand-longpre → Domaines personnalisés : le domaine
   `www` passe « Actif » (certificat émis en quelques minutes). Caddy obtient de son côté le
   certificat du domaine sans `www`.
4. Remonter le TTL à 3 600 s une fois tout vérifié.

## 7. Vérifications avant d'annoncer le site

- [ ] `https://www.saintamandlongpre.fr` s'affiche, cadenas HTTPS valide.
- [ ] **Une seule adresse officielle** : `http://saintamandlongpre.fr/fr/actualites` et
      `https://saintamandlongpre.fr/fr/actualites` aboutissent sur
      `https://www.saintamandlongpre.fr/actualites/` (redirection Caddy puis `_redirects`), et
      `https://saint-amand-longpre.pages.dev` n'est pas indexée (balise canonique vers `www`).
- [ ] **Anciennes adresses** : depuis un poste de développement, lancer
      `pnpm check:redirects --base https://www.saintamandlongpre.fr`. Le script rejoue les
      2 046 anciennes adresses connues et des adresses inventées dans chaque rubrique : toutes
      doivent répondre 301 et aboutir sur une page existante. Relancer une semaine plus tard,
      puis surveiller Search Console → Pages.
- [ ] Formulaire de contact : un message arrive dans la boîte de la mairie, « Répondre » écrit à
      l'expéditeur.
- [ ] Signalement avec photo : la photo est jointe.
- [ ] Publier une actualité de test dans WordPress : elle apparaît sur le site en moins de 5 minutes
      (onglet Actions de GitHub pour suivre), puis la supprimer.
- [ ] Bouton « Prévisualiser » sur un brouillon : l'aperçu s'ouvre sur le site.
- [ ] Recherche : « passeport » renvoie la page Passeport.
- [ ] `https://www.saintamandlongpre.fr/_worker.js/index.js` répond 404 (le code serveur n'est
      jamais publié en statique).
- [ ] Planifier l'audit RGAA, puis mettre à jour la déclaration d'accessibilité.
- [ ] Planifier le reportage photo (voir [photos-a-prendre.md](photos-a-prendre.md)) : les photos
      P1 remplacent les emplacements vides de l'accueil et des salles.
- [ ] Prévenir le prestataire actuel (Réseau des Communes) de la fin du contrat après la bascule.

## 8. Référencement (SEO) et assistants IA (GEO)

Le site publie tout ce qu'il faut (voir [architecture.md](architecture.md#référencement-et-assistants-ia)).
Il reste à le faire connaître et à aligner les sources externes que Google et les IA croisent.

Le domaine n'étant pas sur Cloudflare, les réglages de zone (politiques des robots IA,
« Managed robots.txt », Crawler Hints) ne s'appliquent pas : le `robots.txt` du site fait foi et
autorise explicitement moteurs et assistants IA.

**Moteurs de recherche**

- [ ] [Google Search Console](https://search.google.com/search-console) : propriété de domaine
      (vérification par un enregistrement TXT dans la zone DNS Gandi), envoyer `https://www.saintamandlongpre.fr/sitemap.xml`,
      demander l'indexation de l'accueil et de `/decouvrir/la-commune/`.
- [ ] [Bing Webmaster Tools](https://www.bing.com/webmasters) : importer depuis Search Console.
      Bing alimente ChatGPT (recherche), Copilot et DuckDuckGo : c'est essentiel pour le GEO.
- [ ] Surveiller l'onglet « Pages » de Search Console pendant un mois : les anciennes adresses
      doivent passer en « Page avec redirection ».

**Sources externes à mettre à jour** (les IA y recoupent les informations)

- [ ] **Annuaire Service-Public** : l'adresse du site y figure en `http://`. La mairie la corrige via
      le lien « Signaler une erreur » de sa fiche (ou le correspondant annuaire de la préfecture).
- [ ] **Google Business Profile** « Mairie de Saint-Amand-Longpré » : revendiquer la fiche, y
      mettre le site, les horaires, le téléphone et l'e-mail.
- [ ] **Wikidata** ([Q1424723](https://www.wikidata.org/wiki/Q1424723)) : propriété « site officiel »
      (P856) = `https://www.saintamandlongpre.fr` ; l'infobox Wikipédia la reprend.
- [ ] **OpenStreetMap** : balise `website` du nœud de la mairie.
- [ ] Page Facebook de la commune et site de Territoires Vendômois : lien vers le nouveau site.

**Contrôles**

- [ ] [Test des résultats enrichis](https://search.google.com/test/rich-results) sur l'accueil,
      une actualité, un évènement et `/decouvrir/la-commune/` : aucune erreur.
- [ ] Poser à ChatGPT, Perplexity et Gemini « Quels sont les horaires de la mairie de
      Saint-Amand-Longpré ? » quelques semaines après la mise en ligne : la réponse doit citer le site.

## Retour arrière

Tant que l'ancien site existe, il suffit de rétablir dans la zone DNS Gandi les deux
enregistrements d'origine : `www` CNAME `cluster.reseaudescommunes.fr.` et `@` A
`51.178.112.113`. Avec un TTL de 300 s, le retour est effectif en quelques minutes. Le WordPress,
le projet Pages et les sauvegardes ne sont pas affectés.

## Exploitation courante

- **Sauvegardes** : chaque nuit à 3 h 30 vers R2, 30 jours de rétention, chiffrées (GPG). Tester une
  restauration une fois par trimestre :
  `docker run --rm -v ./restauration:/out offen/docker-volume-backup:v2.49.1 …` (voir la
  documentation d'offen/docker-volume-backup) puis réimporter `sauvegarde.sql`.
- **Mises à jour** : WordPress applique seul les versions mineures. Pour une version majeure ou une
  extension : changer la version dans `compose.prod.yaml` / `scripts/setup.sh`, puis `up -d` et
  relancer `setup.sh` (idempotent).
- **Reconstruction manuelle** du site : Actions → Déploiement → « Run workflow ».
- **Revenir à une version précédente du site** : Workers & Pages → saint-amand-longpre →
  Déploiements → « Restaurer » sur un déploiement antérieur (immédiat).
- **Journaux des formulaires et de la prévisualisation** : Workers & Pages → saint-amand-longpre
  → Déploiements → le déploiement actif → Fonctions → Diffusion en temps réel.
- **Certificats** : Caddy renouvelle seul ceux du serveur (`docker compose … logs caddy` en cas de
  doute) ; Cloudflare renouvelle celui de `www`.
