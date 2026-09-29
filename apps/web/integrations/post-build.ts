import { existsSync } from 'node:fs';
import { copyFile, readdir, readFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import * as pagefind from 'pagefind';
import { NOT_IN_SITEMAP } from '../src/lib/sitemap.ts';

/** Cherche le dossier qui contient les pages HTML générées (dist/ ou dist/client/). */
async function findHtmlRoot(dir: string): Promise<string> {
  if (existsSync(`${dir}/index.html`)) return dir;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(`${dir}/${entry.name}/index.html`))
      return `${dir}/${entry.name}`;
  }
  throw new Error(`Aucun index.html trouvé dans ${dir}`);
}

/** Chemins publics de toutes les pages HTML générées. */
async function htmlPaths(root: string, dir = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(`${root}/${dir}`, { withFileTypes: true })) {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('_') && entry.name !== 'pagefind')
        out.push(...(await htmlPaths(root, rel)));
    } else if (entry.name === 'index.html') {
      out.push(`/${dir ? `${dir}/` : ''}`);
    }
  }
  return out;
}

/** Échoue si une page publiée manque au plan du site (hors pages exclues volontairement). */
async function checkSitemap(root: string) {
  const xml = await readFile(`${root}/sitemap.xml`, 'utf8');
  const listed = new Set(
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodeURI(new URL(m[1]!).pathname)),
  );
  const missing = (await htmlPaths(root)).filter(
    (p) => !listed.has(decodeURI(p)) && !NOT_IN_SITEMAP.some((re) => re.test(p)),
  );
  if (missing.length) {
    throw new Error(`Pages absentes du plan du site (src/lib/sitemap.ts) :\n${missing.join('\n')}`);
  }
}

/**
 * Après le build :
 *  - renomme le fichier de redirections généré par la route /sal-redirects.txt
 *    en _redirects (format Cloudflare) ;
 *  - vérifie que le plan du site liste toutes les pages publiées ;
 *  - indexe les pages pour la recherche Pagefind ;
 *  - copie les secrets locaux (.dev.vars) à côté de la configuration générée,
 *    pour `astro preview` (wrangler ne les envoie jamais lors d'un déploiement).
 */
export function postBuild(): AstroIntegration {
  return {
    name: 'sal:post-build',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = await findHtmlRoot(fileURLToPath(dir).replace(/\/$/, ''));

        const generated = `${root}/sal-redirects.txt`;
        if (existsSync(generated)) {
          await rename(generated, `${root}/_redirects`);
          logger.info('Fichier _redirects écrit');
        }

        await checkSitemap(root);
        logger.info('Plan du site vérifié : toutes les pages publiées y figurent');

        const devVars = fileURLToPath(new URL('../.dev.vars', import.meta.url));
        const serverDir = fileURLToPath(new URL('../dist/server/', import.meta.url));
        if (existsSync(devVars) && existsSync(serverDir))
          await copyFile(devVars, `${serverDir}.dev.vars`);

        const { index, errors } = await pagefind.createIndex({ forceLanguage: 'fr' });
        if (!index) throw new Error(`Pagefind : ${errors.join(', ')}`);
        const added = await index.addDirectory({ path: root });
        await index.writeFiles({ outputPath: `${root}/pagefind` });
        await pagefind.close();
        logger.info(`Recherche : ${added.page_count} pages indexées`);
      },
    },
  };
}
