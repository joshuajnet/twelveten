/**
 * Date display helpers. Stored values are ISO dates ('2026-04-04') for whole days and
 * ISO timestamps for moments in time; all display text is derived here.
 */

export const GALLERY_TIMEZONE = 'America/Chicago';
const DASH = ' — ';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export function ordinal(n: number): string {
    const rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
    switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

interface DayParts { year: number; month: number; day: number }

/** Parse a stored ISO date ('YYYY-MM-DD'). Throws on anything else. */
export function parseIsoDate(value: string): DayParts {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) throw new Error(`Invalid ISO date: ${value}`);
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
        throw new Error(`Invalid ISO date: ${value}`);
    }
    return { year, month, day };
}

function monthName(month: number): string {
    return MONTHS[month - 1]!;
}

/** 'July 1st, 2026' */
export function formatDate(isoDate: string): string {
    const d = parseIsoDate(isoDate);
    return `${monthName(d.month)} ${ordinal(d.day)}, ${d.year}`;
}

/**
 * Collapses repeated parts:
 *   same month     → 'December 1st — 5th, 2026'
 *   same year      → 'April 4th — May 23rd, 2026'
 *   different years→ 'November 17th, 2023 — January 12th, 2024'
 *   same day       → 'April 4th, 2026'
 */
export function formatDateRange(startIso: string, endIso: string): string {
    const s = parseIsoDate(startIso);
    const e = parseIsoDate(endIso);
    if (s.year === e.year && s.month === e.month && s.day === e.day) return formatDate(startIso);
    if (s.year !== e.year) return `${formatDate(startIso)}${DASH}${formatDate(endIso)}`;
    if (s.month === e.month) return `${monthName(s.month)} ${ordinal(s.day)}${DASH}${ordinal(e.day)}, ${s.year}`;
    return `${monthName(s.month)} ${ordinal(s.day)}${DASH}${monthName(e.month)} ${ordinal(e.day)}, ${s.year}`;
}

interface ZonedParts extends DayParts { hour: number; minute: number }

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(instant: string | Date, timeZone: string = GALLERY_TIMEZONE): ZonedParts {
    const date = typeof instant === 'string' ? new Date(instant) : instant;
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${String(instant)}`);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/** '6PM', '6:30PM', '12PM' */
export function formatClock(hour: number, minute: number): string {
    const suffix = hour < 12 ? 'AM' : 'PM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return minute === 0 ? `${h12}${suffix}` : `${h12}:${String(minute).padStart(2, '0')}${suffix}`;
}

/**
 * 'April 4th, 6PM — 9PM' (year omitted: shown under the exhibition's date range).
 * If the event ends on a different day: 'April 4th, 6PM — April 5th, 2AM'.
 */
export function formatEventTime(startsAt: string, endsAt: string | null, timeZone: string = GALLERY_TIMEZONE): string {
    const s = zonedParts(startsAt, timeZone);
    const start = `${monthName(s.month)} ${ordinal(s.day)}, ${formatClock(s.hour, s.minute)}`;
    if (!endsAt) return start;
    const e = zonedParts(endsAt, timeZone);
    const sameDay = s.year === e.year && s.month === e.month && s.day === e.day;
    const end = sameDay
        ? formatClock(e.hour, e.minute)
        : `${monthName(e.month)} ${ordinal(e.day)}, ${formatClock(e.hour, e.minute)}`;
    return `${start}${DASH}${end}`;
}

/** 'Opening: April 4th, 6PM — 9PM' */
export function formatEvent(
    event: { label: string; startsAt: string; endsAt: string | null },
    timeZone: string = GALLERY_TIMEZONE,
): string {
    return `${event.label}: ${formatEventTime(event.startsAt, event.endsAt, timeZone)}`;
}

/** Today's date ('YYYY-MM-DD') in a time zone. */
export function todayIso(timeZone: string = GALLERY_TIMEZONE, now: Date = new Date()): string {
    const p = zonedParts(now, timeZone);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export type ExhibitionStatus = 'upcoming' | 'current' | 'past';

/** ISO date strings compare correctly as strings. */
export function exhibitionStatus(startsOn: string, endsOn: string, today: string): ExhibitionStatus {
    if (today < startsOn) return 'upcoming';
    if (today > endsOn) return 'past';
    return 'current';
}

/** Offset (minutes) of a time zone from UTC at an instant. */
function offsetMinutes(instant: Date, timeZone: string): number {
    const p = zonedParts(instant, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    return (asUtc - Math.floor(instant.getTime() / 60000) * 60000) / 60000;
}

/**
 * Convert a wall-clock time in a time zone ('2026-04-04 18:00') to an ISO UTC timestamp.
 * DST-aware: resolves the zone's offset at that moment.
 */
export function zonedToIso(wallClock: string, timeZone: string = GALLERY_TIMEZONE): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(wallClock);
    if (!m) throw new Error(`Expected 'YYYY-MM-DD HH:mm', got ${wallClock}`);
    const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
    const naive = Date.UTC(y, mo - 1, d, h, mi);
    let guess = naive - offsetMinutes(new Date(naive), timeZone) * 60000;
    guess = naive - offsetMinutes(new Date(guess), timeZone) * 60000;
    return new Date(guess).toISOString();
}
