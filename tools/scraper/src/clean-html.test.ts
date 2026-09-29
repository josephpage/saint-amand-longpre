import { describe, expect, it } from 'vitest';
import { cleanHtml, excerpt, htmlToText, rewriteUrls } from './clean-html.ts';

const BASE = 'http://www.saintamandlongpre.fr/fr/information/14197/carte-nationale-identite';

describe('cleanHtml', () => {
  it('retire les styles, spans et images locales cassées', () => {
    const html =
      '<p style="text-align: justify;"><span style="font-size: small;"><img src="file:///C:/moz-screenshot.png" alt="" />La liste officielle.<br /></span></p>';
    expect(cleanHtml(html, BASE)).toBe('<p>La liste officielle.</p>');
  });

  it('convertit b et i, supprime les paragraphes vides', () => {
    const html = '<p><b>Important</b> et <i>utile</i></p><p>&nbsp;</p><p> </p>';
    expect(cleanHtml(html, BASE)).toBe('<p><strong>Important</strong> et <em>utile</em></p>');
  });

  it('rend les liens absolus et retire les attributs inutiles', () => {
    const html = '<a href="/fr/contact" class="x" onclick="evil()">Contact</a>';
    expect(cleanHtml(html, BASE)).toBe(
      '<a href="http://www.saintamandlongpre.fr/fr/contact">Contact</a>',
    );
  });

  it('supprime les scripts et les liens javascript', () => {
    const html = '<p>Texte<script>alert(1)</script> <a href="javascript:void(0)">lien</a></p>';
    expect(cleanHtml(html, BASE)).toBe('<p>Texte lien</p>');
  });

  it('limite les sauts de ligne consécutifs', () => {
    const html = '<p>a<br><br><br><br>b</p>';
    expect(cleanHtml(html, BASE)).toBe('<p>a<br><br>b</p>');
  });
});

describe('htmlToText et excerpt', () => {
  it('produit un texte lisible', () => {
    expect(htmlToText('<p>Un</p><ul><li>deux</li><li>trois</li></ul>')).toBe('Un deux trois');
  });
  it('coupe sur un mot', () => {
    const text = `<p>${'mot '.repeat(80)}</p>`;
    const result = excerpt(text, 30);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(31);
  });
});

describe('rewriteUrls', () => {
  it('remplace les URL retournées par le résolveur', () => {
    const html = '<p><a href="http://a/x.pdf">doc</a><img src="http://a/y.jpg" alt=""></p>';
    const out = rewriteUrls(html, (url, tag) =>
      tag === 'img' ? 'media:1' : url.endsWith('.pdf') ? 'media:2' : null,
    );
    expect(out).toContain('href="media:2"');
    expect(out).toContain('src="media:1"');
  });
});
