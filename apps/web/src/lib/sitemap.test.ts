import { describe, expect, it } from 'vitest';
import { loadFixtures } from './content/fixtures.ts';
import { buildLlmsTxt } from './llms.ts';
import { buildSitemapXml, sitemapEntries } from './sitemap.ts';

const content = loadFixtures();
const site = 'https://www.saintamandlongpre.fr';

describe('plan du site', () => {
  const entries = sitemapEntries(content);
  const paths = entries.map((e) => e.path);

  it('liste l’accueil, les rubriques, les pages et les contenus', () => {
    expect(paths).toEqual(
      expect.arrayContaining(['/', '/demarches/', '/decouvrir/la-commune/', '/contact/']),
    );
    expect(paths).toContain(content.pages[0]!.path);
    expect(paths).toContain(`/actualites/${content.news[0]!.slug}/`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('exclut la recherche, les aperçus et la pagination', () => {
    expect(
      paths.some((p) => /^\/(recherche|preview)\//.test(p) || /^\/actualites\/\d+\/$/.test(p)),
    ).toBe(false);
  });

  it('produit un XML valide avec les dates de modification', () => {
    const xml = buildSitemapXml([{ path: '/a/', lastmod: '2026-09-29' }, { path: '/é/' }], site);
    expect(xml).toContain(
      '<loc>https://www.saintamandlongpre.fr/a/</loc><lastmod>2026-09-29</lastmod>',
    );
    expect(xml).toContain('<loc>https://www.saintamandlongpre.fr/%C3%A9/</loc>');
  });
});

describe('llms.txt', () => {
  const txt = buildLlmsTxt(content, site);
  it('commence par le titre et le résumé attendus', () => {
    expect(txt.startsWith('# Saint-Amand-Longpré\n\n> Site officiel')).toBe(true);
  });
  it('donne les faits essentiels et des liens absolus', () => {
    expect(txt).toContain('code Insee : 41199');
    expect(txt).toContain('Téléphone : 02 54 82 83 74');
    expect(txt).toContain('(https://www.saintamandlongpre.fr/contact/)');
  });
});
