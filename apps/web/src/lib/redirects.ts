import { LEGACY_FALLBACKS } from '@sal/model';
import type { Redirect } from './content/types.ts';

/** Limites du fichier _redirects de Cloudflare. */
const MAX_STATIC_REDIRECTS = 2000;
const MAX_DYNAMIC_REDIRECTS = 100;

const escapePath = (p: string) => encodeURI(p).replace(/%25([0-9A-F]{2})/gi, '%$1');

/**
 * Génère le fichier _redirects de Cloudflare pour les anciennes adresses :
 *  1. une redirection exacte par ancienne page connue ;
 *  2. la variante avec barre finale, dans la limite de 2 000 règles statiques ;
 *  3. des règles génériques par rubrique (/fr/actualite/* → /actualites/…) pour
 *     tout le reste : pagination, filtres, liens anciens jamais explorés.
 * Cloudflare applique la première règle qui correspond : les règles exactes
 * passent donc avant les règles génériques.
 */
export function buildRedirectsFile(redirects: Redirect[]): string {
  const valid = redirects.filter(
    ({ from, to }) => from.startsWith('/') && from !== '/' && from !== to,
  );
  const exact = new Set(valid.map(({ from }) => escapePath(from)));
  if (exact.size > MAX_STATIC_REDIRECTS) {
    throw new Error(
      `${exact.size} redirections exactes : la limite de Cloudflare est ${MAX_STATIC_REDIRECTS}.`,
    );
  }

  const rules = new Map<string, string>();
  const add = (from: string, to: string) => {
    const key = escapePath(from);
    if (!rules.has(key) && rules.size < MAX_STATIC_REDIRECTS) rules.set(key, to);
  };
  for (const { from, to } of valid) add(from, to);
  // Rubriques sans barre finale (« /fr », « /mobile ») : règle exacte.
  for (const [prefix, to] of LEGACY_FALLBACKS) add(prefix.slice(0, -1), to);
  // Variantes avec ou sans barre finale, tant qu'il reste de la place.
  for (const { from, to } of valid) add(from.endsWith('/') ? from.slice(0, -1) : `${from}/`, to);

  const fallbacks = LEGACY_FALLBACKS.map(([prefix, to]) => `${prefix}* ${to} 301`);
  if (fallbacks.length > MAX_DYNAMIC_REDIRECTS) {
    throw new Error(
      `${fallbacks.length} règles génériques : la limite de Cloudflare est ${MAX_DYNAMIC_REDIRECTS}.`,
    );
  }

  return [
    '# Anciennes adresses du site (générées au build, voir src/lib/redirects.ts)',
    ...[...rules.entries()].map(([from, to]) => `${from} ${to} 301`),
    '',
    '# Règles de secours par rubrique (après les règles exactes)',
    ...fallbacks,
    '',
  ].join('\n');
}
