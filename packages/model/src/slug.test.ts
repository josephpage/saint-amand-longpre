import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug.ts';

describe('slugify', () => {
  it('retire les accents, la ponctuation et met en minuscules', () => {
    expect(slugify("Carte nationale d'identité")).toBe('carte-nationale-d-identite');
    expect(slugify('  Salle des fêtes (160 places) ')).toBe('salle-des-fetes-160-places');
    expect(slugify('École & enfance')).toBe('ecole-enfance');
  });
});

describe('uniqueSlug', () => {
  it('suffixe les doublons', () => {
    const taken = new Set<string>();
    expect(uniqueSlug('autres', taken)).toBe('autres');
    expect(uniqueSlug('autres', taken)).toBe('autres-2');
    expect(uniqueSlug('autres', taken)).toBe('autres-3');
  });
});
