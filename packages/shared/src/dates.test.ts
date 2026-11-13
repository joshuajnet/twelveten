import { describe, it, expect } from 'vitest';
import {
    ordinal, formatDate, formatDateRange, formatEventTime, formatEvent, formatClock,
    exhibitionStatus, todayIso, parseIsoDate,
} from './dates.ts';

describe('ordinal', () => {
    it.each([
        [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'],
        [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [31, '31st'],
    ])('%i → %s', (n, expected) => expect(ordinal(n)).toBe(expected));
});

describe('formatDateRange reproduces the site’s existing date lines', () => {
    it.each([
        ['2026-04-04', '2026-05-23', 'April 4th — May 23rd, 2026'],
        ['2026-06-06', '2026-07-25', 'June 6th — July 25th, 2026'],
        ['2026-02-21', '2026-03-28', 'February 21st — March 28th, 2026'],
        ['2026-01-10', '2026-02-14', 'January 10th — February 14th, 2026'],
        ['2025-06-07', '2025-07-19', 'June 7th — July 19th, 2025'],
        ['2025-04-12', '2025-05-24', 'April 12th — May 24th, 2025'],
        ['2025-02-15', '2025-03-29', 'February 15th — March 29th, 2025'],
        ['2024-11-09', '2024-12-21', 'November 9th — December 21st, 2024'],
        ['2024-09-28', '2024-11-02', 'September 28th — November 2nd, 2024'],
        ['2024-06-08', '2024-07-27', 'June 8th — July 27th, 2024'],
        ['2024-04-05', '2024-05-25', 'April 5th — May 25th, 2024'],
        ['2023-09-29', '2023-11-11', 'September 29th — November 11th, 2023'],
        // fairs: same month collapses
        ['2026-12-01', '2026-12-05', 'December 1st — 5th, 2026'],
        ['2025-12-02', '2025-12-06', 'December 2nd — 6th, 2025'],
        ['2026-04-08', '2026-04-12', 'April 8th — 12th, 2026'],
    ])('%s → %s', (s, e, expected) => expect(formatDateRange(s, e)).toBe(expected));

    it('shows both years when a run crosses New Year', () => {
        expect(formatDateRange('2023-11-17', '2024-01-12')).toBe('November 17th, 2023 — January 12th, 2024');
    });

    it('collapses a single day', () => {
        expect(formatDateRange('2026-04-04', '2026-04-04')).toBe('April 4th, 2026');
    });
});

describe('formatDate', () => {
    it('formats a day', () => expect(formatDate('2026-07-01')).toBe('July 1st, 2026'));
    it('rejects invalid dates', () => {
        expect(() => parseIsoDate('2026-02-30')).toThrow();
        expect(() => parseIsoDate('July 1st')).toThrow();
    });
});

describe('event times (America/Chicago)', () => {
    it('formats an opening in gallery time', () => {
        // 6–9PM CDT == 23:00–02:00 UTC
        expect(formatEventTime('2026-04-04T23:00:00Z', '2026-04-05T02:00:00Z')).toBe('April 4th, 6PM — 9PM');
    });

    it('handles standard time (CST) correctly', () => {
        expect(formatEventTime('2024-11-10T00:00:00Z', '2024-11-10T03:00:00Z')).toBe('November 9th, 6PM — 9PM');
    });

    it('formats minutes and labels', () => {
        expect(formatEvent({ label: 'Artist Talk', startsAt: '2026-04-10T20:00:00Z', endsAt: '2026-04-10T22:30:00Z' }))
            .toBe('Artist Talk: April 10th, 3PM — 5:30PM');
    });

    it('formats in a fair’s own time zone', () => {
        expect(formatEventTime('2026-12-01T16:00:00Z', null, 'America/New_York')).toBe('December 1st, 11AM');
    });

    it('spans days when the end is on another day', () => {
        expect(formatEventTime('2026-04-04T23:00:00Z', '2026-04-05T08:00:00Z')).toBe('April 4th, 6PM — April 5th, 3AM');
    });

    it.each([[0, 0, '12AM'], [12, 0, '12PM'], [18, 0, '6PM'], [9, 5, '9:05AM']])(
        'clock %i:%i → %s', (h, m, expected) => expect(formatClock(h, m)).toBe(expected),
    );
});

describe('exhibitionStatus', () => {
    it.each([
        ['2026-04-03', 'upcoming'], ['2026-04-04', 'current'], ['2026-05-23', 'current'], ['2026-05-24', 'past'],
    ])('on %s → %s', (today, expected) => expect(exhibitionStatus('2026-04-04', '2026-05-23', today)).toBe(expected));

    it('uses the gallery’s local day, not UTC', () => {
        // 02:00 UTC on Nov 13 is still Nov 12 in Chicago
        expect(todayIso('America/Chicago', new Date('2026-11-13T02:00:00Z'))).toBe('2026-11-12');
    });
});
