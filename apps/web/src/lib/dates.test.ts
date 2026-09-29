import { describe, expect, it } from 'vitest';
import {
  dateBadge,
  formatDate,
  formatEventDate,
  formatEventTime,
  formatTime,
  todayInParis,
} from './dates.ts';

describe('dates', () => {
  it('formate une date en français', () => {
    expect(formatDate('2026-09-12')).toBe('12 septembre 2026');
    expect(formatDate('2026-06-01')).toBe('1er juin 2026');
  });
  it('produit une pastille de date', () => {
    expect(dateBadge('2026-10-10T09:00')).toEqual({ weekday: 'sam.', day: '10', month: 'oct.' });
  });
  it('formate les heures à la française', () => {
    expect(formatTime('09:00')).toBe('9 h');
    expect(formatTime('12:30')).toBe('12 h 30');
  });
  it('décrit l’horaire d’un évènement', () => {
    expect(formatEventTime('2026-10-10T09:00', '2026-10-10T13:00', false)).toBe('9 h – 13 h');
    expect(formatEventTime('2026-10-10T09:00', undefined, false)).toBe('9 h');
    expect(formatEventTime('2026-10-10T00:00', undefined, true)).toBe('Toute la journée');
  });
  it('décrit la date d’un évènement sur un ou plusieurs jours', () => {
    expect(formatEventDate('2026-10-10T09:00', undefined)).toBe('Samedi 10 octobre 2026');
    expect(formatEventDate('2026-10-10T09:00', '2026-10-12T18:00')).toBe(
      'Du 10 octobre 2026 au 12 octobre 2026',
    );
  });
  it('donne la date du jour à Paris', () => {
    // 23 h 30 UTC le 30 septembre = 1 h 30 le 1er octobre à Paris.
    expect(todayInParis(new Date('2026-09-30T23:30:00Z'))).toBe('2026-10-01');
  });
});
