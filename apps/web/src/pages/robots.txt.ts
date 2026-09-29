import type { APIRoute } from 'astro';

/**
 * Les informations de la commune sont publiques : moteurs de recherche et
 * assistants IA sont explicitement autorisés. Les préférences d'usage par les IA
 * sont indiquées en commentaire (convention Content Signals de Cloudflare) : une
 * directive non standard ferait considérer le fichier comme invalide.
 */
export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      '# Site officiel de la commune de Saint-Amand-Longpré : informations publiques.',
      '# Moteurs de recherche et assistants IA sont les bienvenus.',
      '# Usages autorisés : search=yes, ai-input=yes, ai-train=yes',
      'User-agent: *',
      'Allow: /',
      'Disallow: /preview/',
      'Disallow: /api/',
      '',
      `Sitemap: ${new URL('/sitemap.xml', site).toString()}`,
      '',
    ].join('\n'),
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
