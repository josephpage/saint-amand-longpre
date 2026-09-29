import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * Copie les médias du jeu de données de test dans public/_fixtures pour
 * qu'ils soient servis en développement et inclus dans un build « fixtures ».
 * Ne fait rien quand un environnement Cloudflare nommé est sélectionné
 * (CLOUDFLARE_ENV), car le contenu vient alors de WordPress.
 */
export function fixtureMedia(): AstroIntegration {
  return {
    name: 'sal:fixture-media',
    hooks: {
      'astro:config:setup': async ({ config, logger }) => {
        const target = new URL('_fixtures/', config.publicDir);
        await rm(target, { recursive: true, force: true });
        // Les environnements Cloudflare nommés (production, wordpress-local) lisent WordPress.
        if (process.env.CLOUDFLARE_ENV) return;
        const source = fileURLToPath(new URL('../../../data/fixtures/media/', import.meta.url));
        await cp(source, target, { recursive: true });
        logger.info('Médias du jeu de données copiés dans public/_fixtures');
      },
    },
  };
}
