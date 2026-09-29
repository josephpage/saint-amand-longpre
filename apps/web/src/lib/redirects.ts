import type { Redirect } from './content/types.ts';

/** Nombre maximal de redirections statiques accepté par Cloudflare. */
const MAX_STATIC_REDIRECTS = 2000;

const escapePath = (p: string) => encodeURI(p).replace(/%25([0-9A-F]{2})/gi, '%$1');

/**
 * Génère le fichier _redirects de Cloudflare : redirections permanentes des
 * anciennes adresses, avec et sans barre finale.
 */
export function buildRedirectsFile(redirects: Redirect[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const { from, to } of redirects) {
    if (!from.startsWith('/') || from === '/' || from === to) continue;
    const variants = from.endsWith('/') ? [from, from.slice(0, -1)] : [from, `${from}/`];
    for (const source of variants) {
      const key = escapePath(source);
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`${key} ${to} 301`);
    }
  }
  if (lines.length > MAX_STATIC_REDIRECTS) {
    throw new Error(
      `${lines.length} redirections : la limite de Cloudflare est ${MAX_STATIC_REDIRECTS}.`,
    );
  }
  return `# Anciennes adresses du site (générées au build)\n${lines.join('\n')}\n`;
}
