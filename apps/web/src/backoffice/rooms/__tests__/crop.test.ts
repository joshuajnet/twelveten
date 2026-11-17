import { describe, expect, it } from 'vitest';
import { centredCrop, fitCrop, moveCrop, resizeCrop } from '../crop';

const A = 1.5; // frame aspect
const close = (o: Record<string, number>, want: Record<string, number>) => {
    for (const k of Object.keys(want)) expect(o[k]).toBeCloseTo(want[k]!, 6);
};
/** The frame's on-screen aspect over an image of `ratio`. */
const aspectOf = (c: { w: number; h: number }, ratio: number) => (c.w * ratio) / c.h;

describe('centredCrop', () => {
    it('uses the full height of a wide image and the full width of a tall one', () => {
        close(centredCrop(3, A), { w: 0.5, h: 1, x: 0.25, y: 0 });
        close(centredCrop(1, A), { w: 1, h: 1 / A, x: 0, y: (1 - 1 / A) / 2 });
        expect(aspectOf(centredCrop(1, A), 1)).toBeCloseTo(A);
    });
});

describe('moveCrop', () => {
    it('keeps the frame inside the image', () => {
        close(moveCrop({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 }, -1, 2), { x: 0, y: 0.5 });
    });
});

describe('resizeCrop', () => {
    const ratio = 1;
    const start = { x: 0.2, y: 0.2, w: 0.3, h: 0.3 / A };

    it('keeps the opposite corner and the aspect', () => {
        const se = resizeCrop(start, 'se', 0.1, 0, ratio, A);
        close(se, { x: 0.2, y: 0.2, w: 0.4 });
        expect(aspectOf(se, ratio)).toBeCloseTo(A);
        const nw = resizeCrop(start, 'nw', -0.1, 0, ratio, A);
        expect(nw.x + nw.w).toBeCloseTo(start.x + start.w);
        expect(nw.y + nw.h).toBeCloseTo(start.y + start.h);
        expect(nw.w).toBeCloseTo(0.4);
    });

    it('follows the larger drag direction', () => {
        const r = resizeCrop(start, 'se', 0, 0.2, ratio, A);
        expect(r.h).toBeCloseTo(start.h + 0.2);
    });

    it('stops at the image edge and at the minimum size', () => {
        const big = resizeCrop(start, 'se', 5, 5, ratio, A);
        expect(big.x + big.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(big.y + big.h).toBeLessThanOrEqual(1 + 1e-9);
        expect(aspectOf(big, ratio)).toBeCloseTo(A);
        const tiny = resizeCrop(start, 'se', -5, -5, ratio, A);
        expect(tiny.w).toBeCloseTo(0.05);
    });
});

describe('fitCrop', () => {
    it('falls back to the centred frame, and refits a saved crop to the image', () => {
        close(fitCrop(null, 3, A), centredCrop(3, A));
        const c = fitCrop({ x: 0.9, y: 0.9, w: 0.4, h: 0.4 }, 1, A);
        expect(aspectOf(c, 1)).toBeCloseTo(A);
        expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
    });
});
