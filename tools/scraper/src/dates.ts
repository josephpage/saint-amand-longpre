const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function toIso(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Convertit « 07/09/2026 » en « 2026-09-07 ». */
export function parseNumericDate(input: string): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(input);
  if (!m) return null;
  return toIso(Number(m[3]), Number(m[2]), Number(m[1]));
}

/**
 * Repère toutes les dates écrites dans un texte français :
 * « 20 juin 2025 », « 1er juillet 2022 », « 19/09/2025 ».
 * Retourne des dates ISO, sans doublon, dans l'ordre d'apparition.
 */
export function findDates(text: string): string[] {
  const found: string[] = [];
  const add = (iso: string | null) => {
    if (iso && !found.includes(iso)) found.push(iso);
  };
  const monthNames = Object.keys(MONTHS).join('|');
  const written = new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${monthNames})\\s+(\\d{4})\\b`, 'gi');
  for (const m of text.matchAll(written)) {
    add(toIso(Number(m[3]), MONTHS[m[2]!.toLowerCase()]!, Number(m[1])));
  }
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    add(toIso(Number(m[3]), Number(m[2]), Number(m[1])));
  }
  return found;
}

/**
 * Estime la date de publication d'une actualité à partir des dates citées :
 * la plus récente qui n'est pas dans le futur par rapport au scraping.
 */
export function guessPublicationDate(text: string, scrapedAt: string): string | null {
  const limit = scrapedAt.slice(0, 10);
  const past = findDates(text).filter((d) => d <= limit);
  return past.sort().at(-1) ?? null;
}

export interface EventTiming {
  start: string;
  end?: string;
  allDay: boolean;
}

/**
 * Lit l'en-tête de date d'un évènement de l'ancien site :
 * « le 20/03/2026 à 19:00 », « le 12/04/2025 de 14:00 à 18:00 »,
 * « du 12/04/2025 au 14/04/2025 », « le 12/04/2025 ».
 */
export function parseEventHeading(heading: string): EventTiming | null {
  const text = heading.replace(/\s+/g, ' ').trim();
  const dates = [...text.matchAll(/(\d{1,2}\/\d{1,2}\/\d{4})/g)].map((m) =>
    parseNumericDate(m[1]!),
  );
  const times = [...text.matchAll(/(\d{1,2})[:h](\d{2})/g)].map(
    (m) => `${pad(Number(m[1]))}:${m[2]}`,
  );
  const first = dates[0];
  if (!first) return null;
  const last = dates[1] ?? first;
  if (times.length === 0) {
    return {
      start: `${first}T00:00`,
      ...(last !== first ? { end: `${last}T23:59` } : {}),
      allDay: true,
    };
  }
  const start = `${first}T${times[0]}`;
  const endTime = times[1];
  return {
    start,
    ...(endTime ? { end: `${last}T${endTime}` } : last !== first ? { end: `${last}T23:59` } : {}),
    allDay: false,
  };
}

const DAYS: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 7,
};

export interface Slot {
  day: number;
  open: string;
  close: string;
}

const toTime = (h: string, m?: string) => `${pad(Number(h))}:${m ? pad(Number(m)) : '00'}`;

/**
 * Lit des horaires d'ouverture rédigés en français, par exemple :
 * « Lundi, Mardi, Mercredi, Jeudi : de 10 h à 12 h 30
 *   Vendredi : de 10 h à 12 h 30 et de 14 h à 16 h 30 ».
 */
export function parseOpeningHours(text: string): Slot[] {
  const slots: Slot[] = [];
  const lines = text
    .replace(/\u00a0/g, ' ')
    .split(/\n|(?<=\d)\s*(?=(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b)/i);
  for (const line of lines) {
    const [daysPart, hoursPart] = line.split(/:(.*)/s);
    if (!daysPart || !hoursPart) continue;
    const days = [
      ...daysPart.toLowerCase().matchAll(/lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/g),
    ]
      .map((m) => DAYS[m[0]]!)
      .filter(Boolean);
    const ranges = [
      ...hoursPart.matchAll(/de\s*(\d{1,2})\s*h\s*(\d{2})?\s*à\s*(\d{1,2})\s*h\s*(\d{2})?/gi),
    ];
    for (const day of days) {
      for (const r of ranges) {
        slots.push({ day, open: toTime(r[1]!, r[2]), close: toTime(r[3]!, r[4]) });
      }
    }
  }
  return slots.sort((a, b) => a.day - b.day || a.open.localeCompare(b.open));
}
