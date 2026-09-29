/**
 * Importe un snapshot (jeu de données de test ou scraping de l'ancien site)
 * dans WordPress via l'API REST. Idempotent : chaque contenu garde son
 * identifiant d'origine (_sal_source_id) et est mis à jour s'il existe déjà.
 *
 * Usage :
 *   pnpm cms:import                       jeu de données de test → WordPress local
 *   pnpm cms:import --source scrape       contenu scrapé de l'ancien site
 *   pnpm cms:import --url https://cms.saintamandlongpre.fr --user … --password …
 *
 * Les identifiants par défaut sont lus dans apps/cms/.data/credentials.env
 * (créé par pnpm cms:setup) ou dans les variables WP_URL, WP_USER, WP_APP_PASSWORD.
 */
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import {
  SECTION_LABELS,
  snapshotSchema,
  type Section,
  type Snapshot,
  type SnapshotMedia,
} from '@sal/model';
import {
  acfDate,
  acfDateTime,
  composeContent,
  resolveMediaRefs,
  type UploadedMedia,
} from './blocks.ts';
import { createWpClient, type WpClient } from './wp.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));

function loadCredentials(): Record<string, string> {
  const file = `${root}apps/cms/.data/credentials.env`;
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => /^\w+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  );
}

const creds = { ...loadCredentials(), ...process.env };
const { values: args } = parseArgs({
  options: {
    source: { type: 'string', default: 'fixtures' },
    url: { type: 'string', default: creds.WP_URL ?? 'http://localhost:8080' },
    user: { type: 'string', default: creds.WP_USER ?? 'admin' },
    password: { type: 'string', default: creds.WP_APP_PASSWORD ?? '' },
    'max-image-width': { type: 'string', default: '2400' },
  },
});

const sourceDir = args.source === 'scrape' ? `${root}data/scrape` : `${root}data/fixtures`;
const maxWidth = Number(args['max-image-width']);

interface WpItem {
  id: number;
  meta?: { _sal_source_id?: string };
}
interface WpMedia extends WpItem {
  source_url: string;
}

const stats = { created: 0, updated: 0, failed: 0 };

/** Retire les valeurs vides : ACF refuse par exemple un e-mail ou une URL vide. */
const acf = (fields: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== ''));
const failures: string[] = [];

async function main() {
  if (!args.password)
    throw new Error(
      'Mot de passe d’application manquant : lancez « pnpm cms:setup » ou passez --password.',
    );
  const wp = createWpClient({ url: args.url!, user: args.user!, password: args.password });
  const snapshot = snapshotSchema.parse(
    JSON.parse(await readFile(`${sourceDir}/snapshot.json`, 'utf8')),
  );
  console.log(`Import de ${sourceDir.replace(root, '')} vers ${args.url}`);

  const media = await importMedia(wp, snapshot);
  const lookup = (id: string) => media.get(id);
  const html = (value: string) => resolveMediaRefs(value, lookup);
  const docs = (list: { mediaId: string; title: string }[]) =>
    list.flatMap((a) =>
      media.get(a.mediaId) ? [{ media: media.get(a.mediaId)!, title: a.title }] : [],
    );
  const images = (ids: string[]) => ids.flatMap((id) => (media.get(id) ? [media.get(id)!] : []));

  // ------------------------------------------------------------ Pages
  const pageIds = new Map<string, number>();
  const existingPages = await index(wp, 'pages');
  const sectionRoots = [...new Set(snapshot.pages.map((p) => `/${p.path.split('/')[1]}/`))];
  for (const path of sectionRoots) {
    const section = path.slice(1, -1) as Section;
    const id = await upsert(wp, 'pages', existingPages, `page:${path}`, {
      title: SECTION_LABELS[section] ?? section,
      slug: section,
      status: 'publish',
      content: '',
      menu_order: ['mairie', 'demarches', 'vivre-ici', 'decouvrir'].indexOf(section),
    });
    if (id) pageIds.set(path, id);
  }
  const pages = [...snapshot.pages].sort(
    (a, b) => a.path.split('/').length - b.path.split('/').length,
  );
  for (const page of pages) {
    const parent = page.parentPath ? pageIds.get(page.parentPath) : undefined;
    const id = await upsert(wp, 'pages', existingPages, `page:${page.path}`, {
      title: page.title,
      slug: page.slug,
      status: 'publish',
      parent: parent ?? 0,
      menu_order: page.order,
      content: composeContent(html(page.html), images(page.gallery), docs(page.attachments)),
      excerpt: page.excerpt ?? '',
    });
    if (id) pageIds.set(page.path, id);
  }

  // ------------------------------------------------------- Actualités
  const categories = await termIndex(wp, 'categories');
  const existingPosts = await index(wp, 'posts');
  for (const news of snapshot.news) {
    const category = await ensureTerm(wp, 'categories', categories, news.category);
    const image = news.imageId ? media.get(news.imageId) : undefined;
    await upsert(wp, 'posts', existingPosts, `post:${news.slug}`, {
      title: news.title,
      slug: news.slug,
      status: 'publish',
      date: `${news.date}T09:00:00`,
      content: composeContent(
        html(news.html),
        images(news.gallery.filter((id) => id !== news.imageId)),
        docs(news.attachments),
      ),
      excerpt: news.excerpt ?? '',
      categories: category ? [category] : [],
      ...(image ? { featured_media: image.id } : {}),
      meta: { _sal_date_estimee: news.dateEstimated },
    });
  }

  // ------------------------------------------------------- Évènements
  const existingEvents = await index(wp, 'evenement');
  for (const event of snapshot.events) {
    await upsert(wp, 'evenement', existingEvents, `evenement:${event.slug}`, {
      title: event.title,
      slug: event.slug,
      status: 'publish',
      content: composeContent(html(event.html), [], docs(event.attachments)),
      excerpt: event.excerpt ?? '',
      acf: acf({
        debut: acfDateTime(event.start),
        fin: event.end ? acfDateTime(event.end) : undefined,
        journee_entiere: event.allDay,
        lieu: event.location,
        adresse: event.address,
      }),
    });
  }

  // ------------------------------------------------ Conseil municipal
  const existingMeetings = await index(wp, 'seance');
  for (const meeting of snapshot.meetings) {
    const report = meeting.reportId ? media.get(meeting.reportId) : undefined;
    await upsert(wp, 'seance', existingMeetings, `seance:${meeting.date}`, {
      title: meeting.title,
      slug: meeting.slug,
      status: 'publish',
      content: composeContent(html(meeting.html)),
      acf: { date: acfDate(meeting.date), ...(report ? { compte_rendu: report.id } : {}) },
    });
  }
  const existingElected = await index(wp, 'elu');
  for (const person of snapshot.elected) {
    const photo = person.photoId ? media.get(person.photoId) : undefined;
    await upsert(wp, 'elu', existingElected, `elu:${person.slug}`, {
      title: person.name,
      slug: person.slug,
      status: 'publish',
      menu_order: person.order,
      ...(photo ? { featured_media: photo.id } : {}),
      acf: acf({ role: person.role, fonction: person.title, delegations: person.delegations }),
    });
  }

  // ------------------------------------------------------------ Salles
  const existingRooms = await index(wp, 'salle');
  for (const room of snapshot.rooms) {
    const photos = images(room.photoIds);
    await upsert(wp, 'salle', existingRooms, `salle:${room.slug}`, {
      title: room.title,
      slug: room.slug,
      status: 'publish',
      content: composeContent(html(room.html), photos.slice(1), docs(room.attachments)),
      excerpt: room.excerpt ?? '',
      ...(photos[0] ? { featured_media: photos[0].id } : {}),
      acf: acf({ capacite: room.capacity, places_assises: room.seated }),
    });
  }

  // ---------------------------------------------------------- Annuaire
  const kinds = await termIndex(wp, 'type_annuaire', 'slug');
  const dirCategories = await termIndex(wp, 'categorie_annuaire');
  const existingEntries = await index(wp, 'annuaire');
  for (const entry of snapshot.directory) {
    const kind = kinds.get(entry.kind);
    const category = entry.category
      ? await ensureTerm(wp, 'categorie_annuaire', dirCategories, entry.category)
      : undefined;
    const logo = entry.logoId ? media.get(entry.logoId) : undefined;
    await upsert(wp, 'annuaire', existingEntries, `annuaire:${entry.kind}:${entry.slug}`, {
      title: entry.title,
      slug: `${entry.slug}`,
      status: 'publish',
      content: composeContent(html(entry.html)),
      type_annuaire: kind ? [kind] : [],
      categorie_annuaire: category ? [category] : [],
      ...(logo ? { featured_media: logo.id } : {}),
      acf: acf({
        telephone: entry.phone,
        email: entry.email,
        site: entry.website,
        adresse: entry.address,
      }),
    });
  }

  // ----------------------------------------------------------- Alertes
  const existingAlerts = await index(wp, 'alerte');
  for (const alert of snapshot.alerts) {
    await upsert(wp, 'alerte', existingAlerts, `alerte:${alert.slug}`, {
      title: alert.title,
      slug: alert.slug,
      status: 'publish',
      content: `<p>${alert.message}</p>`,
      acf: acf({ niveau: alert.level, lien: alert.link, expiration: acfDate(alert.expires) }),
    });
  }

  // ---------------------------------------------- Réglages et redirections
  const s = snapshot.settings;
  const hero = s.heroImageId ? media.get(s.heroImageId) : undefined;
  await wp.post('/wp/v2/settings', {
    sal_reglages: {
      street: s.street,
      postal_code: s.postalCode,
      city: s.city,
      phone: s.phone,
      hours: s.hours.map((h) => `${h.day} ${h.open} ${h.close}`).join('\n'),
      facebook: s.facebook ?? '',
      latitude: s.latitude !== undefined ? String(s.latitude) : '',
      longitude: s.longitude !== undefined ? String(s.longitude) : '',
      hero_image: hero?.id ?? 0,
      population: s.population ?? 0,
    },
    sal_redirections: snapshot.redirects,
  });

  console.log(
    `\nTerminé : ${stats.created} créés, ${stats.updated} mis à jour, ${stats.failed} en échec, ${media.size} médias.`,
  );
  if (failures.length) console.log(`Échecs :\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  if (stats.failed) process.exitCode = 1;
}

/** Index « identifiant d'origine → identifiant WordPress » d'un type de contenu. */
async function index(wp: WpClient, type: string): Promise<Map<string, number>> {
  const items = await wp.list<WpItem>(`/wp/v2/${type}`, '&context=edit&status=any&_fields=id,meta');
  return new Map(
    items.filter((i) => i.meta?._sal_source_id).map((i) => [i.meta!._sal_source_id!, i.id]),
  );
}

async function upsert(
  wp: WpClient,
  type: string,
  existing: Map<string, number>,
  sourceId: string,
  body: Record<string, unknown>,
): Promise<number | undefined> {
  const id = existing.get(sourceId);
  const payload = { ...body, meta: { ...(body.meta as object), _sal_source_id: sourceId } };
  try {
    const saved = await wp.post<WpItem>(id ? `/wp/v2/${type}/${id}` : `/wp/v2/${type}`, payload);
    existing.set(sourceId, saved.id);
    stats[id ? 'updated' : 'created'] += 1;
    return saved.id;
  } catch (error) {
    stats.failed += 1;
    failures.push(`${sourceId} : ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function termIndex(
  wp: WpClient,
  taxonomy: string,
  key: 'name' | 'slug' = 'name',
): Promise<Map<string, number>> {
  const terms = await wp.list<{ id: number; name: string; slug: string }>(
    `/wp/v2/${taxonomy}`,
    '&_fields=id,name,slug',
  );
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#039;/g, "'");
  return new Map(terms.map((t) => [key === 'name' ? decode(t.name) : t.slug, t.id]));
}

async function ensureTerm(
  wp: WpClient,
  taxonomy: string,
  terms: Map<string, number>,
  name: string,
): Promise<number | undefined> {
  const found = terms.get(name);
  if (found) return found;
  try {
    const term = await wp.post<{ id: number }>(`/wp/v2/${taxonomy}`, { name });
    terms.set(name, term.id);
    return term.id;
  } catch (error) {
    // Le terme existe peut-être sous une autre casse : WordPress renvoie son identifiant.
    const existing = (error as { message?: string }).message?.match(/"term_id":(\d+)/)?.[1];
    if (existing) {
      terms.set(name, Number(existing));
      return Number(existing);
    }
    failures.push(`terme ${taxonomy} « ${name} » : ${String(error)}`);
    return undefined;
  }
}

/** Téléverse les médias (images réduites à maxWidth), en réutilisant ceux déjà présents. */
async function importMedia(wp: WpClient, snapshot: Snapshot): Promise<Map<string, UploadedMedia>> {
  const existing = await wp.list<WpMedia>(
    '/wp/v2/media',
    '&context=edit&_fields=id,meta,source_url',
  );
  const bySource = new Map(
    existing.filter((m) => m.meta?._sal_source_id).map((m) => [m.meta!._sal_source_id!, m]),
  );
  const result = new Map<string, UploadedMedia>();
  let done = 0;

  const queue = [...snapshot.media];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const uploaded = await uploadOne(wp, item, bySource.get(`media:${item.id}`));
      if (uploaded) result.set(item.id, uploaded);
      done += 1;
      if (done % 25 === 0 || done === snapshot.media.length)
        console.log(`  médias : ${done}/${snapshot.media.length}`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return result;
}

async function uploadOne(
  wp: WpClient,
  item: SnapshotMedia,
  already?: WpMedia,
): Promise<UploadedMedia | undefined> {
  const meta = {
    ...(item.alt !== undefined ? { alt: item.alt } : {}),
    ...(item.title ? { caption: item.title } : {}),
  };
  if (already) return { id: already.id, url: already.source_url, ...meta };
  try {
    let bytes: Uint8Array = await readFile(`${sourceDir}/media/${item.file}`);
    let file = item.file;
    let mime = item.mime;
    if (mime.startsWith('image/') && mime !== 'image/gif' && (item.width ?? 0) > maxWidth) {
      try {
        // Certaines photos d'origine sont des JPEG légèrement corrompus : on les tolère.
        bytes = await sharp(bytes, { failOn: 'none' })
          .rotate()
          .resize({ width: maxWidth, withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();
        file = file.replace(/\.\w+$/, '.jpg');
        mime = 'image/jpeg';
      } catch {
        // En dernier recours, l'image est envoyée telle quelle.
      }
    }
    const title = item.title ?? file;
    const created = await wp.upload<WpMedia>(bytes, file, mime);
    await wp.post(`/wp/v2/media/${created.id}`, {
      title,
      alt_text: item.alt ?? '',
      ...(item.credit ? { caption: item.credit } : {}),
      meta: { _sal_source_id: `media:${item.id}` },
    });
    stats.created += 1;
    return { id: created.id, url: created.source_url, ...meta };
  } catch (error) {
    stats.failed += 1;
    failures.push(`média ${item.file} : ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
