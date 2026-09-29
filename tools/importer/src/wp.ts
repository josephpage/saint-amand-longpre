/** Client minimal de l'API REST WordPress (authentification par mot de passe d'application). */

class WpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface WpClientOptions {
  url: string;
  user: string;
  password: string;
  fetch?: typeof fetch;
}

export function createWpClient({ url, user, password, fetch: doFetch = fetch }: WpClientOptions) {
  const base = `${url.replace(/\/$/, '')}/wp-json`;
  const auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      const isBinary = body instanceof Uint8Array;
      const res = await doFetch(`${base}${path}`, {
        method,
        headers: {
          authorization: auth,
          ...(body !== undefined && !isBinary ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        ...(body !== undefined
          ? { body: isBinary ? (body as Uint8Array) : JSON.stringify(body) }
          : {}),
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      const text = await res.text();
      throw new WpError(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`, res.status);
    }
  }

  /** Liste complète d'une collection, toutes pages et tous statuts confondus. */
  async function list<T>(path: string, query = ''): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page += 1) {
      const sep = path.includes('?') ? '&' : '?';
      try {
        const batch = await request<T[]>('GET', `${path}${sep}per_page=100&page=${page}${query}`);
        items.push(...batch);
        if (batch.length < 100) return items;
      } catch (error) {
        // WordPress répond 400 quand on dépasse la dernière page.
        if (error instanceof WpError && error.status === 400) return items;
        throw error;
      }
    }
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
    /** Place un contenu dans la corbeille de WordPress (récupérable depuis l'administration). */
    trash: <T>(path: string) => request<T>('DELETE', path),
    upload: <T>(bytes: Uint8Array, filename: string, mime: string) =>
      request<T>('POST', '/wp/v2/media', bytes, {
        'content-type': mime,
        'content-disposition': `attachment; filename="${filename}"`,
      }),
    list,
  };
}

export type WpClient = ReturnType<typeof createWpClient>;
