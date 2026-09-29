import { LEGAL } from '../site.config.ts';
import type { Event, News, Settings } from './content/types.ts';

const DAY_URIS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Données structurées de la mairie (horaires, adresse, téléphone). */
export function governmentOffice(settings: Settings, site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOffice',
    name: 'Mairie de Saint-Amand-Longpré',
    url: site.toString(),
    telephone: settings.phone,
    email: LEGAL.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: settings.street,
      postalCode: settings.postalCode,
      addressLocality: settings.city,
      addressCountry: 'FR',
    },
    ...(settings.latitude !== undefined && settings.longitude !== undefined
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: settings.latitude,
            longitude: settings.longitude,
          },
        }
      : {}),
    openingHoursSpecification: settings.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAY_URIS[h.day]}`,
      opens: h.open,
      closes: h.close,
    })),
    ...(settings.facebook ? { sameAs: [settings.facebook] } : {}),
  };
}

export function newsArticle(news: News, site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: news.title,
    datePublished: news.date,
    ...(news.image ? { image: [new URL(news.image.src, site).toString()] } : {}),
    publisher: { '@type': 'GovernmentOrganization', name: 'Commune de Saint-Amand-Longpré' },
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
      name: event.location ?? 'Saint-Amand-Longpré',
      address: event.address ?? 'Saint-Amand-Longpré, 41310',
    },
    ...(event.excerpt ? { description: event.excerpt } : {}),
    ...(event.image ? { image: [new URL(event.image.src, site).toString()] } : {}),
    organizer: {
      '@type': 'GovernmentOrganization',
      name: 'Commune de Saint-Amand-Longpré',
      url: site.toString(),
    },
    url: new URL(`/agenda/${event.slug}/`, site).toString(),
  };
}
