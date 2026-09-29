import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import { fixtureMedia } from './integrations/fixture-media.ts';
import { postBuild } from './integrations/post-build.ts';

const site = process.env.SITE_URL ?? 'https://www.saintamandlongpre.fr';
const wpGraphqlUrl = process.env.WP_GRAPHQL_URL ?? 'https://cms.saintamandlongpre.fr/graphql';
// En local, les médias WordPress sont servis par http://localhost:8080.

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'ignore',
  // Le port 4321 par défaut est souvent occupé ; 4390 est réservé au site de la mairie.
  server: { port: 4390 },
  adapter: cloudflare({
    // Configuration de build (format Worker) ; le projet Pages est décrit dans wrangler.jsonc.
    configPath: './wrangler.astro.jsonc',
    // Le pré-rendu tourne dans Node : Sharp optimise les images au build.
    prerenderEnvironment: 'node',
    imageService: { build: 'compile', runtime: 'passthrough' },
  }),
  integrations: [react(), fixtureMedia(), postBuild()],
  image: {
    domains: [new URL(wpGraphqlUrl).hostname, 'localhost'],
  },
  vite: {
    plugins: [tailwindcss()],
  },
  env: {
    schema: {
      CONTENT_SOURCE: envField.enum({
        context: 'server',
        access: 'public',
        values: ['fixtures', 'wordpress'],
        default: 'fixtures',
      }),
      WP_GRAPHQL_URL: envField.string({ context: 'server', access: 'public', optional: true }),
      WP_PREVIEW_USER: envField.string({ context: 'server', access: 'secret', optional: true }),
      WP_PREVIEW_APP_PASSWORD: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      PREVIEW_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET: envField.string({ context: 'server', access: 'secret', optional: true }),
      BREVO_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      MAIL_TO: envField.string({ context: 'server', access: 'secret', optional: true }),
      MAIL_FROM: envField.string({
        context: 'server',
        access: 'public',
        default: 'site@saintamandlongpre.fr',
      }),
      MAIL_DRY_RUN: envField.boolean({ context: 'server', access: 'public', default: false }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        // Clé de test Cloudflare : le widget réussit toujours (développement et tests).
        default: '1x00000000000000000000AA',
      }),
      PUBLIC_CF_BEACON_TOKEN: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
    },
  },
});
