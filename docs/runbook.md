# Mise en ligne : runbook

Ce document décrit, dans l'ordre, les opérations pour mettre le nouveau site en production.
Durée estimée : une demi-journée, hors propagation DNS. Chaque étape se vérifie avant de passer à la
suivante.

## 0. Prérequis et décisions

| Élément                                              | Qui fournit                 | Statut                                          |
| ---------------------------------------------------- | --------------------------- | ----------------------------------------------- |
| Accès au registrar du domaine `saintamandlongpre.fr` | Mairie / prestataire actuel | à obtenir                                       |
| Compte Cloudflare (gratuit)                          | Mairie                      | à créer                                         |
| Serveur dédié avec Docker et Docker Compose          | Mairie                      | à confirmer                                     |
| Nom et adresse de l'hébergeur du serveur             | Mairie                      | à renseigner dans `apps/web/src/site.config.ts` |
| Compte Brevo (gratuit, 300 e-mails/jour)             | Mairie                      | à créer                                         |
| Adresse e-mail de réception des formulaires          | Mairie                      | à fournir                                       |
| Dépôt GitHub `josephpage/saint-amand-longpre`        | —                           | créé                                            |

## 1. Cloudflare : domaine et comptes

1. Ajouter `saintamandlongpre.fr` à Cloudflare (offre gratuite), puis remplacer les serveurs DNS
   chez le registrar par ceux indiqués par Cloudflare. **Recopier d'abord les enregistrements MX et
   TXT existants** (messagerie de la mairie) : Cloudflare les importe, mais vérifier.
2. Récupérer l'**identifiant de compte** (tableau de bord, colonne de droite).
3. Créer un **jeton d'API** « Modifier les Workers Cloudflare » (modèle) avec en plus
   « Workers KV Storage : Edit » (Astro crée un espace KV de sessions au premier déploiement).
4. Turnstile → **Ajouter un site** : domaine `saintamandlongpre.fr`, mode « Géré ». Noter la clé de
   site et la clé secrète.
5. Web Analytics → **Ajouter un site** → noter le jeton du script.
6. R2 → créer le bucket `sal-sauvegardes` et une clé d'API R2 (lecture/écriture sur ce bucket).

## 2. Serveur WordPress (cms.saintamandlongpre.fr)

1. Cloudflare Zero Trust → Réseaux → **Tunnels** → créer le tunnel `sal-cms`, type cloudflared.
   Copier le jeton. Ajouter un nom d'hôte public : `cms.saintamandlongpre.fr` → `http://wordpress:80`.
2. Sur le serveur :

   ```sh
   git clone https://github.com/josephpage/saint-amand-longpre.git && cd saint-amand-longpre/apps/cms
   cp .env.prod.example .env.prod && chmod 600 .env.prod
   # renseigner .env.prod (openssl rand -base64 48 pour chaque secret)
   docker compose -f compose.prod.yaml --env-file .env.prod up -d
   docker compose -f compose.prod.yaml --env-file .env.prod run --rm wpcli sh /scripts/setup.sh
   ```

3. Zero Trust → Accès → **Applications** → application auto-hébergée
   `cms.saintamandlongpre.fr`, chemins `/wp-admin/*` et `/wp-login.php`, politique « e-mails
   autorisés » (adresses du secrétariat et de l'administrateur). **Ne pas protéger** `/graphql`,
   `/wp-json/*` ni `/wp-content/uploads/*` : le build et les visiteurs en ont besoin.
4. Vérifier :
   - `https://cms.saintamandlongpre.fr/wp-admin/` demande l'authentification Cloudflare Access ;
   - `https://cms.saintamandlongpre.fr/` redirige vers le site public ;
   - la requête GraphQL `{ reglagesMairie { telephone } }` répond.
5. Dans WordPress : Profil → **Mots de passe d'application** → créer « import » puis « prévisualisation ».

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
   domaine** (enregistrements DKIM et DMARC à ajouter dans le DNS Cloudflare).
2. SMTP & API → créer une **clé API**.

## 5. Worker Cloudflare (site public)

1. Secrets du Worker (depuis `apps/web`, connecté avec `npx wrangler login`) :

   ```sh
   npx wrangler secret put BREVO_API_KEY --env production
   npx wrangler secret put MAIL_TO --env production              # adresse de la mairie
   npx wrangler secret put TURNSTILE_SECRET --env production
   npx wrangler secret put PREVIEW_SECRET --env production       # même valeur que PREVIEW_SECRET du serveur
   npx wrangler secret put WP_PREVIEW_USER --env production      # secretariat
   npx wrangler secret put WP_PREVIEW_APP_PASSWORD --env production
   ```

2. GitHub → Settings → Environments → créer **production** :
   - secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` ;
   - variables `TURNSTILE_SITE_KEY`, `CF_BEACON_TOKEN`.
3. Settings → Secrets and variables → Actions → Variables : créer `DEPLOY_ENABLED` = `true`
   (tant qu'elle est absente, le workflow de déploiement ne s'exécute pas).
   Puis Actions → **Déploiement** → « Run workflow ». Le premier déploiement crée le Worker et attache
   les domaines `www.saintamandlongpre.fr` et `saintamandlongpre.fr` (déclarés dans
   `wrangler.jsonc`) avec certificats HTTPS.
4. Jeton GitHub pour WordPress : fine-grained token limité au dépôt, permission
   « Contents : Read and write », à placer dans `GITHUB_TOKEN` du fichier `.env.prod`, puis
   `docker compose -f compose.prod.yaml --env-file .env.prod up -d`.

## 6. Vérifications avant d'annoncer le site

- [ ] `https://www.saintamandlongpre.fr` s'affiche, cadenas HTTPS valide ; `http://` et le domaine
      nu redirigent (Cloudflare → SSL/TLS → « Toujours utiliser HTTPS »).
- [ ] Anciennes adresses : `/fr/information/3512/etat-civil` → `/demarches/etat-civil/` (301).
- [ ] Formulaire de contact : un message arrive dans la boîte de la mairie, « Répondre » écrit à
      l'expéditeur.
- [ ] Signalement avec photo : la photo est jointe.
- [ ] Publier une actualité de test dans WordPress : elle apparaît sur le site en moins de 5 minutes
      (onglet Actions de GitHub pour suivre), puis la supprimer.
- [ ] Bouton « Prévisualiser » sur un brouillon : l'aperçu s'ouvre sur le site.
- [ ] Recherche : « passeport » renvoie la page Passeport.
- [ ] Search Console : ajouter le domaine, envoyer `https://www.saintamandlongpre.fr/sitemap-index.xml`.
- [ ] Renseigner l'hébergeur dans `apps/web/src/site.config.ts` (mentions légales).
- [ ] Planifier l'audit RGAA, puis mettre à jour la déclaration d'accessibilité.
- [ ] Prévenir le prestataire actuel (Réseau des Communes) de la fin du contrat après la bascule.

## Retour arrière

Tant que l'ancien site existe, il suffit de rétablir chez le registrar les anciens serveurs DNS (ou,
dans Cloudflare, de supprimer les domaines personnalisés du Worker et de recréer les enregistrements
d'origine). Le WordPress et les sauvegardes ne sont pas affectés.

## Exploitation courante

- **Sauvegardes** : chaque nuit à 3 h 30 vers R2, 30 jours de rétention, chiffrées (GPG). Tester une
  restauration une fois par trimestre :
  `docker run --rm -v ./restauration:/out offen/docker-volume-backup:v2.49.1 …` (voir la
  documentation d'offen/docker-volume-backup) puis réimporter `sauvegarde.sql`.
- **Mises à jour** : WordPress applique seul les versions mineures. Pour une version majeure ou une
  extension : changer la version dans `compose.prod.yaml` / `scripts/setup.sh`, puis `up -d` et
  relancer `setup.sh` (idempotent).
- **Reconstruction manuelle** du site : Actions → Déploiement → « Run workflow ».
- **Journaux du Worker** : Cloudflare → Workers → saint-amand-longpre → Journaux.
