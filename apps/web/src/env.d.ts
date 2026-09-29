/** Environnement du Worker Cloudflare (liaisons déclarées dans wrangler.jsonc). */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
