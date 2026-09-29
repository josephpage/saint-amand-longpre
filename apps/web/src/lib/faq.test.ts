import { describe, expect, it } from 'vitest';
import { buildFaq } from './faq.ts';

const settings = {
  street: '18 rue Jules Ferry',
  postalCode: '41310',
  city: 'Saint-Amand-Longpré',
  phone: '02 54 82 83 74',
  hours: [
    { day: 1, open: '10:00', close: '12:30' },
    { day: 2, open: '10:00', close: '12:30' },
    { day: 5, open: '14:00', close: '16:30' },
  ],
};

describe('questions fréquentes', () => {
  const faq = buildFaq({
    settings,
    elected: [
      { id: '1', name: 'Carine Raffin-Peyloz', role: 'maire', title: 'Maire', order: 0 },
      { id: '2', name: 'Jean-Michel Chalon', role: 'adjoint', title: '1er adjoint', order: 1 },
      { id: '3', name: 'Agnès Minier', role: 'adjoint', title: '2e adjoint', order: 2 },
    ],
    rooms: [
      {
        id: 'r',
        slug: 'salle-des-fetes',
        title: 'Salle des fêtes',
        html: '',
        capacity: 160,
        photos: [],
      },
    ],
    siteUrl: 'https://www.saintamandlongpre.fr',
  });
  const answer = (start: string) => faq.find((q) => q.question.startsWith(start))?.answer ?? '';

  it('répond sur les horaires à partir des réglages', () => {
    expect(answer('Quels sont les horaires')).toContain('lundi et mardi : 10 h – 12 h 30');
    expect(answer('Quels sont les horaires')).toContain('vendredi : 14 h – 16 h 30');
    expect(answer('Quels sont les horaires')).toContain(
      'fermée le mercredi, jeudi, samedi et dimanche',
    );
  });
  it('nomme le maire et les adjoints', () => {
    expect(answer('Qui est le maire')).toContain(
      'Carine Raffin-Peyloz est maire de Saint-Amand-Longpré',
    );
    expect(answer('Qui est le maire')).toContain('Adjoints : Jean-Michel Chalon et Agnès Minier.');
  });
  it('donne les coordonnées et les liens absolus', () => {
    expect(answer('Comment contacter')).toContain('secretariat@saintamandlongpre.fr');
    expect(answer('Comment contacter')).toContain('https://www.saintamandlongpre.fr/contact/');
  });
  it('décrit les salles avec leur capacité', () => {
    expect(answer('Comment louer')).toContain('la salle des fêtes (jusqu’à 160 personnes)');
  });
  it('omet la question sur le maire sans élus connus', () => {
    const sans = buildFaq({ settings, elected: [], rooms: [], siteUrl: 'https://x.fr' });
    expect(sans.some((q) => q.question.startsWith('Qui est le maire'))).toBe(false);
  });
});
