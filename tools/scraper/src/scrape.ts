/**
 * Scraper du site actuel de la commune.
 *
 * Usage : pnpm scrape [--refresh] [--skip-media]
 *   --refresh     ignore le cache disque et interroge à nouveau l'ancien serveur
 *   --skip-media  ne télécharge pas les images et documents
 *
 * Produit data/scrape/snapshot.json et data/scrape/media/.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  slugify,
  snapshotSchema,
  uniqueSlug,
  type Snapshot,
  type SnapshotAttachment,
  type SnapshotDirectoryEntry,
  type SnapshotElected,
  type SnapshotEvent,
  type SnapshotMeeting,
  type SnapshotNews,
  type SnapshotPage,
  type SnapshotRoom,
  type Section,
} from '@sal/model';
import { classify, oldSlug } from './classify.ts';
import { cleanHtml, excerpt, htmlToText, rewriteUrls } from './clean-html.ts';
import {
  HERO_IMAGE_ALT,
  HERO_IMAGE_URL,
  HOST,
  LIST_REDIRECTS,
  ORIGIN,
  POPULATION,
  SCRAPE_DIR,
} from './config.ts';
import { crawl } from './crawl.ts';
import { guessPublicationDate, parseOpeningHours } from './dates.ts';
import * as x from './extract.ts';
import { isMediaUrl, MediaStore } from './media.ts';
import {
  categorizeNews,
  formatFrenchDate,
  formatPhone,
  resolvePagePath,
  sectionOf,
} from './normalize.ts';

const args = new Set(process.argv.slice(2));
const refresh = args.has('--refresh');
const skipMedia = args.has('--skip-media');

const scrapedAt = new Date().toISOString();
const media = new MediaStore();
/** Ancien chemin → nouveau chemin. */
const redirects = new Map<string, string>(Object.entries(LIST_REDIRECTS));

const urlOf = (path: string) => `${ORIGIN}${path}`;
const pathOf = (url: string) => {
  try {
    const u = new URL(url, ORIGIN);
    return decodeURI(u.pathname).replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
};

function attachmentsOf(files: x.RawFile[]): SnapshotAttachment[] {
  return files.map((f) => ({ mediaId: media.register(f.url, { title: f.title }), title: f.title }));
}

function galleryOf(files: x.RawFile[]): string[] {
  return files.map((f) => media.register(f.url, f.title ? { title: f.title, alt: f.title } : {}));
}

async function geocode(query: string): Promise<{ latitude: number; longitude: number } | null> {
  const cache = `${SCRAPE_DIR}/geocode.json`;
  if (existsSync(cache)) return JSON.parse(await readFile(cache, 'utf8'));
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { 'user-agent': 'SaintAmandLongpre-Migration/1.0' } },
    );
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (!hit) return null;
    const result = { latitude: Number(hit.lat), longitude: Number(hit.lon) };
    await writeFile(cache, JSON.stringify(result));
    return result;
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(SCRAPE_DIR, { recursive: true });
  await media.load();

  console.log(`Exploration de ${ORIGIN}${refresh ? ' (sans cache)' : ''}…`);
  const { pages, failed } = await crawl({ refresh });
  console.log(`${pages.size} pages récupérées, ${failed.length} en échec.`);

  const docs = new Map<string, ReturnType<typeof x.load>>();
  const doc = (path: string) => {
    let $ = docs.get(path);
    if (!$) {
      $ = x.load(pages.get(path)!);
      docs.set(path, $);
    }
    return $;
  };
  const byKind = (kind: ReturnType<typeof classify>) =>
    [...pages.keys()].filter((p) => classify(p) === kind);

  // ---------------------------------------------------------------- Pages
  const infoPaths = [...byKind('information'), ...byKind('generic')];
  const rawPages = new Map(infoPaths.map((p) => [p, x.extractPage(doc(p), urlOf(p))]));
  const parentOf = new Map<string, string>();
  const orderOf = new Map<string, number>();
  for (const [path, raw] of rawPages) {
    raw.children.forEach((child, index) => {
      const childPath = pathOf(child.path);
      if (childPath && rawPages.has(childPath) && !parentOf.has(childPath)) {
        parentOf.set(childPath, path);
        orderOf.set(childPath, index);
      }
    });
  }
  const titleOf = (p: string) => rawPages.get(p)?.title || oldSlug(p);
  const takenPaths = new Set<string>();
  const snapshotPages: SnapshotPage[] = [];
  for (const [oldPath, raw] of rawPages) {
    let path = resolvePagePath(oldPath, titleOf, (p) => parentOf.get(p));
    if (takenPaths.has(path)) path = path.replace(/\/$/, `-${oldSlug(oldPath)}/`);
    takenPaths.add(path);
    redirects.set(oldPath, path);
    const html = cleanHtml(raw.html, urlOf(oldPath));
    const parts = path.split('/').filter(Boolean);
    const parentPath = parts.length > 1 ? `/${parts.slice(0, -1).join('/')}/` : undefined;
    snapshotPages.push({
      sourceUrl: urlOf(oldPath),
      title: raw.title || titleOf(oldPath),
      slug: parts.at(-1)!,
      section: sectionOf(path) as Section,
      path,
      ...(parentPath ? { parentPath } : {}),
      html,
      excerpt: excerpt(html),
      attachments: attachmentsOf(raw.attachments),
      gallery: galleryOf(raw.gallery),
      order: orderOf.get(oldPath) ?? 0,
    });
  }

  // ------------------------------------------------------- Albums photo
  const albumSlugs = new Set<string>();
  for (const oldPath of byKind('album')) {
    const $ = doc(oldPath);
    const raw = x.extractPage($, urlOf(oldPath));
    const title =
      $('#pictures h2.title').first().text().replace(/\s+/g, ' ').trim() || oldSlug(oldPath);
    const slug = uniqueSlug(slugify(title), albumSlugs);
    const path = `/decouvrir/photos/${slug}/`;
    redirects.set(oldPath, path);
    const description = $('#pictures p.desc').first().text().trim();
    snapshotPages.push({
      sourceUrl: urlOf(oldPath),
      title,
      slug,
      section: 'decouvrir',
      path,
      parentPath: '/decouvrir/photos/',
      html: description ? `<p>${description}</p>` : '',
      ...(description ? { excerpt: description } : {}),
      attachments: [],
      gallery: galleryOf(raw.gallery),
      order: snapshotPages.filter((p) => p.parentPath === '/decouvrir/photos/').length,
    });
  }

  // ---------------------------------------------------------- Actualités
  const listPages = byKind('news-list').sort((a, b) => {
    const n = (p: string) => Number(/\/(\d+)$/.exec(p)?.[1] ?? 1);
    return n(a) - n(b);
  });
  const newsOrder: string[] = [];
  const thumbs = new Map<string, string>();
  for (const lp of listPages) {
    for (const item of x.extractNewsList(doc(lp), urlOf(lp))) {
      const p = pathOf(item.path);
      if (!p || newsOrder.includes(p)) continue;
      newsOrder.push(p);
      if (item.thumb) thumbs.set(p, item.thumb);
    }
  }
  for (const p of byKind('news')) if (!newsOrder.includes(p)) newsOrder.push(p);

  const newsSlugs = new Set<string>();
  const news: SnapshotNews[] = [];
  let lastKnownDate = scrapedAt.slice(0, 10);
  for (const oldPath of newsOrder) {
    if (!pages.has(oldPath)) continue;
    const $ = doc(oldPath);
    const raw = x.extractPage($, urlOf(oldPath));
    raw.html = $('#news .content').first().html() ?? raw.html;
    const html = cleanHtml(raw.html, urlOf(oldPath));
    const body = htmlToText(html);
    const guessed = guessPublicationDate(`${raw.title} ${body}`, scrapedAt);
    // Sans date lisible, l'actualité reprend celle qui la précède dans la liste (triée par récence).
    if (guessed) lastKnownDate = guessed;
    const slug = uniqueSlug(slugify(raw.title) || oldSlug(oldPath), newsSlugs);
    redirects.set(oldPath, `/actualites/${slug}/`);
    const gallery = galleryOf(raw.gallery);
    const thumb = thumbs.get(oldPath);
    const imageId = thumb ? media.register(thumb, { alt: '' }) : gallery[0];
    news.push({
      sourceUrl: urlOf(oldPath),
      title: raw.title,
      slug,
      date: guessed ?? lastKnownDate,
      dateEstimated: !guessed,
      category: categorizeNews(raw.title, body),
      html,
      excerpt: excerpt(html),
      ...(imageId ? { imageId } : {}),
      attachments: attachmentsOf(raw.attachments),
      gallery,
    });
  }

  // Une actualité sans date lisible prend la date de la première actualité
  // datée qui la suit dans la liste (triée de la plus récente à la plus ancienne).
  for (let i = news.length - 1, older: string | undefined; i >= 0; i -= 1) {
    const item = news[i]!;
    if (!item.dateEstimated) older = item.date;
    else if (older) item.date = older;
  }

  // ------------------------------------------ Actualités des associations
  const associationGalleries = new Map<string, x.RawFile[]>();
  for (const gp of byKind('association-news-gallery')) {
    const id = /(\d+)$/.exec(gp)![1]!;
    associationGalleries.set(id, x.extractPage(doc(gp), urlOf(gp)).gallery);
  }
  const oldestNewsDate = news.map((n) => n.date).sort()[0] ?? scrapedAt.slice(0, 10);
  for (const oldPath of byKind('association-news')) {
    const $ = doc(oldPath);
    const [, associationId, newsId] =
      /^\/fr\/association-actualite\/(\d+)\/(\d+)\//.exec(oldPath) ?? [];
    const title = x.pageTitle($);
    const associationPath = byKind('association').find((p) =>
      p.startsWith(`/fr/association/1/${associationId}/`),
    );
    const associationName = associationPath ? x.pageTitle(doc(associationPath)) : undefined;
    const html = cleanHtml($('#newsassociation .info').first().html() ?? '', urlOf(oldPath));
    const body = htmlToText(html);
    const guessed = guessPublicationDate(`${title} ${body}`, scrapedAt);
    const slug = uniqueSlug(slugify(title), newsSlugs);
    redirects.set(oldPath, `/actualites/${slug}/`);
    const gallery = galleryOf(associationGalleries.get(newsId ?? '') ?? []);
    news.push({
      sourceUrl: urlOf(oldPath),
      title,
      slug,
      date: guessed ?? oldestNewsDate,
      dateEstimated: !guessed,
      category: 'Vie associative',
      html: associationName
        ? `<p><em>Actualité publiée par ${associationName}.</em></p>${html}`
        : html,
      excerpt: excerpt(html),
      ...(gallery[0] ? { imageId: gallery[0] } : {}),
      attachments: attachmentsOf(x.extractPage($, urlOf(oldPath)).attachments),
      gallery,
    });
  }
  news.sort((a, b) => b.date.localeCompare(a.date));

  // ----------------------------------------------------------- Évènements
  const eventSlugs = new Set<string>();
  const events: SnapshotEvent[] = [];
  for (const oldPath of byKind('event')) {
    const raw = x.extractEvent(doc(oldPath), urlOf(oldPath));
    if (!raw.timing) {
      console.warn(`  ! date d'évènement illisible : ${oldPath}`);
      continue;
    }
    const slug = uniqueSlug(`${slugify(raw.title)}-${raw.timing.start.slice(0, 10)}`, eventSlugs);
    redirects.set(oldPath, `/agenda/${slug}/`);
    const html = cleanHtml(raw.html, urlOf(oldPath));
    events.push({
      sourceUrl: urlOf(oldPath),
      title: raw.title,
      slug,
      start: raw.timing.start,
      ...(raw.timing.end ? { end: raw.timing.end } : {}),
      allDay: raw.timing.allDay,
      ...(raw.location ? { location: raw.location } : {}),
      ...(raw.address ? { address: raw.address } : {}),
      html,
      excerpt: excerpt(html),
      attachments: attachmentsOf(raw.attachments),
    });
  }

  // ------------------------------------------------ Conseil municipal
  const meetingsByDate = new Map<string, SnapshotMeeting>();
  for (const lp of byKind('meetings-list')) {
    for (const row of x.extractMeetingRows(doc(lp), urlOf(lp))) {
      if (meetingsByDate.has(row.date)) continue;
      const detail = row.detailPath ? pathOf(row.detailPath) : null;
      let html = '';
      if (detail && pages.has(detail)) {
        const $ = doc(detail);
        const main = $('#municipalreport').clone();
        main.find('#file-attachments, .attachments, table.lastreports, #liste, script').remove();
        html = cleanHtml(main.html() ?? '', urlOf(detail));
        redirects.set(detail, '/mairie/conseil-municipal/comptes-rendus/');
      }
      const title = `Séance du ${formatFrenchDate(row.date)}`;
      meetingsByDate.set(row.date, {
        ...(detail ? { sourceUrl: urlOf(detail) } : {}),
        slug: `seance-${row.date}`,
        title,
        date: row.date,
        ...(row.reportUrl
          ? { reportId: media.register(row.reportUrl, { title: `Compte rendu – ${title}` }) }
          : {}),
        html,
      });
    }
  }
  const meetings = [...meetingsByDate.values()].sort((a, b) => b.date.localeCompare(a.date));

  const elected: SnapshotElected[] = [];
  const electedSlugs = new Set<string>();
  for (const cp of byKind('council')) {
    x.extractCouncil(doc(cp)).forEach((member, index) => {
      const profilePath = pathOf(member.profilePath);
      const profile =
        profilePath && pages.has(profilePath)
          ? x.extractProfile(doc(profilePath), urlOf(profilePath))
          : null;
      if (profilePath) redirects.set(profilePath, '/mairie/conseil-municipal/elus/');
      const name = member.name
        .split(/\s+/)
        .map((w) => (w === w.toUpperCase() && w.length > 1 ? w[0] + w.slice(1).toLowerCase() : w))
        .join(' ')
        .replace(/-(\p{Ll})/gu, (_, c: string) => `-${c.toUpperCase()}`);
      const rawTitle = (profile?.title || '')
        .replace(
          /(\d+)\s*(?:er|ere|ère|e|ème|éme|eme)\b\s*/i,
          (_, n: string) => `${n}${n === '1' ? 'er' : 'e'} `,
        )
        .replace(/\b(Adjoint|Adjointe|Conseill[eè]re?|Maire)\b/g, (w) =>
          /^\d/.test(profile?.title ?? '') ? w.toLowerCase() : w,
        )
        .replace(/[.\s]+$/, '')
        .trim();
      const defaultTitle =
        member.role === 'maire'
          ? 'Maire'
          : member.role === 'adjoint'
            ? 'Adjoint'
            : 'Conseiller municipal';
      const delegations =
        profile?.delegations && !/^(adjointe?|maire|conseill[eè]re?)/i.test(profile.delegations)
          ? profile.delegations
          : undefined;
      elected.push({
        ...(profilePath ? { sourceUrl: urlOf(profilePath) } : {}),
        slug: uniqueSlug(slugify(name), electedSlugs),
        name,
        role: member.role,
        title: rawTitle ? rawTitle[0]!.toUpperCase() + rawTitle.slice(1) : defaultTitle,
        ...(delegations ? { delegations } : {}),
        ...(profile?.photo
          ? {
              photoId: media.register(profile.photo.replace(/\/\d+x\d+\//, '/400x400/'), {
                alt: name,
              }),
            }
          : {}),
        order: index,
      });
    });
  }

  // --------------------------------------------------------------- Salles
  const rooms: SnapshotRoom[] = [];
  const roomSlugs = new Set<string>();
  const roomGalleries = new Map<string, x.RawFile[]>();
  for (const gp of byKind('room-gallery')) {
    const id = /salle-municipale-diaporama\/(\d+)/.exec(gp)![1]!;
    const files = x.extractPage(doc(gp), urlOf(gp)).gallery;
    if (files.length > (roomGalleries.get(id)?.length ?? 0)) roomGalleries.set(id, files);
  }
  for (const oldPath of byKind('room')) {
    const raw = x.extractRoom(doc(oldPath), urlOf(oldPath));
    const roomId = /salle-municipale\/(\d+)/.exec(oldPath)![1]!;
    raw.photos.push(
      ...(roomGalleries.get(roomId) ?? []).filter((f) => !raw.photos.some((p) => p.url === f.url)),
    );
    const html = cleanHtml(raw.html, urlOf(oldPath));
    const slug = uniqueSlug(slugify(raw.title), roomSlugs);
    redirects.set(oldPath, `/demarches/louer-une-salle/${slug}/`);
    rooms.push({
      sourceUrl: urlOf(oldPath),
      title: raw.title,
      slug,
      html,
      excerpt: excerpt(html),
      ...x.parseCapacity(htmlToText(html)),
      photoIds: galleryOf(raw.photos),
      attachments: attachmentsOf(raw.attachments),
    });
  }

  // -------------------------------------------------------------- Annuaire
  const directory: SnapshotDirectoryEntry[] = [];
  const dirSlugs = new Map<string, Set<string>>();
  const slugFor = (kind: string, title: string) => {
    if (!dirSlugs.has(kind)) dirSlugs.set(kind, new Set());
    return uniqueSlug(slugify(title), dirSlugs.get(kind)!);
  };
  const associationCategory = new Map<string, string>();
  for (const lp of byKind('associations-list')) {
    const category = x.categoryLabel(doc(lp), lp);
    for (const link of x.extractAssociationLinks(doc(lp))) {
      const p = pathOf(link);
      if (p && category) associationCategory.set(p, category);
    }
  }
  for (const oldPath of byKind('association')) {
    const raw = x.extractAssociation(doc(oldPath), urlOf(oldPath));
    const slug = slugFor('association', raw.title);
    redirects.set(oldPath, `/vivre-ici/associations/${slug}/`);
    const category = associationCategory.get(oldPath);
    directory.push({
      sourceUrl: urlOf(oldPath),
      kind: 'association',
      title: raw.title,
      slug,
      ...(category ? { category } : {}),
      html: cleanHtml(raw.html, urlOf(oldPath)),
      ...(raw.phone ? { phone: formatPhone(raw.phone) } : {}),
      ...(raw.email ? { email: raw.email } : {}),
      ...(raw.website
        ? { website: raw.website.startsWith('http') ? raw.website : `http://${raw.website}` }
        : {}),
      ...(raw.address ? { address: raw.address } : {}),
      ...(raw.logo ? { logoId: media.register(raw.logo, { alt: `Logo ${raw.title}` }) } : {}),
    });
  }
  for (const lp of byKind('business-list')) {
    const kind = /artisans/.test(lp)
      ? 'artisan'
      : /entreprises/.test(lp)
        ? 'entreprise'
        : 'commerce';
    for (const raw of x.extractBusinesses(doc(lp))) {
      if (directory.some((d) => d.kind === kind && d.title === raw.title)) continue;
      directory.push({
        kind,
        title: raw.title,
        slug: slugFor(kind, raw.title),
        ...(raw.category ? { category: raw.category } : {}),
        html: cleanHtml(raw.html, urlOf(lp)),
        ...(raw.phone ? { phone: formatPhone(raw.phone) } : {}),
        ...(raw.address ? { address: raw.address } : {}),
      });
    }
  }
  // Les pages de catégorie passent avant la liste complète pour conserver la catégorie.
  const numberPages = byKind('numbers-list').sort(
    (a, b) => Number(/\/1\//.test(b)) - Number(/\/1\//.test(a)),
  );
  for (const lp of numberPages) {
    const category = x.categoryLabel(doc(lp), lp);
    for (const raw of x.extractNumbers(doc(lp), category)) {
      const phone = raw.phone ? formatPhone(raw.phone) : undefined;
      if (
        directory.some(
          (d) => d.kind === 'numero-utile' && d.title === raw.title && d.phone === phone,
        )
      )
        continue;
      directory.push({
        kind: 'numero-utile',
        title: raw.title,
        slug: slugFor('numero-utile', raw.title),
        ...(raw.category ? { category: raw.category } : {}),
        html: cleanHtml(raw.html, urlOf(lp)),
        ...(phone ? { phone } : {}),
      });
    }
  }

  const links = byKind('links').flatMap((p) => x.extractLinks(doc(p)));
  for (const p of byKind('other')) {
    if (p.startsWith('/fr/marche-public/')) redirects.set(p, '/mairie/marches-publics/');
    if (p.startsWith('/fr/en-images-diaporama/')) redirects.set(p, '/decouvrir/photos/');
  }

  // -------------------------------------------------------------- Réglages
  const rawSettings = x.extractSettings(doc('/'));
  if (!rawSettings) throw new Error("Coordonnées de la mairie introuvables sur la page d'accueil");
  const coords = await geocode(
    `${rawSettings.street}, ${rawSettings.postalCode} ${rawSettings.city}`,
  );
  const home = doc('/');
  const banners: string[] = [];
  home('style, [style]').each((_, el) => {
    const css = home(el).attr('style') ?? home(el).html() ?? '';
    for (const m of css.matchAll(/url\(['"]?([^'")]+\/banner\/[^'")]+)['"]?\)/g))
      banners.push(m[1]!);
  });
  for (const m of (pages.get('/') ?? '').matchAll(/url\(['"]?([^'")]+\/banner\/[^'")]+)['"]?\)/g)) {
    if (!banners.includes(m[1]!)) banners.push(m[1]!);
  }
  const bannerIds = banners.map((b) =>
    media.register(b, { alt: 'Vue de Saint-Amand-Longpré', title: 'Bandeau' }),
  );
  const photosPage = snapshotPages.find((p) => p.path === '/decouvrir/photos/');
  if (photosPage)
    photosPage.gallery.push(...bannerIds.filter((id) => !photosPage.gallery.includes(id)));

  const heroId = media.registerExact(HERO_IMAGE_URL, {
    alt: HERO_IMAGE_ALT,
    title: 'Église de Saint-Amand-Longpré',
  });

  // ----------------------------------------- Liens internes et médias
  const resolveUrl = (url: string, tag: 'a' | 'img'): string | null => {
    if (isMediaUrl(url)) return `media:${media.register(url)}`;
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    if (u.hostname !== HOST && u.hostname !== HOST.replace(/^www\./, '')) return null;
    if (tag === 'img') return null;
    const p = decodeURI(u.pathname).replace(/\/+$/, '') || '/';
    return redirects.get(p) ?? '/';
  };
  const fix = (html: string) => (html ? rewriteUrls(html, resolveUrl) : html);
  for (const item of [...snapshotPages, ...news, ...events, ...meetings, ...rooms, ...directory])
    item.html = fix(item.html);

  // ------------------------------------------------------------- Médias
  let downloaded: Snapshot['media'] = [];
  if (!skipMedia) {
    console.log('Téléchargement des médias…');
    downloaded = await media.downloadAll((done, total) => {
      if (done % 20 === 0 || done === total) console.log(`  … ${done}/${total}`);
    });
  }
  const available = new Set(downloaded.map((m) => m.id));
  const keep = (id?: string) => (id && available.has(id) ? id : undefined);
  const keepAttachments = (list: SnapshotAttachment[]) =>
    list.filter((a) => available.has(a.mediaId));
  const dropMissingInHtml = (html: string) =>
    html
      .replace(/<img[^>]+src="media:([a-f0-9]+)"[^>]*>/g, (all, id: string) =>
        available.has(id) ? all : '',
      )
      .replace(/<a href="media:([a-f0-9]+)"[^>]*>(.*?)<\/a>/g, (all, id: string, label: string) =>
        available.has(id) ? all : label,
      );

  for (const p of snapshotPages) {
    p.html = dropMissingInHtml(p.html);
    p.attachments = keepAttachments(p.attachments);
    p.gallery = p.gallery.filter((id) => available.has(id));
  }
  for (const n of news) {
    n.html = dropMissingInHtml(n.html);
    n.attachments = keepAttachments(n.attachments);
    n.gallery = n.gallery.filter((id) => available.has(id));
    const img = keep(n.imageId);
    if (img) n.imageId = img;
    else delete n.imageId;
  }
  for (const e of events) {
    e.html = dropMissingInHtml(e.html);
    e.attachments = keepAttachments(e.attachments);
  }
  for (const m of meetings) {
    m.html = dropMissingInHtml(m.html);
    if (!keep(m.reportId)) delete m.reportId;
  }
  for (const r of rooms) {
    r.html = dropMissingInHtml(r.html);
    r.photoIds = r.photoIds.filter((id) => available.has(id));
    r.attachments = keepAttachments(r.attachments);
  }
  for (const e of elected) if (!keep(e.photoId)) delete e.photoId;
  for (const d of directory) {
    d.html = dropMissingInHtml(d.html);
    if (!keep(d.logoId)) delete d.logoId;
  }

  const heroImageId = keep(heroId) ?? keep(bannerIds[0]);

  const snapshot: Snapshot = snapshotSchema.parse({
    version: 1,
    scrapedAt,
    source: ORIGIN,
    settings: {
      name: 'Mairie de Saint-Amand-Longpré',
      street: rawSettings.street,
      postalCode: rawSettings.postalCode,
      city: rawSettings.city,
      phone: formatPhone(rawSettings.phone),
      hours: parseOpeningHours(rawSettings.hoursText),
      ...(rawSettings.facebook ? { facebook: rawSettings.facebook } : {}),
      ...(coords ?? {}),
      ...(heroImageId ? { heroImageId } : {}),
      population: POPULATION,
    },
    pages: snapshotPages.sort((a, b) => a.path.localeCompare(b.path)),
    news,
    events: events.sort((a, b) => b.start.localeCompare(a.start)),
    meetings,
    elected,
    rooms,
    directory,
    links,
    alerts: [],
    media: downloaded,
    redirects: [...redirects.entries()]
      .filter(([from, to]) => from !== to && from !== '/')
      .map(([from, to]) => ({ from, to }))
      .sort((a, b) => a.from.localeCompare(b.from)),
  });

  await writeFile(`${SCRAPE_DIR}/snapshot.json`, JSON.stringify(snapshot, null, 2));
  const report = [
    `Snapshot écrit dans data/scrape/snapshot.json (${scrapedAt})`,
    `  pages          ${snapshot.pages.length}`,
    `  actualités     ${snapshot.news.length} (dont ${snapshot.news.filter((n) => n.dateEstimated).length} à date estimée)`,
    `  évènements     ${snapshot.events.length}`,
    `  séances        ${snapshot.meetings.length}`,
    `  élus           ${snapshot.elected.length}`,
    `  salles         ${snapshot.rooms.length}`,
    `  annuaire       ${snapshot.directory.length}`,
    `  médias         ${snapshot.media.length}`,
    `  redirections   ${snapshot.redirects.length}`,
    ...(failed.length ? [`Pages en échec :`, ...failed.map((f) => `  - ${f}`)] : []),
    ...['other'].flatMap(() => {
      const ignored = byKind('other');
      return ignored.length
        ? [`Pages non reprises (${ignored.length}) :`, ...ignored.map((p) => `  - ${p}`)]
        : [];
    }),
  ].join('\n');
  await writeFile(`${SCRAPE_DIR}/report.txt`, report + '\n');
  console.log(report);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
