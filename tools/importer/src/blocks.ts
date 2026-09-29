/** Construction du contenu Gutenberg des publications importées. */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface UploadedMedia {
  id: number;
  url: string;
  alt?: string;
  caption?: string;
}

/** Le texte repris de l'ancien site devient un bloc « Classique », modifiable tel quel. */
export function classicBlock(html: string): string {
  return html.trim() ? `<!-- wp:freeform -->${html}<!-- /wp:freeform -->` : '';
}

function headingBlock(text: string): string {
  return `<!-- wp:heading --><h2 class="wp-block-heading">${escapeHtml(text)}</h2><!-- /wp:heading -->`;
}

export function fileBlock(file: UploadedMedia, title: string): string {
  const attrs = JSON.stringify({ id: file.id, href: file.url });
  const url = escapeHtml(file.url);
  return `<!-- wp:file ${attrs} --><div class="wp-block-file"><a href="${url}">${escapeHtml(title)}</a><a href="${url}" class="wp-block-file__button wp-element-button" download>Télécharger</a></div><!-- /wp:file -->`;
}

export function galleryBlock(images: UploadedMedia[]): string {
  if (images.length === 0) return '';
  const inner = images
    .map((img) => {
      const attrs = JSON.stringify({ id: img.id, sizeSlug: 'large', linkDestination: 'none' });
      const caption = img.caption
        ? `<figcaption class="wp-element-caption">${escapeHtml(img.caption)}</figcaption>`
        : '';
      return `<!-- wp:image ${attrs} --><figure class="wp-block-image size-large"><img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt ?? '')}" class="wp-image-${img.id}"/>${caption}</figure><!-- /wp:image -->`;
    })
    .join('');
  return `<!-- wp:gallery {"linkTo":"none"} --><figure class="wp-block-gallery has-nested-images columns-default is-cropped">${inner}</figure><!-- /wp:gallery -->`;
}

/** Contenu complet : texte, galerie puis documents joints. */
export function composeContent(
  html: string,
  gallery: UploadedMedia[] = [],
  documents: { media: UploadedMedia; title: string }[] = [],
): string {
  const parts = [classicBlock(html), galleryBlock(gallery)];
  if (documents.length) {
    parts.push(
      headingBlock('Documents joints'),
      ...documents.map((d) => fileBlock(d.media, d.title)),
    );
  }
  return parts.filter(Boolean).join('\n\n');
}

/** Remplace les références « media:<id> » du snapshot par les URL WordPress. */
export function resolveMediaRefs(
  html: string,
  lookup: (id: string) => UploadedMedia | undefined,
): string {
  return html.replace(/(src|href)="media:([a-z0-9-]+)"/g, (all, attr: string, id: string) => {
    const media = lookup(id);
    return media ? `${attr}="${escapeHtml(media.url)}"` : all;
  });
}

/** « 2026-10-10T09:00 » → « 2026-10-10 09:00:00 » (format ACF date_time_picker). */
export const acfDateTime = (local: string) => `${local.replace('T', ' ')}:00`;
/** « 2026-10-10 » → « 20261010 » (format de stockage ACF date_picker). */
export const acfDate = (iso: string) => iso.replace(/-/g, '');
