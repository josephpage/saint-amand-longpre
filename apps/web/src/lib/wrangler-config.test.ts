import { unstable_readConfig } from 'wrangler';
import { describe, expect, it } from 'vitest';

const dir = new URL('../../', import.meta.url).pathname;
const read = (file: string, env?: string) =>
  unstable_readConfig({ config: `${dir}${file}`, ...(env ? { env } : {}) }, { hideWarnings: true });

describe('configurations Cloudflare', () => {
  it('le build de production et le projet Pages ont les mêmes variables', () => {
    expect(read('wrangler.astro.jsonc', 'production').vars).toEqual(
      read('wrangler.jsonc', 'production').vars,
    );
  });

  it('le développement et le runtime Pages local ont les mêmes variables', () => {
    expect(read('wrangler.astro.jsonc').vars).toEqual(read('wrangler.jsonc').vars);
  });

  it('les aperçus Pages n’envoient jamais d’e-mail', () => {
    expect(read('wrangler.jsonc', 'preview').vars).toMatchObject({ MAIL_DRY_RUN: 'true' });
  });

  it('le projet Pages sert la sortie du build', () => {
    const config = read('wrangler.jsonc');
    expect(config.pages_build_output_dir).toMatch(/dist\/client$/);
    expect(config.compatibility_date).toBe(read('wrangler.astro.jsonc').compatibility_date);
  });
});
