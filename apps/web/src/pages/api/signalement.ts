import type { APIRoute } from 'astro';
import { formDeps } from '~/lib/forms/deps.ts';
import { handleReport } from '~/lib/forms/handler.ts';

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleReport(request, formDeps());
