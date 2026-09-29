import type { APIRoute } from 'astro';
import { getContent } from '~/lib/content/index.ts';
import { buildRedirectsFile } from '~/lib/redirects.ts';

/** Renommé en _redirects après le build (voir integrations/post-build.ts). */
export const GET: APIRoute = async () => {
  const content = await getContent();
  return new Response(buildRedirectsFile(content.redirects), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
