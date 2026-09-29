import * as cheerio from 'cheerio';
import { EXCLUDED_PATHS, HOST, ORIGIN, SEEDS } from './config.ts';
import { fetchHtml, HttpError } from './http.ts';
import { isMediaUrl } from './media.ts';

/** Normalise un lien interne en chemin, ou retourne null s'il faut l'ignorer. */
function toCrawlPath(href: string, base: string): string | null {
  if (
    !href ||
    href.startsWith('javascript:') ||
    href.startsWith('mailto:') ||
    href.startsWith('#')
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.hostname !== HOST && url.hostname !== HOST.replace(/^www\./, '')) return null;
  if (isMediaUrl(url.toString())) return null;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (/\.(jpe?g|png|gif|pdf|docx?|xlsx?|css|js|ico)$/i.test(path)) return null;
  if (EXCLUDED_PATHS.some((re) => re.test(path))) return null;
  if (path !== '/' && !path.startsWith('/fr/')) return null;
  return path;
}

export interface CrawlResult {
  pages: Map<string, string>;
  failed: string[];
}

/** Explore le site en largeur à partir des points d'entrée. */
export async function crawl(
  options: { refresh?: boolean; limit?: number } = {},
): Promise<CrawlResult> {
  const limit = options.limit ?? 2000;
  const queue = [...SEEDS];
  const seen = new Set(queue);
  const pages = new Map<string, string>();
  const failed: string[] = [];

  while (queue.length > 0 && pages.size < limit) {
    const path = queue.shift()!;
    const url = `${ORIGIN}${path}`;
    let html: string;
    try {
      html = await fetchHtml(url, { refresh: options.refresh ?? false });
    } catch (error) {
      failed.push(`${path} (${error instanceof HttpError ? error.status : 'réseau'})`);
      continue;
    }
    pages.set(path, html);
    if (pages.size % 25 === 0) console.log(`  … ${pages.size} pages, ${queue.length} en attente`);

    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const next = toCrawlPath($(el).attr('href')!, url);
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  }
  return { pages, failed };
}
