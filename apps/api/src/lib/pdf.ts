import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pdfmake from 'pdfmake';

/**
 * The one pdfmake instance. Fonts are the PDF standard fonts (built into pdfkit) plus the gallery
 * fonts, which are read once into pdfmake's in-memory file system. Nothing is fetched from the
 * network, and no other local file can be read while rendering.
 */
const STANDARD_FONTS = new Set(['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique']);
const GALLERY_FONT_FILES = [
    'GermaniaOne-Regular.ttf',
    'GentiumBookPlus-Regular.ttf',
    'GentiumBookPlus-Bold.ttf',
    'GentiumBookPlus-Italic.ttf',
    'GentiumBookPlus-BoldItalic.ttf',
];

const policies = pdfmake as unknown as {
    setUrlAccessPolicy(cb: (url: string) => boolean): void;
    setLocalAccessPolicy(cb: (path: string) => boolean): void;
    virtualfs: { writeFileSync(name: string, data: Buffer): void };
};
policies.setUrlAccessPolicy(() => false);
policies.setLocalAccessPolicy((path) => STANDARD_FONTS.has(path));

pdfmake.setFonts({
    Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' },
});

/** assets/fonts in the source tree, or fonts/ next to the Lambda bundle. */
function fontsDir(): string {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [join(here, 'fonts'), join(here, '../../assets/fonts')];
    const found = candidates.find((d) => existsSync(join(d, GALLERY_FONT_FILES[0]!)));
    if (!found) throw new Error(`Gallery fonts not found (looked in ${candidates.join(', ')})`);
    return found;
}

let galleryFontsLoaded = false;
/** Register Germania One ('Germania') and Gentium Book Plus ('Gentium'); read from disk once. */
export function useGalleryFonts(): void {
    if (galleryFontsLoaded) return;
    const dir = fontsDir();
    for (const file of GALLERY_FONT_FILES) policies.virtualfs.writeFileSync(file, readFileSync(join(dir, file)));
    pdfmake.addFonts({
        Germania: { normal: 'GermaniaOne-Regular.ttf', bold: 'GermaniaOne-Regular.ttf', italics: 'GermaniaOne-Regular.ttf', bolditalics: 'GermaniaOne-Regular.ttf' },
        Gentium: {
            normal: 'GentiumBookPlus-Regular.ttf',
            bold: 'GentiumBookPlus-Bold.ttf',
            italics: 'GentiumBookPlus-Italic.ttf',
            bolditalics: 'GentiumBookPlus-BoldItalic.ttf',
        },
    });
    galleryFontsLoaded = true;
}

export { pdfmake };
