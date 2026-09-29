# Site de la mairie de Saint-Amand-Longpré

Site officiel de la commune de Saint-Amand-Longpré (Loir-et-Cher) : Astro statique servi par
Cloudflare Workers, contenus gérés dans un WordPress headless.

| Dossier          | Rôle                                                                          |
| ---------------- | ----------------------------------------------------------------------------- |
| `apps/web`       | Site public (Astro 7, React 19, Tailwind 4), routes serveur `/preview` `/api` |
| `apps/cms`       | WordPress headless sous Docker Compose (développement et production)          |
| `tools/scraper`  | Reprise du contenu de l'ancien site et construction du jeu de données de test |
| `tools/importer` | Import d'un snapshot dans WordPress (API REST, idempotent)                    |
| `packages/model` | Format d'échange du contenu (schémas zod partagés)                            |
| `data/fixtures`  | Jeu de données de test versionné (extrait du scraping)                        |
| `docs`           | Architecture, mise en ligne, guide de rédaction                               |

## Démarrage rapide

Prérequis : Node 24 (ou plus récent), pnpm 10, Docker.

```sh
pnpm install
pnpm dev                 # site sur http://localhost:4390 avec le jeu de données de test
```

Le site fonctionne sans WordPress : par défaut il lit `data/fixtures`.

### Avec un WordPress local

```sh
pnpm cms:up              # WordPress sur http://localhost:8080 (admin / admin)
pnpm cms:setup           # installe les extensions et écrit les identifiants locaux
pnpm cms:import          # importe le jeu de données de test (ou --source scrape)
CLOUDFLARE_ENV=wordpress-local pnpm dev
```

`pnpm cms:setup` crée un mot de passe d'application et l'écrit dans `apps/web/.dev.vars`, ce qui
permet de tester la prévisualisation des brouillons (bouton « Prévisualiser » de WordPress).

`pnpm cms:reset` repart d'un WordPress vide.

## Commandes

| Commande                          | Effet                                                      |
| --------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                        | Serveur de développement (runtime Cloudflare local)        |
| `pnpm build`                      | Build du site (jeu de données, ou WordPress selon l'env.)  |
| `pnpm preview`                    | Sert le build dans le runtime Workers local                |
| `pnpm lint` / `pnpm format`       | ESLint et Prettier                                         |
| `pnpm typecheck`                  | TypeScript sur tous les paquets                            |
| `pnpm knip`                       | Code, exports et dépendances inutilisés                    |
| `pnpm test`                       | Tests unitaires Vitest (tous les paquets)                  |
| `pnpm test:e2e`                   | Tests Playwright (build + runtime Workers, ordi et mobile) |
| `pnpm check`                      | Lint, types, Knip et tests unitaires                       |
| `pnpm scrape`                     | Aspire l'ancien site dans `data/scrape` (cache disque)     |
| `pnpm fixtures`                   | Reconstruit `data/fixtures` à partir du scraping           |
| `pnpm cms:import --source scrape` | Importe tout le contenu scrapé dans WordPress              |

## Environnements

La source du contenu et les variables du Worker dépendent de `CLOUDFLARE_ENV` (voir
`apps/web/wrangler.jsonc`) :

| `CLOUDFLARE_ENV`  | Contenu                  | E-mails | Usage                          |
| ----------------- | ------------------------ | ------- | ------------------------------ |
| _(vide)_          | `data/fixtures`          | simulés | développement, CI, tests E2E   |
| `wordpress-local` | WordPress local          | simulés | tester l'intégration WordPress |
| `production`      | cms.saintamandlongpre.fr | Brevo   | déploiement                    |

## Documentation

- [Architecture](docs/architecture.md)
- [Mise en ligne (runbook)](docs/runbook.md)
- [Reprise du contenu de l'ancien site](docs/reprise-contenu.md)
- [Guide de rédaction pour le secrétariat](docs/guide-redaction.md)
- [Photos à prendre pour illustrer le site](docs/photos-a-prendre.md)
- [Instructions pour les agents IA](AGENTS.md)
