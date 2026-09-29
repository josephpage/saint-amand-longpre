# Instructions pour les agents IA

Site officiel de la commune de Saint-Amand-Longpré (Loir-et-Cher, environ 1 200 habitants). Le site
est un Astro statique servi par Cloudflare Workers, et ses contenus sont gérés dans un WordPress
headless. Ce fichier donne à un agent ce qu'il lui faut pour contribuer au code ou aux contenus sans
tout relire. Pour le détail, lire [README.md](README.md) et [docs/](docs/).

## Règles essentielles

- **Tout en français** : interface, textes, commentaires de code, messages de commit, documentation.
  Accents obligatoires et typographie française (espace avant « : ; ? ! », guillemets « »). Seuls
  les identifiants de code restent en anglais.
- **Public** : tous les habitants, y compris les personnes âgées et les personnes handicapées. Le
  site doit être accessible (RGAA / WCAG 2.1 AA), lisible sur téléphone et rédigé simplement.
- **Aucun accès à la production** : ne pas déployer, ne pas modifier Cloudflare, le DNS ni le
  serveur, ne pas créer la variable `DEPLOY_ENABLED`. La mise en ligne suit
  [docs/runbook.md](docs/runbook.md) et c'est un humain qui l'exécute.
- **Git** : commits signés (ne jamais désactiver la signature ni utiliser `--no-verify`). Messages
  en français, une phrase courte à l'infinitif ou au nominatif (« Redirections complètes des
  anciennes adresses »). Demander avant de pousser, sauf autorisation explicite.
- **Blason** (`apps/web/public/images/blason-saint-amand-longpre.svg`) : sous licence CC BY-SA 3.0,
  utilisé **sans modification**. Ne pas éditer ni recolorer ce fichier, ne pas retirer le crédit
  des mentions légales.
- **Données personnelles** : ne jamais ajouter de données de particuliers (petites annonces, adresses
  ou téléphones privés). Les formulaires ne stockent rien, et cela doit rester ainsi.
- Avant de rendre la main : `pnpm check`, puis `pnpm test:e2e` si l'affichage ou le routage a
  changé.

## Démarrer

Prérequis : Node 24 (`.nvmrc`), pnpm 10 et Docker (seulement pour WordPress).

```sh
pnpm install
pnpm dev          # http://localhost:4390 avec le jeu de données de test, sans WordPress
```

| Commande          | Rôle                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `pnpm check`      | ESLint, Prettier, TypeScript, Knip, Vitest : à passer avant chaque commit |
| `pnpm format`     | Formate tout avec Prettier                                                |
| `pnpm test:e2e`   | Playwright : build puis runtime Workers local, ordinateur et mobile, axe  |
| `pnpm build`      | Build (jeu de données, ou WordPress selon `CLOUDFLARE_ENV`)               |
| `pnpm cms:up`     | WordPress local sur http://localhost:8080 (admin / admin)                 |
| `pnpm cms:setup`  | Extensions et identifiants locaux (`apps/web/.dev.vars`)                  |
| `pnpm cms:import` | Importe le jeu de données dans WordPress (`--source scrape` pour tout)    |

Les tests E2E utilisent le port 4390 : arrêter `pnpm dev` avant de les lancer. Ne pas tuer un
serveur de développement lancé par l'utilisateur sans le prévenir.

La CI (`.github/workflows/ci.yml`) lance `pnpm lint`, `pnpm typecheck`, `astro check`, `pnpm knip`,
`pnpm test` et `pnpm test:e2e`. Tout doit être vert.

## Organisation du dépôt

| Dossier                          | Contenu                                                                   |
| -------------------------------- | ------------------------------------------------------------------------- |
| `apps/web/src/pages`             | Routes Astro. `[...path].astro` affiche toutes les pages WordPress        |
| `apps/web/src/components`        | Composants Astro (rendu statique, sans JavaScript)                        |
| `apps/web/src/islands`           | Îlots React : formulaires de contact et de signalement, recherche         |
| `apps/web/src/lib/content`       | `getContent()` : charge le contenu depuis `fixtures.ts` ou `wordpress/`   |
| `apps/web/src/lib`               | Navigation, SEO (JSON-LD), sitemap, horaires, formulaires, redirections   |
| `apps/web/src/site.config.ts`    | Mentions légales, blason, données officielles de la commune               |
| `apps/web/src/styles/global.css` | Jetons de design Tailwind 4 (`@theme`)                                    |
| `apps/web/integrations`          | Post-build : Pagefind, `_redirects`, contrôle du sitemap                  |
| `apps/web/tests/e2e`             | Tests Playwright                                                          |
| `apps/cms/wordpress/mu-plugins`  | Modèle de contenu WordPress en code (types, champs ACF, réglages)         |
| `packages/model`                 | Schémas zod du format d'échange, `slugify`, table des anciennes rubriques |
| `tools/scraper`                  | Reprise de l'ancien site, génération de `data/fixtures`                   |
| `tools/importer`                 | Import d'un snapshot dans WordPress (API REST, idempotent)                |
| `data/fixtures`                  | Jeu de données de test versionné (généré, voir plus bas)                  |

Architecture complète : [docs/architecture.md](docs/architecture.md).

## Contribuer au code

### Conventions

- TypeScript strict, imports de types avec `import type`. Extensions `.ts` explicites dans les
  imports. Alias `~/` pour `apps/web/src`.
- Préférer un composant Astro sans JavaScript. N'ajouter un îlot React que pour une vraie
  interaction ; le menu et le statut d'ouverture sont en JavaScript natif.
- Styles : classes Tailwind et jetons de `global.css` (`terracotta`, `nuit`, `bocage`, `sauge`,
  `lin`, `pierre`, `encre`…). Ne pas ajouter de couleurs en dur. Polices : Source Serif 4 (titres),
  Atkinson Hyperlegible Next (texte) ; Allura est réservée à la devise.
- Accessibilité : HTML sémantique, un seul `h1`, contrastes AA, focus visible, libellés de
  formulaires, texte alternatif. Les tests E2E lancent axe sur chaque page type.
- Tests : Vitest à côté du code (`*.test.ts`) pour toute logique (dates, horaires, mappers,
  redirections…). Playwright (`tests/e2e/*.spec.ts`) pour les parcours. Sélecteurs par rôle et
  libellé accessible, avec `exact: true` si le texte peut être ambigu.
- Knip échoue sur tout export, fichier ou dépendance inutilisé : ne pas exporter « au cas où ».
- Commentaires en français, rares, qui expliquent le pourquoi.

### Recettes

**Ajouter une page de code** (hors WordPress, par exemple `/mairie/budget/`) : créer le fichier dans
`src/pages/`. Si l'adresse est aussi celle d'une page WordPress, la déclarer dans `VIRTUAL_PAGES`
(`src/lib/navigation.ts`) pour que `[...path].astro` ne la génère pas en double. Sinon, l'ajouter à
`STATIC_PAGES` (`src/lib/sitemap.ts`), ou à `NOT_IN_SITEMAP` si elle ne doit pas être indexée :
le build échoue si une page publiée est absente du plan du site. Utiliser `BaseLayout` et `PageHeader`, qui produisent le fil d'Ariane et le JSON-LD `WebPage`.

**Ajouter un champ ou un type de contenu** : la chaîne complète doit rester cohérente.

1. WordPress : `apps/cms/wordpress/mu-plugins/sal-content-model.php` (type, champ ACF, exposition
   GraphQL).
2. Format d'échange : `packages/model/src/snapshot.ts` (schéma zod).
3. Site : `src/lib/content/types.ts`, puis `wordpress/queries.ts` et `wordpress/mappers.ts` (avec
   un test dans `mappers.test.ts`), puis `fixtures.ts`.
4. Import : `tools/importer/src/import.ts` ; si l'ancien site contient l'information,
   `tools/scraper/src/extract.ts`.
5. Vérifier avec WordPress local : `pnpm cms:reset && pnpm cms:import`, puis
   `CLOUDFLARE_ENV=wordpress-local pnpm build`.

**Formulaires** (`/api/contact`, `/api/signalement`) : schémas zod partagés navigateur/serveur
(`src/lib/forms/schemas.ts`), logique testable dans `handler.ts` avec ses dépendances injectées
(`deps.ts`). Turnstile, champ piège et limite d'envois ne doivent pas être retirés. En local, les
e-mails sont simulés.

**SEO et assistants IA** : JSON-LD dans `src/lib/seo.ts`, questions fréquentes générées dans
`src/lib/faq.ts`, `llms.txt` dans `src/lib/llms.ts`. Les faits (horaires, téléphone, adresse)
viennent toujours des réglages WordPress, jamais d'un texte en dur.

**Anciennes adresses** : les redirections viennent du contenu (`redirects`) et des règles par
rubrique (`packages/model/src/legacy.ts`). `src/lib/redirects.ts` respecte les limites de
Cloudflare (2 000 règles statiques, 100 dynamiques) et échoue au-delà. Ne pas éditer `_redirects` à
la main. Après une modification : `pnpm check:redirects --base http://localhost:4390` sur un
`pnpm preview`.

**Identifiants d'URL** : toujours passer par `slugify` (`@sal/model`). WordPress refuse les
identifiants purement numériques : « 2025 » devient « annee-2025 ».

### Environnements

`CLOUDFLARE_ENV` choisit la source de contenu (voir `apps/web/wrangler.jsonc`) : vide pour le jeu de
données, `wordpress-local` ou `production`. Les secrets locaux sont dans `apps/web/.dev.vars`
(non versionné, écrit par `pnpm cms:setup`). Ne jamais versionner de secret.

## Contribuer aux contenus

En production, **les contenus vivent dans WordPress** (https://cms.saintamandlongpre.fr), pas dans
ce dépôt. Chaque publication reconstruit le site en 3 à 5 minutes.

- **`data/fixtures` n'est pas le contenu du site.** C'est un jeu de test généré par
  `pnpm fixtures` à partir du scraping. Le modifier ne change rien en production, et une
  modification à la main est écrasée à la prochaine génération. Ne l'éditer que pour un besoin de
  test, par exemple un cas limite couvert par un test E2E.
- **Pour modifier un texte du site**, par ordre de préférence :
  1. rédiger le contenu (Markdown ou HTML simple) et le remettre à l'utilisateur, qui le transmet au
     secrétariat ;
  2. si l'utilisateur fournit un mot de passe d'application WordPress, créer ou modifier le contenu
     par l'API REST (`/wp-json/wp/v2/…`, authentification Basic, comme dans
     `tools/importer/src/wp.ts`) **en brouillon uniquement**. Un humain relit avec « Prévisualiser »
     puis publie. Ne jamais publier ni supprimer directement.
- Les textes fixes de l'interface (menus, pied de page, pages légales) sont dans le code
  (`src/pages`, `src/components`, `src/site.config.ts`) : les modifier comme du code.
- Coordonnées, horaires, population et photo d'accueil : uniquement dans Réglages → Mairie de
  WordPress. Ne jamais les recopier en dur dans un texte.

### Règles de rédaction

Elles reprennent le [guide de rédaction du secrétariat](docs/guide-redaction.md) :

- un titre avec les mots des habitants (« Inscription à l'école maternelle ») ;
- en première phrase, la réponse directe : qui, quoi, quand, où, combien ;
- des phrases courtes, un intertitre par idée, des listes à puces pour les pièces à fournir ;
- dates, horaires, lieux et tarifs écrits dans le texte, pas seulement dans un PDF ou une image ;
- un extrait d'une ou deux phrases, qui sert de description dans les moteurs de recherche ;
- mettre à jour la page existante plutôt que publier un doublon ;
- pour les démarches, renvoyer vers la fiche officielle de service-public.fr plutôt que recopier
  une réglementation qui change ;
- pas de MAJUSCULES, pas de couleurs, pas de texte dans les images.

### Images

- Toujours un texte alternatif qui décrit l'image (vide seulement si elle est décorative).
- Respect du droit à l'image : pas de personne reconnaissable sans accord, jamais d'enfant
  reconnaissable sans l'accord des parents. Crédit du photographe dans la légende.
- Aucune image générée par IA présentée comme une photo de la commune.
- Photos manquantes ou trop petites : [docs/photos-a-prendre.md](docs/photos-a-prendre.md).

## Documentation

| Document                                             | Pour                                                    |
| ---------------------------------------------------- | ------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)         | Fonctionnement d'ensemble, modèle de contenu, SEO       |
| [docs/runbook.md](docs/runbook.md)                   | Mise en ligne et exploitation (exécutées par un humain) |
| [docs/reprise-contenu.md](docs/reprise-contenu.md)   | Scraper, jeu de données, import, redirections           |
| [docs/guide-redaction.md](docs/guide-redaction.md)   | Guide du secrétariat dans WordPress                     |
| [docs/photos-a-prendre.md](docs/photos-a-prendre.md) | Reportage photo à réaliser                              |

Mettre à jour la documentation concernée dans le même commit que le code.
