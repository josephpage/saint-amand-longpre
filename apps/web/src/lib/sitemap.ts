import { directoryOf } from './content/select.ts';
import type { SiteContent } from './content/types.ts';
import { buildNavigation, VIRTUAL_PAGES } from './navigation.ts';

export interface SitemapEntry {
  path: string;
  lastmod?: string;
}

/** Pages sans contenu propre à indexer (recherche, aperçus, pages de pagination). */
export const NOT_IN_SITEMAP = [/^\/recherche\//, /^\/preview\//, /^\/404/, /^\/actualites\/\d+\/$/];

const STATIC_PAGES = [
  '/contact/',
  '/signaler-un-probleme/',
  '/plan-du-site/',
  '/mentions-legales/',
  '/donnees-personnelles/',
  '/accessibilite/',
];

const latest = (dates: (string | undefined)[]) =>
  dates
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

/** Toutes les pages indexables du site, avec leur date de dernière modification. */
export function sitemapEntries(content: SiteContent): SitemapEntry[] {
  const newsDate = latest(content.news.map((n) => n.modified ?? n.date));
  const eventsDate = latest(content.events.map((e) => e.modified));
  const pagesDate = latest(content.pages.map((p) => p.modified));
  const entries = new Map<string, string | undefined>();
  const add = (path: string, lastmod?: string) => {
    if (!entries.has(path)) entries.set(path, lastmod);
  };

  add('/', latest([newsDate, eventsDate, pagesDate]));
  for (const section of buildNavigation(content.pages)) {
    if (section.key !== 'agenda') add(section.href, pagesDate);
  }
  add('/actualites/', newsDate);
  add('/agenda/', eventsDate);
  for (const v of Object.values(VIRTUAL_PAGES)) add(v.href, pagesDate);
  for (const page of content.pages) add(page.path, page.modified);
  for (const news of content.news) add(`/actualites/${news.slug}/`, news.modified ?? news.date);
  for (const event of content.events) add(`/agenda/${event.slug}/`, event.modified);
  for (const room of content.rooms) add(`/demarches/louer-une-salle/${room.slug}/`, room.modified);
  for (const entry of directoryOf(content.directory, ['association'])) {
    add(`/vivre-ici/associations/${entry.slug}/`);
  }
  for (const path of STATIC_PAGES) add(path);

  return [...entries.entries()]
    .filter(([path]) => !NOT_IN_SITEMAP.some((re) => re.test(path)))
    .map(([path, lastmod]) => ({ path, ...(lastmod ? { lastmod } : {}) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildSitemapXml(entries: SitemapEntry[], site: string): string {
  const urls = entries
    .map((e) => {
      const loc = escapeXml(new URL(encodeURI(e.path), site).toString());
      return `  <url><loc>${loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
