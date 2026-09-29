import type { PreviewItem, SiteContent } from '../types.ts';
import { createClient, type GraphqlClientOptions } from './client.ts';
import * as m from './mappers.ts';
import * as q from './queries.ts';

const notNull = <T>(v: T | null): v is T => v !== null;

/** Charge tout le contenu publié depuis WordPress (au moment du build). */
export async function loadWordPress(options: GraphqlClientOptions): Promise<SiteContent> {
  const client = createClient(options);
  const [settings, pages, posts, events, meetings, elected, rooms, directory, alerts] =
    await Promise.all([
      client.query<{ reglagesMairie: m.WpSettings; redirections: { de: string; vers: string }[] }>(
        q.SETTINGS_QUERY,
      ),
      client.all<m.WpPage>(q.PAGES_QUERY, 'pages'),
      client.all<m.WpPost>(q.POSTS_QUERY, 'posts'),
      client.all<m.WpEvent>(q.EVENTS_QUERY, 'evenements'),
      client.all<m.WpMeeting>(q.MEETINGS_QUERY, 'seances'),
      client.all<m.WpElected>(q.ELECTED_QUERY, 'elus'),
      client.all<m.WpRoom>(q.ROOMS_QUERY, 'salles'),
      client.all<m.WpDirectoryEntry>(q.DIRECTORY_QUERY, 'fichesAnnuaire'),
      client.all<m.WpAlert>(q.ALERTS_QUERY, 'alertes'),
    ]);
  return {
    settings: m.mapSettings(settings.reglagesMairie),
    pages: pages.map(m.mapPage).filter(notNull),
    news: posts.map(m.mapPost).sort((a, b) => b.date.localeCompare(a.date)),
    events: events.map(m.mapEvent).filter(notNull),
    meetings: meetings
      .map(m.mapMeeting)
      .filter(notNull)
      .sort((a, b) => b.date.localeCompare(a.date)),
    elected: elected.map(m.mapElected),
    rooms: rooms.map(m.mapRoom),
    directory: directory.map(m.mapDirectoryEntry).filter(notNull),
    alerts: alerts.map(m.mapAlert).filter(notNull),
    redirects: m.mapRedirects(settings.redirections),
  };
}

type PreviewNode =
  | ({ __typename: 'Page' } & m.WpPage)
  | ({ __typename: 'Post' } & m.WpPost)
  | ({ __typename: 'Evenement' } & m.WpEvent)
  | ({ __typename: 'Salle' } & m.WpRoom)
  | { __typename: string };

/** Charge un contenu non publié (ou sa dernière révision) pour la prévisualisation. */
export async function loadPreview(
  options: GraphqlClientOptions,
  id: number,
): Promise<PreviewItem | null> {
  const client = createClient(options);
  let node: PreviewNode | null = null;
  for (const asPreview of [true, false]) {
    const data = await client.query<{ contentNode: PreviewNode | null }>(q.PREVIEW_QUERY, {
      id: String(id),
      asPreview,
    });
    node = data.contentNode;
    if (node) break;
  }
  if (!node) return null;
  switch (node.__typename) {
    case 'Page': {
      const page = node as m.WpPage;
      const item = m.mapPage({ ...page, uri: page.uri?.startsWith('/') ? page.uri : '/apercu/' });
      return item ? { kind: 'page', item } : null;
    }
    case 'Post':
      return { kind: 'news', item: m.mapPost(node as m.WpPost) };
    case 'Evenement': {
      const item = m.mapEvent(node as m.WpEvent);
      return item ? { kind: 'event', item } : null;
    }
    case 'Salle':
      return { kind: 'room', item: m.mapRoom(node as m.WpRoom) };
    default:
      return null;
  }
}
