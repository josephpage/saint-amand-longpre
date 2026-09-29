import {
  snapshotSchema,
  type Snapshot,
  type SnapshotAttachment,
  type SnapshotMedia,
} from '@sal/model';
import raw from '../../../../../data/fixtures/snapshot.json';
import { documentsBlock, galleryBlock } from './html.ts';
import type { Document, Image, SiteContent } from './types.ts';

/** Les médias du jeu de données sont copiés dans public/_fixtures au démarrage. */
const FIXTURES_MEDIA_BASE = '/_fixtures/';

/**
 * Convertit un snapshot (jeu de données de test ou résultat du scraping) vers
 * le modèle de contenu du site.
 */
function fromSnapshot(snapshot: Snapshot, mediaBase = FIXTURES_MEDIA_BASE): SiteContent {
  const media = new Map<string, SnapshotMedia>(snapshot.media.map((m) => [m.id, m]));
  const url = (m: SnapshotMedia) => `${mediaBase}${m.file}`;

  const image = (id: string | undefined, fallbackAlt = ''): Image | undefined => {
    const m = id ? media.get(id) : undefined;
    if (!m || !m.mime.startsWith('image/')) return undefined;
    return {
      src: url(m),
      alt: m.alt ?? fallbackAlt,
      ...(m.width ? { width: m.width } : {}),
      ...(m.height ? { height: m.height } : {}),
    };
  };
  const document = (id: string | undefined, title?: string): Document | undefined => {
    const m = id ? media.get(id) : undefined;
    return m ? { url: url(m), title: title ?? m.title ?? m.file } : undefined;
  };
  const resolveMedia = (html: string) =>
    html.replace(/(src|href)="media:([a-f0-9]+)"/g, (all, attr: string, id: string) => {
      const m = media.get(id);
      return m ? `${attr}="${url(m)}"` : all;
    });
  const withExtras = (
    html: string,
    attachments: SnapshotAttachment[] = [],
    gallery: string[] = [],
  ) => {
    const docs = attachments
      .map((a) => document(a.mediaId, a.title))
      .filter((d): d is Document => !!d);
    const images = gallery
      .map((id) => {
        const img = image(id);
        const caption = media.get(id)?.title;
        return img ? { ...img, ...(caption ? { caption } : {}) } : undefined;
      })
      .filter((i) => i !== undefined);
    return resolveMedia(html) + galleryBlock(images) + documentsBlock(docs);
  };

  const s = snapshot.settings;
  /** Dans le jeu de données, tout a été « modifié » à la date du scraping. */
  const modified = snapshot.scrapedAt.slice(0, 10);
  const hero = image(s.heroImageId, 'Saint-Amand-Longpré');

  return {
    settings: {
      street: s.street,
      postalCode: s.postalCode,
      city: s.city,
      phone: s.phone,
      hours: s.hours,
      ...(s.facebook ? { facebook: s.facebook } : {}),
      ...(s.latitude !== undefined ? { latitude: s.latitude } : {}),
      ...(s.longitude !== undefined ? { longitude: s.longitude } : {}),
      ...(hero ? { heroImage: hero } : {}),
      ...(s.population ? { population: s.population } : {}),
    },
    pages: snapshot.pages.map((p) => ({
      id: `page:${p.path}`,
      modified,
      title: p.title,
      path: p.path,
      ...(p.parentPath ? { parentPath: p.parentPath } : {}),
      section: p.section,
      html: withExtras(p.html, p.attachments, p.gallery),
      ...(p.excerpt ? { excerpt: p.excerpt } : {}),
      order: p.order,
    })),
    news: snapshot.news.map((n) => {
      const img = image(n.imageId, '');
      return {
        id: `news:${n.slug}`,
        modified: n.date > modified ? n.date : modified,
        slug: n.slug,
        title: n.title,
        date: n.date,
        category: n.category,
        excerpt: n.excerpt ?? '',
        html: withExtras(n.html, n.attachments, n.gallery),
        ...(img ? { image: img } : {}),
      };
    }),
    events: snapshot.events.map((e) => {
      const img = image(e.imageId, '');
      return {
        id: `event:${e.slug}`,
        modified,
        slug: e.slug,
        title: e.title,
        start: e.start,
        ...(e.end ? { end: e.end } : {}),
        allDay: e.allDay,
        ...(e.location ? { location: e.location } : {}),
        ...(e.address ? { address: e.address } : {}),
        ...(e.excerpt ? { excerpt: e.excerpt } : {}),
        html: withExtras(e.html, e.attachments),
        ...(img ? { image: img } : {}),
      };
    }),
    meetings: snapshot.meetings.map((m) => {
      const report = document(m.reportId, `Compte rendu – ${m.title}`);
      return {
        id: `meeting:${m.date}`,
        title: m.title,
        date: m.date,
        ...(report ? { report } : {}),
        html: resolveMedia(m.html),
      };
    }),
    elected: snapshot.elected.map((e) => {
      const photo = image(e.photoId, e.name);
      return {
        id: `elected:${e.slug}`,
        name: e.name,
        role: e.role,
        title: e.title,
        ...(e.delegations ? { delegations: e.delegations } : {}),
        ...(photo ? { photo } : {}),
        order: e.order,
      };
    }),
    rooms: snapshot.rooms.map((r) => ({
      id: `room:${r.slug}`,
      modified,
      slug: r.slug,
      title: r.title,
      ...(r.excerpt ? { excerpt: r.excerpt } : {}),
      html: withExtras(r.html, r.attachments),
      ...(r.capacity ? { capacity: r.capacity } : {}),
      ...(r.seated ? { seated: r.seated } : {}),
      photos: r.photoIds.map((id) => image(id, r.title)).filter((i): i is Image => !!i),
    })),
    directory: snapshot.directory.map((d) => {
      const logo = image(d.logoId, `Logo ${d.title}`);
      return {
        id: `directory:${d.kind}:${d.slug}`,
        kind: d.kind,
        slug: d.slug,
        title: d.title,
        ...(d.category ? { category: d.category } : {}),
        html: resolveMedia(d.html),
        ...(d.phone ? { phone: d.phone } : {}),
        ...(d.email ? { email: d.email } : {}),
        ...(d.website ? { website: d.website } : {}),
        ...(d.address ? { address: d.address } : {}),
        ...(logo ? { logo } : {}),
      };
    }),
    alerts: snapshot.alerts.map((a) => ({
      id: `alert:${a.slug}`,
      title: a.title,
      message: a.message,
      level: a.level,
      ...(a.link ? { link: a.link } : {}),
      expires: a.expires,
    })),
    redirects: snapshot.redirects,
  };
}

export function loadFixtures(): SiteContent {
  return fromSnapshot(snapshotSchema.parse(raw));
}
