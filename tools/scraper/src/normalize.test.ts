import { describe, expect, it } from 'vitest';
import { parseCapacity } from './extract.ts';
import {
  categorizeNews,
  formatFrenchDate,
  formatPhone,
  resolvePagePath,
  sectionOf,
} from './normalize.ts';

describe('categorizeNews', () => {
  it('classe selon le titre en priorité', () => {
    expect(categorizeNews("Plan Local d'Urbanisme intercommunal (PLUiH)", '')).toBe('Urbanisme');
    expect(categorizeNews('Sécheresse - arrêté préfectoral', '')).toBe('Environnement');
    expect(categorizeNews('Élections européennes du 9 juin 2024', '')).toBe('Élections');
    expect(categorizeNews('Recensement des personnes en prévision d’une canicule', '')).toBe(
      'Solidarité',
    );
  });
  it('utilise le texte ensuite, puis « Vie locale » par défaut', () => {
    expect(categorizeNews('Information', 'Inscriptions à la cantine scolaire')).toBe('Éducation');
    expect(categorizeNews('Marche nocturne', 'Venez nombreux')).toBe('Vie locale');
  });
});

describe('resolvePagePath', () => {
  const titles: Record<string, string> = {
    '/fr/information/3512/etat-civil': 'Etat civil',
    '/fr/information/14200/passeport': 'Passeport',
    '/fr/information/99/orpheline': 'Page orpheline',
  };
  const parents: Record<string, string> = {
    '/fr/information/14200/passeport': '/fr/information/3512/etat-civil',
  };
  const titleOf = (p: string) => titles[p] ?? 'Sans titre';
  const parentOf = (p: string) => parents[p];

  it('utilise la table de correspondance', () => {
    expect(resolvePagePath('/fr/information/3512/etat-civil', titleOf, parentOf)).toBe(
      '/demarches/etat-civil/',
    );
  });
  it('place une sous-rubrique sous son parent', () => {
    expect(resolvePagePath('/fr/information/14200/passeport', titleOf, parentOf)).toBe(
      '/demarches/etat-civil/passeport/',
    );
  });
  it('range une page orpheline dans « Vivre ici »', () => {
    expect(resolvePagePath('/fr/information/99/orpheline', titleOf, parentOf)).toBe(
      '/vivre-ici/page-orpheline/',
    );
  });
  it('donne la rubrique d’un chemin', () => {
    expect(sectionOf('/demarches/etat-civil/')).toBe('demarches');
  });
});

describe('formatage', () => {
  it('écrit les dates en français', () => {
    expect(formatFrenchDate('2026-09-07')).toBe('7 septembre 2026');
    expect(formatFrenchDate('2026-06-01')).toBe('1er juin 2026');
  });
  it('formate les numéros de téléphone', () => {
    expect(formatPhone('0254735800')).toBe('02 54 73 58 00');
    expect(formatPhone('02 54 82 83 74 ')).toBe('02 54 82 83 74');
  });
});

describe('parseCapacity', () => {
  it('lit une capacité maximale', () => {
    expect(parseCapacity("peut accueillir jusqu'à 160 personnes.")).toEqual({ capacity: 160 });
  });
  it('distingue places assises et debout', () => {
    expect(parseCapacity("jusqu'à 40 personnes assises et 60 debouts")).toEqual({
      capacity: 60,
      seated: 40,
    });
  });
});
