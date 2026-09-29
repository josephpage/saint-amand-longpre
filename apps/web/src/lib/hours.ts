import type { OpeningSlot } from '@sal/model';
import { formatTime, TIME_ZONE } from './dates.ts';

const DAY_NAMES = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Jour ISO (1 = lundi) et minutes écoulées depuis minuit, à l'heure de Paris. */
function parisClock(now: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[get('weekday')] ?? 1;
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export interface OpeningStatus {
  open: boolean;
  label: string;
}

/** « Mairie ouverte · ferme à 12 h 30 » ou « Mairie fermée · ouvre demain à 10 h ». */
export function openingStatus(slots: OpeningSlot[], now: Date = new Date()): OpeningStatus {
  if (slots.length === 0) return { open: false, label: 'Horaires non communiqués' };
  const clock = parisClock(now);
  const today = slots
    .filter((s) => s.day === clock.day)
    .sort((a, b) => a.open.localeCompare(b.open));
  const current = today.find(
    (s) => clock.minutes >= minutes(s.open) && clock.minutes < minutes(s.close),
  );
  if (current)
    return { open: true, label: `Mairie ouverte · ferme à ${formatTime(current.close)}` };

  const later = today.find((s) => minutes(s.open) > clock.minutes);
  if (later)
    return { open: false, label: `Mairie fermée · ouvre aujourd’hui à ${formatTime(later.open)}` };
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = ((clock.day - 1 + offset) % 7) + 1;
    const next = slots.filter((s) => s.day === day).sort((a, b) => a.open.localeCompare(b.open))[0];
    if (next) {
      const when = offset === 1 ? 'demain' : DAY_NAMES[day];
      return { open: false, label: `Mairie fermée · ouvre ${when} à ${formatTime(next.open)}` };
    }
  }
  return { open: false, label: 'Mairie fermée' };
}

export interface HoursLine {
  days: string;
  hours: string;
  dayNumbers: number[];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Regroupe les jours aux horaires identiques : « Lundi au jeudi : 10 h – 12 h 30 ». */
export function summarizeHours(slots: OpeningSlot[]): HoursLine[] {
  const byDay = new Map<number, string>();
  for (let day = 1; day <= 7; day += 1) {
    const ranges = slots
      .filter((s) => s.day === day)
      .sort((a, b) => a.open.localeCompare(b.open))
      .map((s) => `${formatTime(s.open)} – ${formatTime(s.close)}`);
    if (ranges.length) byDay.set(day, ranges.join(' et '));
  }
  const lines: HoursLine[] = [];
  for (const [day, hours] of byDay) {
    const last = lines.at(-1);
    const lastDay = last?.dayNumbers.at(-1);
    if (last && last.hours === hours && lastDay === day - 1) last.dayNumbers.push(day);
    else lines.push({ days: '', hours, dayNumbers: [day] });
  }
  for (const line of lines) {
    const [a, b] = [line.dayNumbers[0]!, line.dayNumbers.at(-1)!];
    line.days =
      a === b
        ? capitalize(DAY_NAMES[a]!)
        : line.dayNumbers.length === 2
          ? `${capitalize(DAY_NAMES[a]!)} et ${DAY_NAMES[b]}`
          : `Du ${DAY_NAMES[a]} au ${DAY_NAMES[b]}`;
  }
  return lines;
}
