import { describe, expect, it } from 'vitest';
import {
  documentsBlock,
  enhanceHtml,
  galleryBlock,
  textFromHtml,
  truncate,
} from './content/html.ts';
import { buildIcs } from './ics.ts';
import { signPreview, verifyPreview } from './preview-token.ts';
import { buildRedirectsFile } from './redirects.ts';

describe('redirections', () => {
  const lines = (file: string) =>
    file
      .trim()
      .split('\n')
      .filter((l) => l && !l.startsWith('#'));

  it('place les redirections exactes avant les règles génériques', () => {
    const file = buildRedirectsFile([{ from: '/fr/actualites', to: '/actualites/' }]);
    const all = lines(file);
    const firstGeneric = all.findIndex((l) => l.includes('*'));
    expect(all.slice(0, firstGeneric)).toContain('/fr/actualites /actualites/ 301');
    expect(all.slice(0, firstGeneric)).toContain('/fr/actualites/ /actualites/ 301');
    expect(all.slice(firstGeneric).every((l) => l.includes('*'))).toBe(true);
    expect(all).toContain('/fr/actualite/* /actualites/ 301');
    expect(all.at(-1)).toBe('/mobile/* / 301');
  });

  it('ignore l’accueil et les redirections vers elles-mêmes, sans doublon', () => {
    const file = buildRedirectsFile([
      { from: '/', to: '/' },
      { from: '/fr/a', to: '/a/' },
      { from: '/fr/a', to: '/b/' },
    ]);
    expect(lines(file).filter((l) => l.startsWith('/fr/a '))).toEqual(['/fr/a /a/ 301']);
    expect(lines(file).some((l) => l.startsWith('/ '))).toBe(false);
  });

  it('encode les caractères spéciaux sans double encodage', () => {
    const file = buildRedirectsFile([
      { from: '/fr/association/1/21063/adil-%28adil-41%29', to: '/a/' },
    ]);
    expect(file).toContain('/fr/association/1/21063/adil-%28adil-41%29 /a/ 301');
  });

  it('respecte les limites de Cloudflare en abandonnant d’abord les variantes', () => {
    const many = Array.from({ length: 1500 }, (_, i) => ({ from: `/fr/p/${i}`, to: `/n/${i}/` }));
    const all = lines(buildRedirectsFile(many));
    expect(all.filter((l) => !l.includes('*')).length).toBeLessThanOrEqual(2000);
    expect(all).toContain('/fr/p/1499 /n/1499/ 301');
    expect(() =>
      buildRedirectsFile(Array.from({ length: 2001 }, (_, i) => ({ from: `/x/${i}`, to: '/' }))),
    ).toThrow();
  });
});

describe('prévisualisation signée', () => {
  const secret = 'secret-de-test';
  it('accepte une signature valide', async () => {
    const sig = await signPreview(secret, 'post', 42, 2_000_000_000);
    const params = new URLSearchParams({ type: 'post', id: '42', exp: '2000000000', sig });
    expect(await verifyPreview(params, secret, 1_900_000_000)).toEqual({
      ok: true,
      type: 'post',
      id: 42,
    });
  });
  it('refuse une signature modifiée ou expirée', async () => {
    const sig = await signPreview(secret, 'post', 42, 2_000_000_000);
    const tampered = new URLSearchParams({ type: 'post', id: '43', exp: '2000000000', sig });
    expect(await verifyPreview(tampered, secret, 1_900_000_000)).toEqual({
      ok: false,
      reason: 'signature',
    });
    const expired = new URLSearchParams({ type: 'post', id: '42', exp: '2000000000', sig });
    expect(await verifyPreview(expired, secret, 2_100_000_000)).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(await verifyPreview(new URLSearchParams({ type: 'x' }), secret)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
  it('reproduit la signature de WordPress (hash_hmac sha256)', async () => {
    // Valeur calculée par PHP : hash_hmac('sha256', 'page:7:1700000000', 'abc')
    expect(await signPreview('abc', 'page', 7, 1_700_000_000)).toBe(
      'ea1bb427d7532a462140a173a43d548e205e82545fb90c085c12ca7856aec753',
    );
  });
});

describe('calendrier iCalendar', () => {
  it('produit des évènements valides', () => {
    const ics = buildIcs(
      [
        {
          id: '1',
          slug: 'forum',
          title: 'Forum, associations',
          start: '2026-10-10T09:00',
          end: '2026-10-10T13:00',
          allDay: false,
          location: 'Gymnase',
          html: '',
        },
        { id: '2', slug: 'fete', title: 'Fête', start: '2026-07-14T00:00', allDay: true, html: '' },
      ],
      'https://www.saintamandlongpre.fr',
      new Date('2026-09-28T10:00:00Z'),
    );
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20261010T090000');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20261010T130000');
    expect(ics).toContain('SUMMARY:Forum\\, associations');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260714');
    expect(ics).toContain('DTEND;VALUE=DATE:20260715');
    expect(ics).toContain('URL:https://www.saintamandlongpre.fr/agenda/forum/');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe('HTML éditorial', () => {
  it('produit des blocs documents et galerie échappés', () => {
    expect(documentsBlock([{ url: '/a.pdf', title: 'Tarifs <2026>' }])).toContain(
      'Tarifs &lt;2026&gt;',
    );
    expect(documentsBlock([])).toBe('');
    expect(galleryBlock([{ src: '/a.jpg', alt: 'Vue "aérienne"' }])).toContain(
      'alt="Vue &quot;aérienne&quot;"',
    );
  });
  it('ajoute le chargement différé et rel sur les liens externes', () => {
    const html = enhanceHtml(
      '<img src="a.jpg"><a href="https://exemple.fr">x</a><a href="https://www.saintamandlongpre.fr/x">y</a>',
      'www.saintamandlongpre.fr',
    );
    expect(html).toContain('<img loading="lazy" decoding="async" src="a.jpg">');
    expect(html).toContain('<a href="https://exemple.fr" rel="noopener noreferrer">');
    expect(html).toContain('<a href="https://www.saintamandlongpre.fr/x">');
  });
  it('extrait et tronque le texte', () => {
    expect(textFromHtml('<p>Bonjour&nbsp;<strong>à tous</strong></p>')).toBe('Bonjour à tous');
    expect(truncate('un deux trois quatre', 10)).toBe('un deux…');
  });
});
