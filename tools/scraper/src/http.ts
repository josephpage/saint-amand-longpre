import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CACHE_DIR, REQUEST_DELAY_MS, USER_AGENT } from './config.ts';

let lastRequestAt = 0;

async function politeDelay(): Promise<void> {
  const wait = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

const cacheKey = (url: string) => createHash('sha1').update(url).digest('hex');

export interface FetchOptions {
  /** Ignore le cache disque et interroge à nouveau le serveur. */
  refresh?: boolean;
}

export class HttpError extends Error {
  readonly status: number;
  constructor(url: string, status: number) {
    super(`HTTP ${status} pour ${url}`);
    this.status = status;
  }
}

async function request(url: string, attempt = 1): Promise<Response> {
  await politeDelay();
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'fr-FR,fr;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status >= 500 && attempt < 3) return request(url, attempt + 1);
    return res;
  } catch (error) {
    if (attempt < 3) return request(url, attempt + 1);
    throw error;
  }
}

/**
 * Récupère une page HTML, en la mettant en cache sur disque pour que les
 * exécutions suivantes du scraper ne sollicitent plus l'ancien serveur.
 */
export async function fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true });
  const file = `${CACHE_DIR}/${cacheKey(url)}.html`;
  if (!options.refresh && existsSync(file)) return readFile(file, 'utf8');

  const res = await request(url);
  if (!res.ok) throw new HttpError(url, res.status);
  const html = await res.text();
  await writeFile(file, html);
  return html;
}

/** Télécharge un fichier binaire (image, PDF). */
export async function fetchBinary(
  url: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const res = await request(url);
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType: res.headers.get('content-type') ?? 'application/octet-stream' };
}
