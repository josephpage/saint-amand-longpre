import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import type { SnapshotMedia } from '@sal/model';
import { MEDIA_DIR, SCRAPE_DIR } from './config.ts';
import { fetchBinary } from './http.ts';

const MEDIA_HOSTS = /(^|\.)reseaudescommunes\.fr$|(^|\.)saintamandlongpre\.fr$/;
const THUMB = /^https?:\/\/thumbs\.reseaudescommunes\.fr\/thumbs\/(\d+)\/\d+x\d+\/(.+)$/;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

/** Type réel d'un fichier quand le serveur répond « application/octet-stream ». */
function sniffMime(bytes: Buffer, declared: string, url: string): string {
  if (declared && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream')
    return declared;
  const head = bytes.subarray(0, 8);
  if (head.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  if (head.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (head.subarray(0, 4).toString('hex') === 'd0cf11e0') return 'application/msword';
  if (head.subarray(0, 2).toString('latin1') === 'PK') {
    if (/\.xlsx$/i.test(url))
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return declared || 'application/octet-stream';
}

/** Vrai si l'URL désigne un fichier hébergé par l'ancien site (image ou document). */
export function isMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!MEDIA_HOSTS.test(u.hostname)) return false;
    return /\/(cities\/\d+\/(images|documents|banner|logo)|thumbs\/\d+)\//.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * URL candidates pour obtenir la meilleure résolution : les vignettes de
 * l'ancien site sont servies par un service de redimensionnement, l'original
 * est en général disponible sur le CDN.
 */
function candidateUrls(url: string): string[] {
  const m = THUMB.exec(url);
  if (!m) return [url];
  const [, city, file] = m;
  return [
    `http://cdn1_3.reseaudescommunes.fr/cities/${city}/images/${file}`,
    `http://thumbs.reseaudescommunes.fr/thumbs/${city}/1600x1200/${file}`,
    url,
  ];
}

const mediaId = (url: string) =>
  createHash('sha1').update(candidateUrls(url)[0]!).digest('hex').slice(0, 12);

interface Pending {
  url: string;
  /** Télécharge exactement cette URL, sans chercher l'original. */
  exact?: boolean;
  title?: string;
  alt?: string;
}

const MANIFEST = `${SCRAPE_DIR}/media-manifest.json`;

/** Registre des médias rencontrés pendant le scraping, téléchargés à la fin. */
export class MediaStore {
  private pending = new Map<string, Pending>();
  private done = new Map<string, SnapshotMedia>();

  async load(): Promise<void> {
    if (!existsSync(MANIFEST)) return;
    const saved = JSON.parse(await readFile(MANIFEST, 'utf8')) as SnapshotMedia[];
    for (const m of saved) {
      if (existsSync(`${MEDIA_DIR}/${m.file}`)) this.done.set(m.id, m);
    }
  }

  /** Enregistre un média et retourne son identifiant. */
  register(url: string, meta: { title?: string; alt?: string } = {}): string {
    const id = mediaId(url);
    const existing = this.pending.get(id);
    this.pending.set(id, {
      url,
      title: existing?.title ?? meta.title,
      alt: existing?.alt ?? meta.alt,
    });
    return id;
  }

  /** Enregistre une URL précise (par exemple une vignette agrandie). */
  registerExact(url: string, meta: { title?: string; alt?: string } = {}): string {
    const id = createHash('sha1').update(`exact:${url}`).digest('hex').slice(0, 12);
    this.pending.set(id, { url, exact: true, ...meta });
    return id;
  }

  get(id: string): SnapshotMedia | undefined {
    return this.done.get(id);
  }

  /** Télécharge tous les médias enregistrés et retourne ceux qui sont disponibles. */
  async downloadAll(onProgress?: (done: number, total: number) => void): Promise<SnapshotMedia[]> {
    await mkdir(MEDIA_DIR, { recursive: true });
    const entries = [...this.pending.entries()];
    let count = 0;
    for (const [id, item] of entries) {
      count += 1;
      onProgress?.(count, entries.length);
      const cached = this.done.get(id);
      if (cached) {
        const updated = {
          ...cached,
          title: item.title ?? cached.title,
          alt: item.alt ?? cached.alt,
        };
        if (cached.mime === 'application/octet-stream') {
          const bytes = await readFile(`${MEDIA_DIR}/${cached.file}`);
          updated.mime = sniffMime(bytes, cached.mime, cached.sourceUrl);
          if (updated.mime.startsWith('image/')) {
            const meta = await sharp(bytes).metadata();
            if (meta.width) updated.width = meta.width;
            if (meta.height) updated.height = meta.height;
          }
        }
        this.done.set(id, updated);
        continue;
      }
      const media = await this.download(id, item);
      if (media) this.done.set(id, media);
    }
    const result = [...this.done.values()].filter((m) => this.pending.has(m.id));
    await writeFile(MANIFEST, JSON.stringify([...this.done.values()], null, 2));
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }

  private async download(id: string, item: Pending): Promise<SnapshotMedia | null> {
    for (const candidate of item.exact ? [item.url] : candidateUrls(item.url)) {
      const res = await fetchBinary(candidate);
      if (!res || res.bytes.length === 0) continue;
      const mime = sniffMime(
        res.bytes,
        res.contentType.split(';')[0]!.trim().toLowerCase(),
        candidate,
      );
      if (mime.startsWith('text/html')) continue;
      const ext = EXTENSIONS[mime] ?? candidate.split('.').pop()?.toLowerCase() ?? 'bin';
      const file = `${id}.${ext}`;
      await writeFile(`${MEDIA_DIR}/${file}`, res.bytes);
      const media: SnapshotMedia = {
        id,
        sourceUrl: candidate,
        file,
        mime,
        bytes: res.bytes.length,
      };
      if (item.title) media.title = item.title;
      if (item.alt) media.alt = item.alt;
      if (mime.startsWith('image/')) {
        try {
          const meta = await sharp(res.bytes).metadata();
          if (meta.width) media.width = meta.width;
          if (meta.height) media.height = meta.height;
        } catch {
          continue;
        }
      }
      return media;
    }
    console.warn(`  ! média introuvable : ${item.url}`);
    return null;
  }
}
