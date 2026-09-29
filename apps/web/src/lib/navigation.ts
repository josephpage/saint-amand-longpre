import { childrenOf } from './content/select.ts';
import type { Page } from './content/types.ts';

export interface NavItem {
  label: string;
  href: string;
  description?: string;
}

export interface NavSection {
  key: string;
  label: string;
  href: string;
  intro: string;
  items: NavItem[];
}

/** Rubriques qui ne sont pas des pages WordPress mais des pages dédiées du site. */
export const VIRTUAL_PAGES: Record<string, NavItem> = {
  elus: {
    label: 'Les élus',
    href: '/mairie/conseil-municipal/elus/',
    description: 'Maire, adjoints et conseillers municipaux',
  },
  comptesRendus: {
    label: 'Comptes rendus du conseil',
    href: '/mairie/conseil-municipal/comptes-rendus/',
    description: 'Séances du conseil municipal',
  },
  salles: {
    label: 'Louer une salle',
    href: '/demarches/louer-une-salle/',
    description: 'Salle des fêtes, salle des associations',
  },
  numeros: {
    label: 'Numéros utiles',
    href: '/demarches/numeros-utiles/',
    description: 'Santé, services publics, urgences',
  },
  signaler: {
    label: 'Signaler un problème',
    href: '/signaler-un-probleme/',
    description: 'Voirie, éclairage, espaces publics',
  },
  associations: {
    label: 'Associations',
    href: '/vivre-ici/associations/',
    description: 'Annuaire des associations',
  },
  entreprises: {
    label: 'Commerces et entreprises',
    href: '/vivre-ici/commerces-et-entreprises/',
    description: 'Commerces, artisans et entreprises',
  },
  commune: {
    label: 'La commune en bref',
    href: '/decouvrir/la-commune/',
    description: 'Chiffres clés, histoire, intercommunalité et questions fréquentes',
  },
  actualites: {
    label: 'Actualités',
    href: '/actualites/',
    description: 'Toutes les nouvelles de la commune',
  },
  agenda: { label: 'Agenda', href: '/agenda/', description: 'Les prochains rendez-vous' },
};

/** Libellés des rubriques, pour le fil d'Ariane. */
export const SECTION_LABELS: Record<string, string> = {
  '/mairie/': 'Ma mairie',
  '/demarches/': 'Démarches',
  '/vivre-ici/': 'Vivre ici',
  '/decouvrir/': 'Découvrir',
  '/mairie/conseil-municipal/elus/': 'Les élus',
  '/mairie/conseil-municipal/comptes-rendus/': 'Comptes rendus',
  '/demarches/louer-une-salle/': 'Louer une salle',
  '/demarches/numeros-utiles/': 'Numéros utiles',
  '/vivre-ici/associations/': 'Associations',
  '/vivre-ici/commerces-et-entreprises/': 'Commerces et entreprises',
  '/decouvrir/la-commune/': 'La commune en bref',
};

const toItem = (p: Page): NavItem => ({
  label: p.title,
  href: p.path,
  ...(p.excerpt ? { description: p.excerpt } : {}),
});

/** Menu principal, construit à partir de l'arborescence des pages et des rubriques dédiées. */
export function buildNavigation(pages: Page[]): NavSection[] {
  const v = VIRTUAL_PAGES;
  return [
    {
      key: 'mairie',
      label: 'Ma mairie',
      href: '/mairie/',
      intro: 'Le conseil municipal, les élus, les services de la mairie et l’intercommunalité.',
      items: [v.elus!, v.comptesRendus!, ...childrenOf(pages, '/mairie/').map(toItem)],
    },
    {
      key: 'demarches',
      label: 'Démarches',
      href: '/demarches/',
      intro: 'État civil, urbanisme, location de salle : les démarches auprès de la mairie.',
      items: [...childrenOf(pages, '/demarches/').map(toItem), v.salles!, v.numeros!, v.signaler!],
    },
    {
      key: 'vivre-ici',
      label: 'Vivre ici',
      href: '/vivre-ici/',
      intro: 'École, associations, commerces et services du quotidien.',
      items: [v.associations!, v.entreprises!, ...childrenOf(pages, '/vivre-ici/').map(toItem)],
    },
    {
      key: 'agenda',
      label: 'Actualités et agenda',
      href: '/actualites/',
      intro: 'Les nouvelles de la commune et les prochains rendez-vous.',
      items: [v.actualites!, v.agenda!],
    },
    {
      key: 'decouvrir',
      label: 'Découvrir',
      href: '/decouvrir/',
      intro: 'L’histoire, le patrimoine et les images de Saint-Amand-Longpré.',
      items: [v.commune!, ...childrenOf(pages, '/decouvrir/').map(toItem)],
    },
  ];
}
