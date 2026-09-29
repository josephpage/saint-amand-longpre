/**
 * Construit le jeu de données de test (data/fixtures) à partir du scraping.
 *
 * Usage : pnpm fixtures
 *
 * Le jeu de données est versionné : il sert au développement sans WordPress,
 * aux tests de bout en bout et à l'alimentation d'un WordPress local
 * (pnpm cms:import --source fixtures). Pour rester léger :
 *  - les images sont réduites (1600 px maximum, WebP) ;
 *  - tous les documents pointent vers un même PDF de démonstration ;
 *  - seules les actualités et séances récentes sont conservées.
 * Des évènements à venir et une alerte d'exemple sont ajoutés, signalés comme tels.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { snapshotSchema, type Snapshot, type SnapshotEvent, type SnapshotMedia } from '@sal/model';
import { FIXTURES_DIR, MEDIA_DIR, SCRAPE_DIR } from './config.ts';

const NEWS_LIMIT = 30;
const MEETINGS_LIMIT = 24;
const PLACEHOLDER_PDF_ID = 'document-demo';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Prochain jour de la semaine voulu (6 = samedi) après `from` + `days`. */
function nextWeekday(from: Date, days: number, weekday: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  while (d.getDay() !== weekday % 7) d.setDate(d.getDate() + 1);
  return isoDay(d);
}

function exampleEvents(now: Date): SnapshotEvent[] {
  const note = "<p><em>Évènement d'exemple du jeu de données de test.</em></p>";
  return [
    {
      title: 'Forum des associations',
      slug: 'exemple-forum-des-associations',
      start: `${nextWeekday(now, 12, 6)}T09:00`,
      end: `${nextWeekday(now, 12, 6)}T13:00`,
      allDay: false,
      location: 'Gymnase',
      address: 'Saint-Amand-Longpré',
      html: `${note}<p>Venez découvrir les associations sportives, culturelles et solidaires de la commune et vous inscrire pour la saison.</p>`,
      excerpt: 'Découvrez les associations de la commune et inscrivez-vous pour la saison.',
      attachments: [],
    },
    {
      title: 'Conseil municipal',
      slug: 'exemple-conseil-municipal',
      start: `${nextWeekday(now, 18, 1)}T19:00`,
      allDay: false,
      location: "Salle d'honneur de la mairie",
      address: '18 rue Jules Ferry, 41310 Saint-Amand-Longpré',
      html: `${note}<p>La séance est publique. L'ordre du jour est affiché en mairie et publié sur le site.</p>`,
      excerpt: 'Séance publique du conseil municipal.',
      attachments: [],
    },
    {
      title: 'Marche nocturne',
      slug: 'exemple-marche-nocturne',
      start: `${nextWeekday(now, 30, 5)}T20:00`,
      allDay: false,
      location: 'Départ de la salle des fêtes',
      html: `${note}<p>Parcours de 6 km, lampe frontale conseillée. Les bénéfices sont reversés à une association.</p>`,
      excerpt: 'Parcours de 6 km, lampe frontale conseillée.',
      attachments: [],
    },
    {
      title: 'Cérémonie commémorative',
      slug: 'exemple-ceremonie-commemorative',
      start: `${nextWeekday(now, 45, 3)}T11:00`,
      allDay: false,
      location: 'Monument aux morts',
      html: `${note}<p>Rassemblement devant la mairie puis dépôt de gerbe au monument aux morts.</p>`,
      excerpt: 'Dépôt de gerbe au monument aux morts.',
      attachments: [],
    },
  ];
}

/** PDF d'une page, minimal et valide, servant de document de démonstration. */
function placeholderPdf(): Buffer {
  const text = 'Document de demonstration du jeu de donnees de test.';
  const stream = `BT /F1 14 Tf 60 780 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

async function main() {
  const source = `${SCRAPE_DIR}/snapshot.json`;
  if (!existsSync(source)) throw new Error('Lancez d’abord « pnpm scrape ».');
  const full = snapshotSchema.parse(JSON.parse(await readFile(source, 'utf8')));
  const now = new Date();

  const news = full.news.slice(0, NEWS_LIMIT);
  const meetings = full.meetings.slice(0, MEETINGS_LIMIT);
  const snapshot: Snapshot = {
    ...full,
    scrapedAt: full.scrapedAt,
    news,
    meetings,
    events: [...exampleEvents(now), ...full.events],
    alerts: [
      {
        slug: 'exemple-vigilance-canicule',
        title: 'Vigilance canicule',
        message:
          "Personnes âgées ou isolées : inscrivez-vous au registre communal pour être contactées en cas de fortes chaleurs. (Alerte d'exemple du jeu de données de test.)",
        level: 'vigilance',
        link: '/contact/',
        expires: '2099-12-31',
      },
    ],
  };

  // Médias réellement utilisés par le jeu de données.
  const used = new Set<string>();
  const collect = (html: string) => {
    for (const m of html.matchAll(/media:([a-f0-9]+)/g)) used.add(m[1]!);
  };
  const all = [
    ...snapshot.pages,
    ...snapshot.news,
    ...snapshot.events,
    ...snapshot.meetings,
    ...snapshot.rooms,
    ...snapshot.directory,
  ];
  for (const item of all) collect(item.html);
  for (const p of snapshot.pages) {
    p.attachments.forEach((a) => used.add(a.mediaId));
    p.gallery.forEach((id) => used.add(id));
  }
  for (const n of snapshot.news) {
    n.attachments.forEach((a) => used.add(a.mediaId));
    n.gallery.forEach((id) => used.add(id));
    if (n.imageId) used.add(n.imageId);
  }
  for (const e of snapshot.events) e.attachments.forEach((a) => used.add(a.mediaId));
  for (const m of snapshot.meetings) if (m.reportId) used.add(m.reportId);
  for (const r of snapshot.rooms) {
    r.photoIds.forEach((id) => used.add(id));
    r.attachments.forEach((a) => used.add(a.mediaId));
  }
  for (const e of snapshot.elected) if (e.photoId) used.add(e.photoId);
  for (const d of snapshot.directory) if (d.logoId) used.add(d.logoId);
  if (snapshot.settings.heroImageId) used.add(snapshot.settings.heroImageId);

  const outMedia = `${FIXTURES_DIR}/media`;
  await rm(outMedia, { recursive: true, force: true });
  await mkdir(outMedia, { recursive: true });
  const pdf = placeholderPdf();
  await writeFile(`${outMedia}/${PLACEHOLDER_PDF_ID}.pdf`, pdf);

  const media: SnapshotMedia[] = [
    {
      id: PLACEHOLDER_PDF_ID,
      sourceUrl: 'fixtures://document-demo.pdf',
      file: `${PLACEHOLDER_PDF_ID}.pdf`,
      mime: 'application/pdf',
      bytes: pdf.length,
      title: 'Document de démonstration',
    },
  ];
  const documentIds = new Map<string, string>();
  for (const m of full.media) {
    if (!used.has(m.id)) continue;
    if (!m.mime.startsWith('image/')) {
      documentIds.set(m.id, PLACEHOLDER_PDF_ID);
      continue;
    }
    const input = await readFile(`${MEDIA_DIR}/${m.file}`);
    const { data, info } = await sharp(input)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer({ resolveWithObject: true });
    const file = `${m.id}.webp`;
    await writeFile(`${outMedia}/${file}`, data);
    media.push({
      ...m,
      file,
      mime: 'image/webp',
      bytes: data.length,
      width: info.width,
      height: info.height,
    });
  }

  // Tous les documents pointent vers le PDF de démonstration.
  const remapDoc = (id: string) => documentIds.get(id) ?? id;
  const remapHtml = (html: string) =>
    html.replace(/media:([a-f0-9]+)/g, (all, id: string) => `media:${remapDoc(id)}`);
  for (const item of all) item.html = remapHtml(item.html);
  for (const p of snapshot.pages)
    p.attachments = p.attachments.map((a) => ({ ...a, mediaId: remapDoc(a.mediaId) }));
  for (const n of snapshot.news)
    n.attachments = n.attachments.map((a) => ({ ...a, mediaId: remapDoc(a.mediaId) }));
  for (const e of snapshot.events)
    e.attachments = e.attachments.map((a) => ({ ...a, mediaId: remapDoc(a.mediaId) }));
  for (const r of snapshot.rooms)
    r.attachments = r.attachments.map((a) => ({ ...a, mediaId: remapDoc(a.mediaId) }));
  for (const m of snapshot.meetings) if (m.reportId) m.reportId = remapDoc(m.reportId);

  snapshot.media = media.sort((a, b) => a.id.localeCompare(b.id));
  const valid = snapshotSchema.parse(snapshot);
  await writeFile(`${FIXTURES_DIR}/snapshot.json`, `${JSON.stringify(valid, null, 2)}\n`);
  const size = media.reduce((sum, m) => sum + m.bytes, 0);
  console.log(
    `Jeu de données écrit dans data/fixtures : ${valid.pages.length} pages, ${valid.news.length} actualités, ` +
      `${valid.events.length} évènements, ${valid.meetings.length} séances, ${media.length} médias (${(size / 1e6).toFixed(1)} Mo).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
