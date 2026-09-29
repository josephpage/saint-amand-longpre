import { existsSync } from 'node:fs';
import { copyFile, readdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import * as pagefind from 'pagefind';

/** Cherche le dossier qui contient les pages HTML générées (dist/ ou dist/client/). */
async function findHtmlRoot(dir: string): Promise<string> {
  if (existsSync(`${dir}/index.html`)) return dir;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(`${dir}/${entry.name}/index.html`))
      return `${dir}/${entry.name}`;
  }
  throw new Error(`Aucun index.html trouvé dans ${dir}`);
}

/**
 * Après le build :
 *  - renomme le fichier de redirections généré par la route /sal-redirects.txt
 *    en _redirects (format Cloudflare) ;
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
