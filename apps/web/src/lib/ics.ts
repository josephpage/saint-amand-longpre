import type { Event } from './content/types.ts';

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Replie les lignes à 75 octets comme l'exige la norme iCalendar. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.join('\r\n ');
}

const local = (iso: string) => iso.replace(/[-:]/g, '').slice(0, 13) + '00';
const dateOnly = (iso: string) => iso.slice(0, 10).replace(/-/g, '');

function nextDay(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/** Calendrier iCalendar des évènements, pour s'abonner à l'agenda. */
export function buildIcs(events: Event[], siteUrl: string, now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mairie de Saint-Amand-Longpré//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Agenda de Saint-Amand-Longpré',
    'X-WR-TIMEZONE:Europe/Paris',
  ];
  for (const e of events) {
    const url = new URL(`/agenda/${e.slug}/`, siteUrl).toString();
    lines.push('BEGIN:VEVENT', `UID:${e.slug}@saintamandlongpre.fr`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      lines.push(
        `DTSTART;VALUE=DATE:${dateOnly(e.start)}`,
        `DTEND;VALUE=DATE:${nextDay((e.end ?? e.start).slice(0, 10))}`,
      );
    } else {
      lines.push(`DTSTART;TZID=Europe/Paris:${local(e.start)}`);
      if (e.end) lines.push(`DTEND;TZID=Europe/Paris:${local(e.end)}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    const where = [e.location, e.address].filter(Boolean).join(', ');
    if (where) lines.push(`LOCATION:${escapeText(where)}`);
    if (e.excerpt) lines.push(`DESCRIPTION:${escapeText(e.excerpt)}`);
    lines.push(`URL:${url}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
