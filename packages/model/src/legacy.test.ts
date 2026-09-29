import { describe, expect, it } from 'vitest';
import { LEGACY_FALLBACKS, legacyFallback } from './legacy.ts';

describe('redirections de secours', () => {
  it('rattache chaque ancienne rubrique à la nouvelle', () => {
    expect(legacyFallback('/fr/actualites/7')).toBe('/actualites/');
    expect(legacyFallback('/fr/actualite/999999/titre-inconnu')).toBe('/actualites/');
    expect(legacyFallback('/fr/associations/1/6/action-familiale-sociale')).toBe(
      '/vivre-ici/associations/',
    );
    expect(legacyFallback('/fr/usefulnumber/index/page/2')).toBe('/demarches/numeros-utiles/');
    expect(legacyFallback('/fr/salle-municipale/382/salle-fetes/1/10/2026')).toBe(
      '/demarches/louer-une-salle/',
    );
    expect(legacyFallback('/fr/information/1/inconnue')).toBe('/plan-du-site/');
  });
  it('envoie le reste vers l’accueil', () => {
    expect(legacyFallback('/fr/nimporte-quoi')).toBe('/');
    expect(legacyFallback('/mobile/agenda')).toBe('/');
  });
  it('place les préfixes les plus précis avant les plus généraux', () => {
    LEGACY_FALLBACKS.forEach(([prefix], i) => {
      const shadowed = LEGACY_FALLBACKS.slice(0, i).find(([earlier]) => prefix.startsWith(earlier));
      expect(shadowed, `${prefix} est masqué par ${shadowed?.[0]}`).toBeUndefined();
    });
  });
});
