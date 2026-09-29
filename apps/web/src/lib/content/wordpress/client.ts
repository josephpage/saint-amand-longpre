export interface GraphqlClientOptions {
  endpoint: string;
  /** Identifiants d'un mot de passe d'application (prévisualisation des brouillons). */
  auth?: { user: string; password: string };
  fetch?: typeof fetch;
}

class GraphqlError extends Error {}

export function createClient({ endpoint, auth, fetch: doFetch = fetch }: GraphqlClientOptions) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) headers.authorization = `Basic ${btoa(`${auth.user}:${auth.password}`)}`;

  async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await doFetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ query: document, variables }),
        });
        if (!res.ok) throw new GraphqlError(`WordPress a répondu ${res.status} (${endpoint})`);
        const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
        if (json.errors?.length) {
          throw new GraphqlError(json.errors.map((e) => e.message).join(' ; '));
        }
        if (!json.data) throw new GraphqlError('Réponse GraphQL vide');
        return json.data;
      } catch (error) {
        lastError = error;
        if (error instanceof GraphqlError) break;
        await new Promise((r) => setTimeout(r, attempt * 500));
      }
    }
    throw lastError;
  }

  /** Parcourt toutes les pages d'une connexion GraphQL (100 éléments par requête). */
  async function all<N>(document: string, root: string): Promise<N[]> {
    const nodes: N[] = [];
    let after: string | null = null;
    do {
      const data: Record<
        string,
        { nodes: N[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } }
      > = await query(document, { after });
      const connection = data[root];
      if (!connection) throw new GraphqlError(`Champ ${root} absent de la réponse`);
      nodes.push(...connection.nodes);
      after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
    } while (after);
    return nodes;
  }

  return { query, all };
}
