/**
 * Vérifie que toutes les anciennes adresses du site mènent à une page existante
 * du nouveau site, par une redirection permanente.
 *
 * Usage : node tools/scraper/src/check-redirects.ts [--base http://localhost:4390]
 *
 * Adresses testées : toutes celles du snapshot (data/scrape/snapshot.json),
 * leurs variantes avec barre finale, et des adresses anciennes fictives dans
 * chaque rubrique (pagination, identifiant inconnu) pour les règles de secours.
 * À lancer contre un site construit avec le contenu complet (WordPress importé
 * depuis le scraping) ou contre la production après la bascule.
 */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { LEGACY_FALLBACKS, snapshotSchema } from '@sal/model';
import { SCRAPE_DIR } from './config.ts';

const { values } = parseArgs({
  options: { base: { type: 'string', default: 'http://localhost:4390' } },
});
const base = values.base!.replace(/\/$/, '');

interface Result {
  from: string;
  status: number;
  location?: string;
  final?: number;
  finalPath?: string;
}

/** Requête avec nouvelles tentatives (un serveur local peut saturer brièvement). */
async function get(url: string | URL): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function follow(path: string): Promise<Result> {
  const first = await get(`${base}${encodeURI(path).replace(/%25([0-9A-F]{2})/gi, '%$1')}`);
  const location = first.headers.get('location') ?? undefined;
  if (!location) return { from: path, status: first.status };
  let url = new URL(location, base);
  let res = await get(url);
  for (let hops = 1; hops < 5 && res.status >= 300 && res.status < 400; hops += 1) {
    url = new URL(res.headers.get('location')!, url);
    res = await get(url);
  }
  return { from: path, status: first.status, location, final: res.status, finalPath: url.pathname };
}

async function main() {
  const snapshot = snapshotSchema.parse(
    JSON.parse(await readFile(`${SCRAPE_DIR}/snapshot.json`, 'utf8')),
  );
  const paths = new Set<string>();
  for (const { from } of snapshot.redirects) {
    paths.add(from);
    if (!from.endsWith('/')) paths.add(`${from}/`);
  }
  // Adresses jamais vues : doivent être rattrapées par les règles de secours.
  for (const [prefix] of LEGACY_FALLBACKS) paths.add(`${prefix}999999/adresse-inconnue`);
  paths.add('/fr/actualites/42');
  paths.add('/fr/associations/1/999/categorie-inconnue');

  const list = [...paths].sort();
  const results: Result[] = [];
  const BATCH = 6;
  for (let i = 0; i < list.length; i += BATCH) {
    results.push(...(await Promise.all(list.slice(i, i + BATCH).map(follow))));
  }

  const notPermanent = results.filter((r) => r.status !== 301);
  const broken = results.filter((r) => r.status === 301 && r.final !== 200);
  const fallbackHits = results.filter((r) => r.status === 301 && r.final === 200);
  console.log(`${results.length} anciennes adresses testées sur ${base}`);
  console.log(`  ✓ ${fallbackHits.length} redirigées (301) vers une page existante`);
  if (notPermanent.length) {
    console.log(`  ✗ ${notPermanent.length} sans redirection permanente :`);
    for (const r of notPermanent.slice(0, 40)) console.log(`      ${r.status} ${r.from}`);
  }
  if (broken.length) {
    console.log(`  ✗ ${broken.length} redirigées vers une page absente :`);
    for (const r of broken.slice(0, 40))
      console.log(`      ${r.from} → ${r.finalPath} (${r.final})`);
  }
  if (notPermanent.length || broken.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
