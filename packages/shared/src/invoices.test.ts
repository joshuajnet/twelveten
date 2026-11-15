import { describe, expect, it } from 'vitest';
import { formatPercent, invoiceTotals, isUnpaid, parsePercent, roundHalfEven, statusFromPayments } from './invoices.ts';

describe('invoice arithmetic', () => {
    it('matches the paper invoices', () => {
        expect(invoiceTotals([240000], 0, 1025, 0)).toEqual({ subtotalCents: 240000, discountCents: 0, taxCents: 24600, totalCents: 264600 });
        expect(invoiceTotals([160000], 1500, 1025, 0).totalCents).toBe(149940);
        expect(invoiceTotals([260000], 1500, 1025, 0)).toMatchObject({ taxCents: 22652, totalCents: 243652 });
        expect(invoiceTotals([260000, 260000], 1000, 0, 0).totalCents).toBe(468000);
        expect(invoiceTotals([100000], 0, 0, 5000).totalCents).toBe(105000);
    });
    it('rounds halves to even', () => {
        expect([0.5, 1.5, 2.5, 22652.5, 22653.5, 2.4].map(roundHalfEven)).toEqual([0, 2, 2, 22652, 22654, 2]);
    });
    it('derives status from payments', () => {
        expect([statusFromPayments(0, 100), statusFromPayments(50, 100), statusFromPayments(100, 100)]).toEqual(['open', 'partial', 'paid']);
        expect((['open', 'partial', 'paid', 'cancelled'] as const).map(isUnpaid)).toEqual([true, true, false, false]);
    });
    it('parses and formats percentages', () => {
        expect([parsePercent('10.25'), parsePercent('15%'), parsePercent(''), parsePercent('abc'), parsePercent('101')]).toEqual([1025, 1500, 0, Number.NaN, Number.NaN]);
        expect([formatPercent(1025), formatPercent(1000)]).toEqual(['10.25%', '10%']);
    });
});
