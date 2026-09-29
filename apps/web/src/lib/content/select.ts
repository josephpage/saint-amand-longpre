import type { Alert, DirectoryEntry, DirectoryKind, Elected, Event, News, Page } from './types.ts';

const byOrderThenTitle = (a: Page, b: Page) =>
  a.order - b.order || a.title.localeCompare(b.title, 'fr');

/** Évènements dont la date de fin (ou de début) n'est pas passée, du plus proche au plus lointain. */
export function upcomingEvents(events: Event[], today: string): Event[] {
  return events
    .filter((e) => (e.end ?? e.start).slice(0, 10) >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function pastEvents(events: Event[], today: string): Event[] {
  return events
    .filter((e) => (e.end ?? e.start).slice(0, 10) < today)
    .sort((a, b) => b.start.localeCompare(a.start));
}

/** Alertes à afficher aujourd'hui, les plus graves d'abord. */
export function activeAlerts(alerts: Alert[], today: string): Alert[] {
  const weight = { urgence: 0, vigilance: 1, info: 2 } as const;
  return alerts.filter((a) => a.expires >= today).sort((a, b) => weight[a.level] - weight[b.level]);
}

export function latestNews(news: News[], count: number): News[] {
  return [...news].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
}

function findPage(pages: Page[], path: string): Page | undefined {
  return pages.find((p) => p.path === path);
}

export function childrenOf(pages: Page[], path: string): Page[] {
  return pages.filter((p) => p.parentPath === path).sort(byOrderThenTitle);
}

export interface Crumb {
  label: string;
  href: string;
}

/**
 * Fil d'Ariane d'un chemin : chaque niveau intermédiaire prend le titre de la
 * page correspondante, ou le libellé fourni pour les rubriques.
 */
export function breadcrumb(
  pages: Page[],
  path: string,
  labels: Record<string, string> = {},
): Crumb[] {
  const parts = path.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Accueil', href: '/' }];
  for (let i = 1; i <= parts.length; i += 1) {
    const href = `/${parts.slice(0, i).join('/')}/`;
    const label = labels[href] ?? findPage(pages, href)?.title;
    if (label) crumbs.push({ label, href });
  }
  return crumbs;
}

export function directoryOf(entries: DirectoryEntry[], kinds: DirectoryKind[]): DirectoryEntry[] {
  return entries
    .filter((e) => kinds.includes(e.kind))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

/** Regroupe des fiches par catégorie (« Autres » pour les fiches sans catégorie). */
export function groupByCategory<T extends { category?: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.category ?? 'Autres';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === 'Autres' ? 1 : b === 'Autres' ? -1 : a.localeCompare(b, 'fr'),
  );
}

/** Maire, puis adjoints dans l'ordre, puis conseillers. */
export function sortElected(list: Elected[]): Elected[] {
  const rank = { maire: 0, adjoint: 1, conseiller: 2 } as const;
  return [...list].sort(
    (a, b) =>
      rank[a.role] - rank[b.role] || a.order - b.order || a.name.localeCompare(b.name, 'fr'),
  );
}
