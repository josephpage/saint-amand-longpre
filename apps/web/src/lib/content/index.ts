import {
  CONTENT_SOURCE,
  WP_GRAPHQL_URL,
  WP_PREVIEW_APP_PASSWORD,
  WP_PREVIEW_USER,
} from 'astro:env/server';
import { loadFixtures } from './fixtures.ts';
import type { PreviewItem, SiteContent } from './types.ts';
import { loadPreview, loadWordPress } from './wordpress/index.ts';

let cache: Promise<SiteContent> | undefined;

/**
 * Contenu complet du site, chargé une seule fois par build depuis la source
 * configurée (CONTENT_SOURCE = fixtures | wordpress).
 */
export function getContent(): Promise<SiteContent> {
  cache ??=
    CONTENT_SOURCE === 'wordpress'
      ? loadWordPress({ endpoint: requireEndpoint() })
      : Promise.resolve(loadFixtures());
  return cache;
}

function requireEndpoint(): string {
  if (!WP_GRAPHQL_URL)
    throw new Error('WP_GRAPHQL_URL est requis quand CONTENT_SOURCE vaut « wordpress ».');
  return WP_GRAPHQL_URL;
}

/** Contenu non publié pour la route de prévisualisation (WordPress uniquement). */
export async function getPreview(id: number): Promise<PreviewItem | null> {
  if (!WP_PREVIEW_USER || !WP_PREVIEW_APP_PASSWORD) {
    throw new Error('Identifiants de prévisualisation WordPress manquants.');
  }
  return loadPreview(
    {
      endpoint: requireEndpoint(),
      auth: { user: WP_PREVIEW_USER, password: WP_PREVIEW_APP_PASSWORD },
    },
    id,
  );
}

export * from './select.ts';
export type * from './types.ts';
