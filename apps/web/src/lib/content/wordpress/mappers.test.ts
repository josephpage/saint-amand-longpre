import { describe, expect, it } from 'vitest';
import {
  mapAlert,
  mapDirectoryEntry,
  mapElected,
  mapEvent,
  mapPage,
  mapPost,
  mapSettings,
  normalizeDateTime,
} from './mappers.ts';

describe('normalizeDateTime', () => {
  it('accepte les formats renvoyés par ACF', () => {
    expect(normalizeDateTime('2026-10-10 09:00:00')).toBe('2026-10-10T09:00');
    expect(normalizeDateTime('2026-10-10')).toBe('2026-10-10T00:00');
    expect(normalizeDateTime('10/10/2026 9:00 pm')).toBe('2026-10-10T21:00');
    expect(normalizeDateTime('20261010')).toBe('2026-10-10T00:00');
    expect(normalizeDateTime('')).toBeUndefined();
  });
});

describe('conversion des contenus WordPress', () => {
  it('déduit rubrique et parent d’une page à partir de son URI', () => {
    expect(
      mapPage({
        databaseId: 3,
        title: 'Passeport',
        uri: '/demarches/etat-civil/passeport/',
        content: '<p>x</p>',
        menuOrder: 2,
      }),
    ).toMatchObject({
      path: '/demarches/etat-civil/passeport/',
      parentPath: '/demarches/etat-civil/',
      section: 'demarches',
      order: 2,
    });
    expect(mapPage({ databaseId: 4, title: 'Brouillon', uri: null, content: '' })).toBeNull();
  });

  it('décode les entités des titres et prend la première catégorie', () => {
    const news = mapPost({
      databaseId: 1,
      slug: 'plu',
      title: 'Plan local d&#8217;urbanisme',
      date: '2026-09-12T10:00:00',
      content: '<p>Texte</p>',
      categories: { nodes: [{ name: 'Urbanisme' }] },
      featuredImage: {
        node: {
          sourceUrl: 'https://cms/x.jpg',
          altText: '',
          mediaDetails: { width: 800, height: 600 },
        },
      },
    });
    expect(news).toMatchObject({
      title: 'Plan local d’urbanisme',
      date: '2026-09-12',
      category: 'Urbanisme',
      excerpt: 'Texte',
    });
    expect(news.image).toEqual({ src: 'https://cms/x.jpg', alt: '', width: 800, height: 600 });
  });

  it('ignore un évènement sans date de début', () => {
    expect(
      mapEvent({
        databaseId: 1,
        slug: 'x',
        title: 'x',
        content: '',
        infosEvenement: { debut: null },
      }),
    ).toBeNull();
    expect(
      mapEvent({
        databaseId: 2,
        slug: 'y',
        title: 'y',
        content: '',
        infosEvenement: { debut: '2026-10-10 09:00:00', lieu: 'Gymnase' },
      }),
    ).toMatchObject({ start: '2026-10-10T09:00', location: 'Gymnase', allDay: false });
  });

  it('accepte les champs select ACF sous forme de liste', () => {
    expect(
      mapElected({
        databaseId: 1,
        title: 'Jean',
        infosElu: { role: ['adjoint'], fonction: '1er adjoint' },
      }),
    ).toMatchObject({
      role: 'adjoint',
      title: '1er adjoint',
    });
    expect(
      mapAlert({
        databaseId: 1,
        title: 'Canicule',
        content: '<p>Restez au frais</p>',
        infosAlerte: { niveau: ['urgence'], expiration: '20261001' },
      }),
    ).toMatchObject({
      level: 'urgence',
      expires: '2026-10-01',
      message: 'Restez au frais',
    });
  });

  it('écarte une fiche d’annuaire sans type', () => {
    expect(
      mapDirectoryEntry({
        databaseId: 1,
        slug: 'x',
        title: 'X',
        content: '',
        typesAnnuaire: { nodes: [] },
      }),
    ).toBeNull();
  });

  it('convertit les réglages de la mairie', () => {
    expect(
      mapSettings({
        adresse: '18 rue Jules Ferry',
        telephone: '02 54 82 83 74',
        latitude: 47.68,
        horaires: [{ jour: 1, ouverture: '10:00', fermeture: '12:30' }],
      }),
    ).toMatchObject({
      street: '18 rue Jules Ferry',
      latitude: 47.68,
      hours: [{ day: 1, open: '10:00', close: '12:30' }],
    });
  });
});
