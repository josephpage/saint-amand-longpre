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
  it('ajoute les variantes avec et sans barre finale, sans doublon', () => {
    const file = buildRedirectsFile([
      { from: '/fr/actualites', to: '/actualites/' },
      { from: '/fr/actualites/', to: '/actualites/' },
      { from: '/', to: '/' },
    ]);
    expect(file.trim().split('\n').slice(1)).toEqual([
      '/fr/actualites /actualites/ 301',
      '/fr/actualites/ /actualites/ 301',
    ]);
  });
  it('encode les caractères spéciaux sans double encodage', () => {
    const file = buildRedirectsFile([
      { from: '/fr/association/1/21063/adil-%28adil-41%29', to: '/a/' },
    ]);
    expect(file).toContain('/fr/association/1/21063/adil-%28adil-41%29 /a/ 301');
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
