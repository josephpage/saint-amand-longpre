import type { APIRoute } from 'astro';
import { formDeps } from '~/lib/forms/deps.ts';
import { handleContact } from '~/lib/forms/handler.ts';

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleContact(request, formDeps());
