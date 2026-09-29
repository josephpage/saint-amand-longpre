import { describe, expect, it } from 'vitest';
import {
  activeAlerts,
  breadcrumb,
  childrenOf,
  groupByCategory,
  pastEvents,
  sortElected,
  upcomingEvents,
} from './select.ts';
import type { Alert, Elected, Event, Page } from './types.ts';

const event = (slug: string, start: string, end?: string): Event => ({
  id: slug,
  slug,
  title: slug,
  start,
  ...(end ? { end } : {}),
  allDay: false,
  html: '',
});

describe('évènements', () => {
  const events = [
    event('passe', '2026-09-01T10:00'),
    event('aujourdhui', '2026-09-28T20:00'),
    event('long', '2026-09-20T10:00', '2026-09-30T18:00'),
    event('futur', '2026-10-10T09:00'),
  ];
  it('garde les évènements à venir et en cours, du plus proche au plus lointain', () => {
    expect(upcomingEvents(events, '2026-09-28').map((e) => e.slug)).toEqual([
      'long',
      'aujourdhui',
      'futur',
    ]);
  });
  it('liste les évènements passés du plus récent au plus ancien', () => {
    expect(pastEvents(events, '2026-09-28').map((e) => e.slug)).toEqual(['passe']);
  });
});

describe('alertes', () => {
  const alert = (id: string, level: Alert['level'], expires: string): Alert => ({
    id,
    title: id,
    message: id,
    level,
    expires,
  });
  it('masque les alertes expirées et place les urgences en premier', () => {
    const list = [
      alert('info', 'info', '2026-12-31'),
      alert('vieille', 'urgence', '2026-01-01'),
      alert('urgence', 'urgence', '2026-09-28'),
    ];
    expect(activeAlerts(list, '2026-09-28').map((a) => a.id)).toEqual(['urgence', 'info']);
  });
});

const page = (path: string, title: string, order = 0): Page => {
  const parts = path.split('/').filter(Boolean);
  return {
    id: path,
    path,
    title,
    order,
    html: '',
    section: 'demarches',
    ...(parts.length > 1 ? { parentPath: `/${parts.slice(0, -1).join('/')}/` } : {}),
  };
};

describe('arborescence', () => {
  const pages = [
    page('/demarches/etat-civil/', 'État civil'),
    page('/demarches/etat-civil/passeport/', 'Passeport', 2),
    page('/demarches/etat-civil/mariage/', 'Mariage', 1),
    page('/demarches/etat-civil/deces/', 'Décès', 1),
  ];
  it('trie les sous-pages par ordre puis par titre', () => {
    expect(childrenOf(pages, '/demarches/etat-civil/').map((p) => p.title)).toEqual([
      'Décès',
      'Mariage',
      'Passeport',
    ]);
  });
  it('construit le fil d’Ariane', () => {
    expect(
      breadcrumb(pages, '/demarches/etat-civil/passeport/', { '/demarches/': 'Démarches' }),
    ).toEqual([
      { label: 'Accueil', href: '/' },
      { label: 'Démarches', href: '/demarches/' },
      { label: 'État civil', href: '/demarches/etat-civil/' },
      { label: 'Passeport', href: '/demarches/etat-civil/passeport/' },
    ]);
  });
});

describe('regroupements', () => {
  it('regroupe par catégorie et place « Autres » à la fin', () => {
    const groups = groupByCategory([
      { category: 'Santé' },
      {},
      { category: 'Écoles' },
      { category: 'Santé' },
    ]);
    expect(groups.map(([k, v]) => [k, v.length])).toEqual([
      ['Écoles', 1],
      ['Santé', 2],
      ['Autres', 1],
    ]);
  });
  it('ordonne le conseil municipal', () => {
    const e = (name: string, role: Elected['role'], order: number): Elected => ({
      id: name,
      name,
      role,
      title: role,
      order,
    });
    const sorted = sortElected([
      e('C', 'conseiller', 5),
      e('B', 'adjoint', 2),
      e('A', 'adjoint', 1),
      e('M', 'maire', 0),
    ]);
    expect(sorted.map((x) => x.name)).toEqual(['M', 'A', 'B', 'C']);
  });
});
