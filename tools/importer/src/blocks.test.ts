import { describe, expect, it } from 'vitest';
import {
  acfDate,
  acfDateTime,
  classicBlock,
  composeContent,
  fileBlock,
  galleryBlock,
  resolveMediaRefs,
} from './blocks.ts';

const img = {
  id: 12,
  url: 'http://localhost:8080/wp-content/uploads/a.jpg',
  alt: 'Vue "aérienne"',
  caption: 'Le bourg',
};

describe('blocs Gutenberg', () => {
  it('encapsule le texte repris dans un bloc Classique', () => {
    expect(classicBlock('<p>Bonjour</p>')).toBe(
      '<!-- wp:freeform --><p>Bonjour</p><!-- /wp:freeform -->',
    );
    expect(classicBlock('  ')).toBe('');
  });
  it('produit un bloc Fichier valide', () => {
    const block = fileBlock({ id: 5, url: 'http://x/doc.pdf' }, 'Tarifs & règlement');
    expect(block).toContain('<!-- wp:file {"id":5,"href":"http://x/doc.pdf"} -->');
    expect(block).toContain('>Tarifs &amp; règlement</a>');
  });
  it('produit une galerie d’images avec légendes échappées', () => {
    const block = galleryBlock([img]);
    expect(block).toContain(
      '<!-- wp:image {"id":12,"sizeSlug":"large","linkDestination":"none"} -->',
    );
    expect(block).toContain('alt="Vue &quot;aérienne&quot;"');
    expect(block).toContain('class="wp-image-12"');
    expect(galleryBlock([])).toBe('');
  });
  it('assemble texte, galerie et documents', () => {
    const content = composeContent(
      '<p>x</p>',
      [img],
      [{ media: { id: 5, url: 'http://x/d.pdf' }, title: 'Doc' }],
    );
    expect(content.indexOf('wp:freeform')).toBeLessThan(content.indexOf('wp:gallery'));
    expect(content).toContain('Documents joints');
  });
});

describe('conversion', () => {
  it('résout les références aux médias', () => {
    const out = resolveMediaRefs('<a href="media:abc">x</a><img src="media:zzz">', (id) =>
      id === 'abc' ? { id: 1, url: 'http://w/a.pdf' } : undefined,
    );
    expect(out).toBe('<a href="http://w/a.pdf">x</a><img src="media:zzz">');
  });
  it('formate les dates pour ACF', () => {
    expect(acfDateTime('2026-10-10T09:00')).toBe('2026-10-10 09:00:00');
    expect(acfDate('2026-10-10')).toBe('20261010');
  });
});
