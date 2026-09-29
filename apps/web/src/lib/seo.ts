import { BLASON, COMMUNE, LEGAL } from '../site.config.ts';
import type { Crumb } from './content/select.ts';
import type { Elected, Event, News, Room, Settings } from './content/types.ts';

/**
 * Données structurées schema.org (JSON-LD).
 *
 * Toutes les pages portent le même graphe d'entités reliées par leur @id :
 * le site, la commune (collectivité), son territoire et la mairie. Les moteurs
 * de recherche et les assistants IA peuvent ainsi rattacher chaque page à la
 * bonne entité, et relier celle-ci à Wikidata, Wikipédia et Service-Public.
 */

const DAY_URIS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const ids = (site: URL) => ({
  website: new URL('/#site', site).toString(),
  commune: new URL('/#commune', site).toString(),
  territory: new URL('/#territoire', site).toString(),
  mairie: new URL('/#mairie', site).toString(),
});

function postalAddress(settings: Settings) {
  return {
    '@type': 'PostalAddress',
    streetAddress: settings.street,
    postalCode: settings.postalCode,
    addressLocality: settings.city,
    addressRegion: COMMUNE.region,
    addressCountry: 'FR',
  };
}

function openingHours(settings: Settings) {
  return settings.hours.map((h) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: `https://schema.org/${DAY_URIS[h.day]}`,
    opens: h.open,
    closes: h.close,
  }));
}

/** Graphe commun à toutes les pages. */
export function siteGraph(settings: Settings, site: URL, mayor?: Elected) {
  const id = ids(site);
  const geo =
    settings.latitude !== undefined && settings.longitude !== undefined
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: settings.latitude,
            longitude: settings.longitude,
          },
        }
      : {};
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': id.website,
        url: site.toString(),
        name: 'Saint-Amand-Longpré',
        alternateName: 'Site officiel de la commune de Saint-Amand-Longpré',
        inLanguage: 'fr-FR',
        publisher: { '@id': id.commune },
      },
      {
        '@type': 'GovernmentOrganization',
        '@id': id.commune,
        name: `Commune de ${COMMUNE.name}`,
        url: site.toString(),
        logo: {
          '@type': 'ImageObject',
          url: new URL(BLASON.src, site).toString(),
          caption: `Blason de ${COMMUNE.name}`,
        },
        email: LEGAL.email,
        telephone: settings.phone,
        address: postalAddress(settings),
        areaServed: { '@id': id.territory },
        location: { '@id': id.mairie },
        parentOrganization: {
          '@type': 'GovernmentOrganization',
          name: COMMUNE.intercommunality.name,
          url: COMMUNE.intercommunality.url,
        },
        identifier: [
          {
            '@type': 'PropertyValue',
            propertyID: 'Code officiel géographique (Insee)',
            value: COMMUNE.inseeCode,
          },
          { '@type': 'PropertyValue', propertyID: 'SIREN', value: COMMUNE.siren },
        ],
        ...(mayor
          ? {
              employee: {
                '@type': 'Person',
                name: mayor.name,
                jobTitle: `Maire de ${COMMUNE.name}`,
              },
            }
          : {}),
        sameAs: [
          COMMUNE.wikidata,
          COMMUNE.wikipedia,
          COMMUNE.servicePublic,
          ...(settings.facebook ? [settings.facebook] : []),
        ],
      },
      {
        '@type': ['City', 'AdministrativeArea'],
        '@id': id.territory,
        name: COMMUNE.name,
        description: `Commune française du département de ${COMMUNE.department.name} (${COMMUNE.department.code}), en région ${COMMUNE.region}, membre de la ${COMMUNE.intercommunality.name}.`,
        address: {
          '@type': 'PostalAddress',
          postalCode: COMMUNE.postalCode,
          addressLocality: COMMUNE.name,
          addressCountry: 'FR',
        },
        ...geo,
        containedInPlace: {
          '@type': 'AdministrativeArea',
          name: `${COMMUNE.department.name} (${COMMUNE.department.code})`,
          containedInPlace: { '@type': 'AdministrativeArea', name: COMMUNE.region },
        },
        sameAs: [COMMUNE.wikidata, COMMUNE.wikipedia],
      },
      {
        '@type': ['GovernmentOffice', 'CivicStructure'],
        '@id': id.mairie,
        name: `Mairie de ${COMMUNE.name}`,
        url: new URL('/contact/', site).toString(),
        telephone: settings.phone,
        email: LEGAL.email,
        address: postalAddress(settings),
        ...geo,
        openingHoursSpecification: openingHours(settings),
        parentOrganization: { '@id': id.commune },
        image: new URL(BLASON.src, site).toString(),
      },
    ],
  };
}

/** Page courante et fil d'Ariane. */
export function webPage(
  site: URL,
  path: string,
  title: string,
  crumbs: Crumb[],
  description?: string,
  modified?: string,
) {
  const id = ids(site);
  const url = new URL(path, site).toString();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#page`,
        url,
        name: title,
        ...(description ? { description } : {}),
        ...(modified ? { dateModified: modified } : {}),
        inLanguage: 'fr-FR',
        isPartOf: { '@id': id.website },
        about: { '@id': id.territory },
        publisher: { '@id': id.commune },
        breadcrumb: { '@id': `${url}#fil` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#fil`,
        itemListElement: crumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.label,
          item: new URL(crumb.href, site).toString(),
        })),
      },
    ],
  };
}

export function newsArticle(news: News, site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title,
    description: news.excerpt,
    datePublished: news.date,
    dateModified: news.modified ?? news.date,
    articleSection: news.category,
    inLanguage: 'fr-FR',
    ...(news.image ? { image: [new URL(news.image.src, site).toString()] } : {}),
    author: { '@id': ids(site).commune },
    publisher: { '@id': ids(site).commune },
    about: { '@id': ids(site).territory },
    mainEntityOfPage: new URL(`/actualites/${news.slug}/`, site).toString(),
  };
}

/** Les heures d'évènement sont locales à Paris : on précise le fuseau via le décalage du jour. */
function withOffset(local: string): string {
  const date = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    timeZoneName: 'shortOffset',
  }).formatToParts(date);
  const offset = parts.find((p) => p.type === 'timeZoneName')?.value.replace('GMT', '') || '+0';
  const [h, m] = offset.split(':');
  const sign = offset.startsWith('-') ? '-' : '+';
  const hours = String(Math.abs(Number(h))).padStart(2, '0');
  return `${local}:00${sign}${hours}:${(m ?? '00').padStart(2, '0')}`;
}

export function eventSchema(event: Event, site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    startDate: event.allDay ? event.start.slice(0, 10) : withOffset(event.start),
    ...(event.end
      ? { endDate: event.allDay ? event.end.slice(0, 10) : withOffset(event.end) }
      : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.location ?? COMMUNE.name,
      address: event.address ?? `${COMMUNE.postalCode} ${COMMUNE.name}`,
    },
    ...(event.excerpt ? { description: event.excerpt } : {}),
    ...(event.image ? { image: [new URL(event.image.src, site).toString()] } : {}),
    organizer: { '@id': ids(site).commune },
    isAccessibleForFree: true,
    inLanguage: 'fr-FR',
    url: new URL(`/agenda/${event.slug}/`, site).toString(),
  };
}

/** Composition du conseil municipal : répond aux questions « Qui est le maire… ? ». */
export function electedSchema(elected: Elected[], site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Conseil municipal de ${COMMUNE.name}`,
    itemListElement: elected.map((person, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Person',
        name: person.name,
        jobTitle: `${person.title} de ${COMMUNE.name}`,
        ...(person.delegations ? { description: `Délégations : ${person.delegations}` } : {}),
        ...(person.photo ? { image: new URL(person.photo.src, site).toString() } : {}),
        memberOf: { '@id': ids(site).commune },
      },
    })),
  };
}

export function roomSchema(room: Room, site: URL, settings: Settings) {
  return {
    '@context': 'https://schema.org',
    '@type': ['EventVenue', 'CivicStructure'],
    name: `${room.title} de ${COMMUNE.name}`,
    ...(room.excerpt ? { description: room.excerpt } : {}),
    ...(room.capacity ? { maximumAttendeeCapacity: room.capacity } : {}),
    ...(room.photos[0] ? { image: new URL(room.photos[0].src, site).toString() } : {}),
    address: postalAddress(settings),
    telephone: settings.phone,
    containedInPlace: { '@id': ids(site).territory },
    url: new URL(`/demarches/louer-une-salle/${room.slug}/`, site).toString(),
  };
}

export interface Question {
  question: string;
  /** Réponse en texte brut (sans HTML). */
  answer: string;
}

export function faqSchema(questions: Question[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
}
