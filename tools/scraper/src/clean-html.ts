import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'h2',
    'h3',
    'h4',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'a',
    'img',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'blockquote',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    b: 'strong',
    i: 'em',
    h1: 'h2',
    h5: 'h4',
    h6: 'h4',
  },
  exclusiveFilter: (frame) => {
    if (frame.tag === 'img') {
      const src = frame.attribs.src ?? '';
      return !src || src.startsWith('file:') || /pas-de-photo|page_white_acrobat/.test(src);
    }
    return false;
  },
};

const isBlank = (text: string) => text.replace(/[\s\u00a0]/g, '') === '';

/**
 * Nettoie un fragment HTML de l'ancien site : supprime les styles en ligne,
 * les balises de mise en forme, les images cassées et les paragraphes vides,
 * et rend les liens absolus.
 */
export function cleanHtml(html: string, baseUrl: string): string {
  const sanitized = sanitizeHtml(html, SANITIZE_OPTIONS);
  const $ = cheerio.load(sanitized, null, false);

  $('a[href], img[src]').each((_, el) => {
    const attr = el.tagName === 'a' ? 'href' : 'src';
    const value = $(el).attr(attr);
    if (!value) return;
    try {
      $(el).attr(attr, new URL(value, baseUrl).toString());
    } catch {
      $(el).removeAttr(attr);
    }
  });

  // Liens sans destination ni texte : on garde le texte seul.
  $('a:not([href])').each((_, el) => {
    $(el).replaceWith($(el).html() ?? '');
  });

  $('p, li, h2, h3, h4, td, th').each((_, el) => {
    const node = $(el);
    // Retire les <br> en début et fin de bloc.
    let html = (node.html() ?? '').replace(
      /^(\s|&nbsp;|<br\s*\/?>)+|(\s|&nbsp;|<br\s*\/?>)+$/g,
      '',
    );
    html = html.replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>');
    node.html(html);
  });

  $('p, h2, h3, h4, li, strong, em').each((_, el) => {
    const node = $(el);
    if (node.find('img').length === 0 && isBlank(node.text())) node.remove();
  });
  $('ul, ol').each((_, el) => {
    if ($(el).children('li').length === 0) $(el).remove();
  });

  return $.html()
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

/** Texte brut d'un fragment HTML, espaces normalisés. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html.replace(/<br\s*\/?>/g, ' '), null, false);
  $('p, li, h2, h3, h4, td').append(' ');
  return $.text().replace(/\s+/g, ' ').trim();
}

/** Résumé d'environ `max` caractères, coupé sur un mot. */
export function excerpt(html: string, max = 180): string {
  const text = htmlToText(html);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.–-]+$/, '')}…`;
}

/**
 * Réécrit les URL des liens et images d'un fragment. Le résolveur retourne la
 * nouvelle URL, ou null pour laisser l'URL inchangée.
 */
export function rewriteUrls(
  html: string,
  resolve: (url: string, tag: 'a' | 'img') => string | null,
): string {
  const $ = cheerio.load(html, null, false);
  $('a[href], img[src]').each((_, el) => {
    const tag = el.tagName === 'a' ? 'a' : 'img';
    const attr = tag === 'a' ? 'href' : 'src';
    const next = resolve($(el).attr(attr)!, tag);
    if (next) $(el).attr(attr, next);
  });
  return $.html();
}
