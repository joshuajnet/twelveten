import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MEDIA_VARIANTS } from '@twelveten/shared';
import { deriveAll, deriveImage, diskIO } from './derive.ts';

let dir = '';
beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'derive-'));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

async function original(key: string, width: number, height: number, opts: { orientation?: number; p3?: boolean } = {}) {
    let img = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } });
    if (opts.p3) img = img.withIccProfile('p3');
    const body = await img.jpeg({ quality: 90 }).withMetadata(opts.orientation ? { orientation: opts.orientation } : {}).toBuffer();
    await diskIO(dir).write(key, body, 'image/jpeg');
}

describe('deriveImage', () => {
    it('makes every derivative: rotated, sRGB, never enlarged, zoom progressive', async () => {
        const io = diskIO(dir);
        await original('media/uploads/big.jpg', 4000, 3000, { orientation: 6, p3: true });
        expect(await deriveImage(io, 'media/uploads/big.jpg')).toBe('derived');
        // 3000 wide after rotation: every size up to 2400.
        for (const name of MEDIA_VARIANTS) expect(await io.exists(`media/derived/uploads/big.jpg/${name}`)).toBe(true);

        const meta = async (name: string) => sharp((await io.read(`media/derived/uploads/big.jpg/${name}`))!).metadata();
        // Portrait after EXIF rotation.
        const w2400 = await meta('w2400.webp');
        expect([w2400.width, w2400.height]).toEqual([2400, 3200]);
        expect(w2400.space).toBe('srgb');
        expect(w2400.orientation ?? 1).toBe(1);
        const zoom = await meta('zoom.jpg');
        expect([zoom.width, zoom.height]).toEqual([3000, 4000]);
        expect(zoom.isProgressive).toBe(true);
        expect(zoom.chromaSubsampling).toBe('4:4:4');
        expect((await meta('w48.webp')).width).toBe(48);

        // Second run: nothing to do.
        expect(await deriveImage(io, 'media/uploads/big.jpg')).toBe('skipped');
    });

    it('caps widths at the original size, skips non-raster files, and backfills', async () => {
        const io = diskIO(dir);
        await original('media/images/small.jpg', 1000, 800);
        await io.write('media/images/logo.svg', Buffer.from('<svg/>'), 'image/svg+xml');
        expect(await deriveImage(io, 'media/images/logo.svg')).toBe('unsupported');
        const counts = await deriveAll(io, { prefix: 'images/' });
        expect(counts).toMatchObject({ derived: 1 });
        // No width wider than the original: srcset widths stay true.
        expect(await io.exists('media/derived/images/small.jpg/w1600.webp')).toBe(false);
        expect((await sharp((await io.read('media/derived/images/small.jpg/w960.webp'))!).metadata()).width).toBe(960);
        expect((await sharp((await io.read('media/derived/images/small.jpg/zoom.jpg'))!).metadata()).width).toBe(1000);
        expect(await deriveImage(io, 'media/images/missing.jpg')).toBe('missing');
    });
});
