import type { APIRoute } from 'astro';
import { getContent } from '~/lib/content/index.ts';
import { buildIcs } from '~/lib/ics.ts';

export const GET: APIRoute = async ({ site }) => {
  const content = await getContent();
  return new Response(buildIcs(content.events, site!.toString()), {
    headers: { 'content-type': 'text/calendar; charset=utf-8' },
  });
};
