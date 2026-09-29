import type { APIRoute } from 'astro';
import { getContent } from '~/lib/content/index.ts';
import { buildLlmsTxt } from '~/lib/llms.ts';

export const GET: APIRoute = async ({ site }) =>
  new Response(buildLlmsTxt(await getContent(), site!.toString()), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
