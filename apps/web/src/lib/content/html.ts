const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Bloc « Documents joints », au même format que les blocs Fichier de WordPress. */
export function documentsBlock(documents: { url: string; title: string }[]): string {
  if (documents.length === 0) return '';
  const items = documents
    .map(
      (d) =>
        `<div class="wp-block-file"><a href="${escape(d.url)}">${escape(d.title)}</a><a href="${escape(d.url)}" class="wp-block-file__button" download>Télécharger</a></div>`,
    )
    .join('');
  return `<h2 class="sal-documents-title">Documents joints</h2>${items}`;
}

/** Bloc galerie, au même format que le bloc Galerie de WordPress. */
export function galleryBlock(images: { src: string; alt: string; caption?: string }[]): string {
  if (images.length === 0) return '';
  const items = images
    .map(
      (i) =>
        `<figure class="wp-block-image"><img src="${escape(i.src)}" alt="${escape(i.alt)}" loading="lazy" decoding="async">${i.caption ? `<figcaption>${escape(i.caption)}</figcaption>` : ''}</figure>`,
    )
    .join('');
  return `<figure class="wp-block-gallery has-nested-images">${items}</figure>`;
}

/**
 * Améliore le HTML éditorial avant affichage : chargement différé des images
 * et attribut rel sûr sur les liens externes.
 */
export function enhanceHtml(html: string, siteHost: string): string {
  return html
    .replace(/<img(?![^>]*\bloading=)/g, '<img loading="lazy" decoding="async"')
    .replace(
      /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/g,
      (all, before: string, href: string, after: string) => {
        let host: string;
        try {
          host = new URL(href).hostname;
        } catch {
          return all;
        }
        if (host === siteHost || /\brel=/.test(before + after)) return all;
        return `<a ${before}href="${href}"${after} rel="noopener noreferrer">`;
      },
    );
}

/** Texte brut d'un fragment HTML (résumés, métadonnées). */
export function textFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.–-]+$/, '')}…`;
}
