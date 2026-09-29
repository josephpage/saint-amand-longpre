/**
 * Écrit apps/web/.dev.vars à partir des identifiants créés par `pnpm cms:setup`,
 * pour que le site local puisse prévisualiser les brouillons du WordPress local.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../apps/cms/.data/credentials.env', import.meta.url);
if (!existsSync(source)) {
  console.error('Identifiants introuvables : lancez d’abord « pnpm cms:setup ».');
  process.exit(1);
}
const values = Object.fromEntries(
  readFileSync(source, 'utf8')
    .split('\n')
    .filter((line) => /^\w+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);
writeFileSync(
  new URL('../apps/web/.dev.vars', import.meta.url),
  `# Généré par scripts/dev-vars.ts — secrets locaux, jamais versionnés\nWP_PREVIEW_USER=${values.WP_USER}\nWP_PREVIEW_APP_PASSWORD=${values.WP_APP_PASSWORD}\n`,
);
console.log('apps/web/.dev.vars écrit.');
