import { describe, expect, it } from 'vitest';
import {
    engagementDots,
    engagementLabel,
    engagementScore,
    packPointer,
    pointerFromBase64,
    pointerToBase64,
    trackBatchSchema,
    unpackPointer,
    workInterest,
    type EngagementInput,
} from './rooms.ts';
import { normalizeEmail, normalizeName } from './people.ts';

const none: EngagementInput = {
    activeMs: 0,
    visits: 1,
    worksTotal: 10,
    worksViewed: 0,
    zooms: 0,
    focusCount: 0,
    inquiries: 0,
    maxWorkViewMs: 0,
    artistReadMs: 0,
    cvOpens: 0,
    pressClicks: 0,
};

describe('engagementScore', () => {
    it('is 0 for a visitor who did nothing', () => {
        expect(engagementScore(none)).toBe(0);
    });

    it('grows with each signal and never exceeds 100', () => {
        const base = engagementScore({ ...none, activeMs: 60_000, worksViewed: 3 });
        expect(engagementScore({ ...none, activeMs: 120_000, worksViewed: 3 })).toBeGreaterThan(base);
        expect(engagementScore({ ...none, activeMs: 60_000, worksViewed: 6 })).toBeGreaterThan(base);
        expect(engagementScore({ ...none, activeMs: 60_000, worksViewed: 3, visits: 3 })).toBeGreaterThan(base);
        expect(engagementScore({ ...none, activeMs: 60_000, worksViewed: 3, zooms: 2 })).toBeGreaterThan(base);
        expect(engagementScore({ ...none, activeMs: 60_000, worksViewed: 3, inquiries: 1 })).toBe(base + 25);
        const max = engagementScore({
            activeMs: 10 * 3600_000,
            visits: 50,
            worksTotal: 10,
            worksViewed: 10,
            zooms: 100,
            focusCount: 100,
            inquiries: 5,
            maxWorkViewMs: 3600_000,
            artistReadMs: 3600_000,
            cvOpens: 5,
            pressClicks: 5,
        });
        expect(max).toBe(100);
    });

    it('handles an empty room', () => {
        expect(engagementScore({ ...none, worksTotal: 0, activeMs: 30_000 })).toBeGreaterThan(0);
    });

    it('labels and dots', () => {
        expect(engagementLabel(0)).toBe('Browsing');
        expect(engagementLabel(30)).toBe('Interested');
        expect(engagementLabel(60)).toBe('Engaged');
        expect(engagementLabel(90)).toBe('Hot');
        expect(engagementDots(0)).toBe(0);
        expect(engagementDots(1)).toBe(1);
        expect(engagementDots(100)).toBe(5);
    });
});

describe('workInterest', () => {
    const zero = { viewMs: 0, hoverMs: 0, zoomMs: 0, zoomCount: 0, focusCount: 0, clicks: 0, inquiries: 0, visitsSeen: 1 };
    it('ranks a zoomed, revisited, inquired work above a glanced one', () => {
        const glance = workInterest({ ...zero, viewMs: 4000 });
        const keen = workInterest({ ...zero, viewMs: 90_000, zoomCount: 3, visitsSeen: 3, inquiries: 1 });
        expect(glance).toBeGreaterThan(0);
        expect(keen).toBeGreaterThan(glance);
        expect(keen).toBeLessThanOrEqual(100);
    });
});

describe('pointer packing', () => {
    it('round-trips through bytes and base64', () => {
        const flat = [0, 65535, 10, 32768, 16384, 35, 65535, 0, 255];
        const bytes = packPointer(flat);
        expect(bytes.byteLength).toBe(15);
        const back = unpackPointer(pointerFromBase64(pointerToBase64(bytes)));
        expect(back).toHaveLength(3);
        expect(back[0]).toEqual({ x: 0, y: 1, zoom: 1 });
        expect(back[1]!.x).toBeCloseTo(0.5, 3);
        expect(back[1]!.zoom).toBeCloseTo(3.5);
        expect(back[2]!.zoom).toBeCloseTo(25.5);
    });

    it('rejects batches with too many samples or broken triples', () => {
        const visitId = '0190a0b0-0000-7000-8000-000000000001';
        const workId = '0190a0b0-0000-7000-8000-000000000002';
        expect(trackBatchSchema.safeParse({ visitId, activeMs: 0, pointer: [{ workId, points: [1, 2] }] }).success).toBe(false);
        const many = Array.from({ length: 4001 * 3 }, () => 1);
        expect(trackBatchSchema.safeParse({ visitId, activeMs: 0, pointer: [{ workId, points: many }] }).success).toBe(false);
        expect(trackBatchSchema.safeParse({ visitId, activeMs: 0, pointer: [{ workId, points: [1, 2, 10] }] }).success).toBe(true);
    });
});

describe('normalize', () => {
    it('emails', () => expect(normalizeEmail('  Pat.Lee@Example.COM ')).toBe('pat.lee@example.com'));
    it('names', () => expect(normalizeName('  José  O’Neil-Smith ')).toBe('jose o neil smith'));
});
