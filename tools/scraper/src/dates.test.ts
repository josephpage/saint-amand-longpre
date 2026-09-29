import { describe, expect, it } from 'vitest';
import {
  findDates,
  guessPublicationDate,
  parseEventHeading,
  parseNumericDate,
  parseOpeningHours,
} from './dates.ts';

describe('parseNumericDate', () => {
  it('convertit une date JJ/MM/AAAA', () => {
    expect(parseNumericDate('07/09/2026')).toBe('2026-09-07');
  });
  it('rejette une date impossible', () => {
    expect(parseNumericDate('31/02/2026')).toBeNull();
  });
});

describe('findDates', () => {
  it('repère les dates écrites en toutes lettres et numériques', () => {
    const text = 'Arrêté du 20 juin 2025. À compter du 1er juillet 2022, puis le 19/09/2025.';
    expect(findDates(text)).toEqual(['2025-06-20', '2022-07-01', '2025-09-19']);
  });
  it('gère les mois accentués et les majuscules', () => {
    expect(findDates('Élections du 9 Juin 2024 et du 3 février 2026')).toEqual([
      '2024-06-09',
      '2026-02-03',
    ]);
  });
});

describe('guessPublicationDate', () => {
  it('prend la date passée la plus récente', () => {
    const text = 'Réunion le 3 mars 2025, inscription avant le 10 octobre 2030.';
    expect(guessPublicationDate(text, '2026-09-28T10:00:00Z')).toBe('2025-03-03');
  });
  it('retourne null sans date', () => {
    expect(guessPublicationDate('Venez nombreux !', '2026-09-28')).toBeNull();
  });
});

describe('parseEventHeading', () => {
  it('lit une date avec heure', () => {
    expect(parseEventHeading('le 20/03/2026 à 19:00')).toEqual({
      start: '2026-03-20T19:00',
      allDay: false,
    });
  });
  it('lit une plage horaire', () => {
    expect(parseEventHeading('le 12/04/2025 de 14:00 à 18:00')).toEqual({
      start: '2025-04-12T14:00',
      end: '2025-04-12T18:00',
      allDay: false,
    });
  });
  it('lit une période sur plusieurs jours', () => {
    expect(parseEventHeading('du 12/04/2025 au 14/04/2025')).toEqual({
      start: '2025-04-12T00:00',
      end: '2025-04-14T23:59',
      allDay: true,
    });
  });
  it('retourne null sans date', () => {
    expect(parseEventHeading('Prochainement')).toBeNull();
  });
});

describe('parseOpeningHours', () => {
  it('lit les horaires de la mairie', () => {
    const text =
      'Lundi, Mardi, Mercredi, Jeudi :de 10 h à 12 h 30\n\nVendredi : de 10 h à 12 h 30 et de 14 h à 16 h 30';
    expect(parseOpeningHours(text)).toEqual([
      { day: 1, open: '10:00', close: '12:30' },
      { day: 2, open: '10:00', close: '12:30' },
      { day: 3, open: '10:00', close: '12:30' },
      { day: 4, open: '10:00', close: '12:30' },
      { day: 5, open: '10:00', close: '12:30' },
      { day: 5, open: '14:00', close: '16:30' },
    ]);
  });
});
