import type { APIRoute } from 'astro';
import { getContent } from '~/lib/content/index.ts';
import { todayInParis } from '~/lib/dates.ts';
import { buildFaq } from '~/lib/faq.ts';
import { buildLlmsFullTxt } from '~/lib/llms.ts';

export const GET: APIRoute = async ({ site }) => {
  const content = await getContent();
  const siteUrl = site!.toString();
  const faq = buildFaq({
    settings: content.settings,
    elected: content.elected,
    rooms: content.rooms,
    siteUrl,
  });
  return new Response(buildLlmsFullTxt(content, siteUrl, todayInParis(), faq), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
