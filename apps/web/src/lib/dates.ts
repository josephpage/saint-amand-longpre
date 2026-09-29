export const TIME_ZONE = 'Europe/Paris';

/**
 * Les dates d'évènements sont des heures locales de Paris (« 2026-10-10T09:00 »).
 * On les manipule comme des dates UTC pour les formater sans décalage horaire.
 */
const asUtc = (local: string) => new Date(`${local.length === 10 ? `${local}T00:00` : local}:00Z`);

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' });

/** Date du jour à Paris, AAAA-MM-JJ. */
export function todayInParis(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

/** « 12 septembre 2026 ». */
export function formatDate(iso: string): string {
  return fmt({ day: 'numeric', month: 'long', year: 'numeric' })
    .format(asUtc(iso))
    .replace(/^1 /, '1er ');
}

/** « samedi 10 octobre 2026 ». */
function formatLongDate(iso: string): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(asUtc(iso))
    .replace(/ 1 /, ' 1er ');
}

/** Éléments d'une pastille de date : « sam. », « 10 », « oct. ». */
export function dateBadge(iso: string): { weekday: string; day: string; month: string } {
  const d = asUtc(iso);
  return {
    weekday: fmt({ weekday: 'short' }).format(d),
    day: fmt({ day: 'numeric' }).format(d),
    month: fmt({ month: 'short' }).format(d),
  };
}

/** « 9 h », « 12 h 30 ». */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return `${Number(h)} h${m && m !== '00' ? ` ${m}` : ''}`;
}

/** Horaire lisible d'un évènement : « 9 h – 13 h », « Toute la journée ». */
export function formatEventTime(start: string, end: string | undefined, allDay: boolean): string {
  if (allDay) return 'Toute la journée';
  const startTime = formatTime(start.slice(11, 16));
  if (!end) return startTime;
  if (end.slice(0, 10) !== start.slice(0, 10)) {
    return `${startTime}, jusqu’au ${formatDate(end.slice(0, 10))}`;
  }
  return `${startTime} – ${formatTime(end.slice(11, 16))}`;
}

/** Date complète d'un évènement, sur plusieurs jours le cas échéant. */
export function formatEventDate(start: string, end: string | undefined): string {
  const startDay = start.slice(0, 10);
  const endDay = end?.slice(0, 10);
  if (endDay && endDay !== startDay) return `Du ${formatDate(startDay)} au ${formatDate(endDay)}`;
  const long = formatLongDate(startDay);
  return long.charAt(0).toUpperCase() + long.slice(1);
}
