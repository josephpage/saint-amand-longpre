import { describe, expect, it } from 'vitest';
import { openingStatus, summarizeHours } from './hours.ts';

const SLOTS = [
  { day: 1, open: '10:00', close: '12:30' },
  { day: 2, open: '10:00', close: '12:30' },
  { day: 3, open: '10:00', close: '12:30' },
  { day: 4, open: '10:00', close: '12:30' },
  { day: 5, open: '10:00', close: '12:30' },
  { day: 5, open: '14:00', close: '16:30' },
];

// Les instants sont exprimés en UTC ; Paris est à UTC+2 en été (CEST).
const at = (iso: string) => new Date(iso);

describe('openingStatus', () => {
  it('indique l’heure de fermeture pendant l’ouverture', () => {
    expect(openingStatus(SLOTS, at('2026-09-28T09:00:00Z'))).toEqual({
      open: true,
      label: 'Mairie ouverte · ferme à 12 h 30',
    });
  });
  it('annonce la réouverture de l’après-midi le vendredi', () => {
    expect(openingStatus(SLOTS, at('2026-10-02T11:00:00Z')).label).toBe(
      'Mairie fermée · ouvre aujourd’hui à 14 h',
    );
  });
  it('annonce l’ouverture du lendemain le soir', () => {
    expect(openingStatus(SLOTS, at('2026-09-28T18:00:00Z')).label).toBe(
      'Mairie fermée · ouvre demain à 10 h',
    );
  });
  it('saute le week-end', () => {
    expect(openingStatus(SLOTS, at('2026-10-03T10:00:00Z')).label).toBe(
      'Mairie fermée · ouvre lundi à 10 h',
    );
  });
  it('tient compte de l’heure d’hiver', () => {
    // 9 h 30 UTC en décembre = 10 h 30 à Paris.
    expect(openingStatus(SLOTS, at('2026-12-07T09:30:00Z')).open).toBe(true);
  });
  it('gère l’absence d’horaires', () => {
    expect(openingStatus([], at('2026-09-28T09:00:00Z')).label).toBe('Horaires non communiqués');
  });
});

describe('summarizeHours', () => {
  it('regroupe les jours aux horaires identiques', () => {
    expect(summarizeHours(SLOTS).map(({ days, hours }) => ({ days, hours }))).toEqual([
      { days: 'Du lundi au jeudi', hours: '10 h – 12 h 30' },
      { days: 'Vendredi', hours: '10 h – 12 h 30 et 14 h – 16 h 30' },
    ]);
  });
});
