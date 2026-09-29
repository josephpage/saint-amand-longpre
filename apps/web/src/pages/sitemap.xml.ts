import type { APIRoute } from 'astro';
import { getContent } from '~/lib/content/index.ts';
import { buildSitemapXml, sitemapEntries } from '~/lib/sitemap.ts';

export const GET: APIRoute = async ({ site }) => {
  const content = await getContent();
  return new Response(buildSitemapXml(sitemapEntries(content), site!.toString()), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
