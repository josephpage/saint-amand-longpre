import { useEffect, useRef, useState, type SubmitEvent } from 'react';

interface PagefindResult {
  url: string;
  excerpt: string;
  meta: { title?: string };
}
interface Pagefind {
  search: (q: string) => Promise<{ results: { data: () => Promise<PagefindResult> }[] }>;
  options: (o: Record<string, unknown>) => Promise<void>;
}

let pagefind: Promise<Pagefind | null> | undefined;
function loadPagefind(): Promise<Pagefind | null> {
  // L'index est généré au build (dist/pagefind) : absent en développement.
  pagefind ??= import(/* @vite-ignore */ `${'/pagefind/'}pagefind.js`)
    .then(async (mod: Pagefind) => {
      await mod.options({ excerptLength: 24 });
      return mod;
    })
    .catch(() => null);
  return pagefind;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; query: string; results: PagefindResult[] }
  | { status: 'unavailable' };

/** Recherche plein texte dans les pages du site (Pagefind, sans serveur). */
/** Requête passée dans l'adresse (?q=), par exemple depuis la page 404. */
const queryFromUrl = () =>
  typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('q') ?? '');

export default function Search() {
  const [query, setQuery] = useState(queryFromUrl);
  const [state, setState] = useState<State>({ status: 'idle' });
  const liveRef = useRef<HTMLParagraphElement>(null);

  async function run(q: string) {
    const term = q.trim();
    if (!term) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const pf = await loadPagefind();
    if (!pf) {
      setState({ status: 'unavailable' });
      return;
    }
    const search = await pf.search(term);
    const results = await Promise.all(search.results.slice(0, 20).map((r) => r.data()));
    setState({ status: 'done', query: term, results });
  }

  const initial = useRef(query);
  useEffect(() => {
    if (initial.current) void run(initial.current);
  }, []);

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    window.history.replaceState(null, '', url);
    void run(query);
  }

  return (
    <div className="grid gap-6">
      <form
        role="search"
        onSubmit={onSubmit}
        className="flex overflow-hidden rounded-lg border-2 border-encre bg-white focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-terracotta"
      >
        <label htmlFor="recherche" className="sr-only">
          Rechercher sur le site
        </label>
        <input
          id="recherche"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Carte d’identité, salle des fêtes, conseil municipal…"
          className="min-w-0 flex-1 px-4 py-3 text-base focus:outline-none"
          autoComplete="off"
        />
        <button
          type="submit"
          className="bg-terracotta px-5 font-bold text-white hover:bg-terracotta-dark"
        >
          Rechercher
        </button>
      </form>

      <p ref={liveRef} aria-live="polite" className="text-muted">
        {state.status === 'loading' && 'Recherche en cours…'}
        {state.status === 'done' &&
          (state.results.length === 0
            ? `Aucun résultat pour « ${state.query} ». Essayez un autre mot, ou appelez la mairie.`
            : `${state.results.length} résultat${state.results.length > 1 ? 's' : ''} pour « ${state.query} »`)}
        {state.status === 'unavailable' &&
          'La recherche est disponible sur le site publié (index généré au build).'}
      </p>

      {state.status === 'done' && state.results.length > 0 && (
        <ol className="grid gap-4">
          {state.results.map((r) => (
            <li key={r.url} className="card p-5">
              <h2 className="text-lg">
                <a href={r.url} className="text-encre">
                  {r.meta.title ?? r.url}
                </a>
              </h2>
              {/* L'extrait est produit par Pagefind à partir des pages du site (balises <mark> uniquement). */}
              <p
                className="mt-1 text-sm text-muted [&_mark]:bg-terracotta-soft [&_mark]:text-encre"
                dangerouslySetInnerHTML={{ __html: r.excerpt }}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
