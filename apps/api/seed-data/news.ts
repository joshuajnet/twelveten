/**
 * News posts from the old site's news.json, with known data fixes applied.
 * Slugs keep the old URL paths (some don't match their dates) so existing links keep working.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface LegacyNews {
    id: number;
    path: string;
    title: string;
    date: string;
    html: string;
}

export interface SeedNewsPost {
    slug: string;
    title: string;
    /** 'YYYY-MM-DD' (published at noon gallery time) */
    publishedOn: string;
    html: string;
}

/** Year typos in the old date text, corrected from the post's path. */
const DATE_FIXES: Record<string, string> = {
    '14-1-2024': '2024-01-14', // was "January 14th, 2023"
    '6-1-2024': '2024-01-06', // was "January 6th, 2023"
};

/** Title typos. */
const TITLE_FIXES: Record<string, string> = {
    '6-6-2026': '2026 Summer Updates',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseDate(text: string): string {
    const m = /^(\w+)\s+(\d{1,2})\w{2},\s*(\d{4})$/.exec(text.trim());
    const month = m ? MONTHS.indexOf(m[1]!) + 1 : 0;
    if (!m || month === 0) throw new Error(`Unparseable news date: ${text}`);
    return `${m[3]}-${String(month).padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
}

export function loadNews(): SeedNewsPost[] {
    const dir = process.env.SEED_DATA_DIR;
    const file = dir ? `${dir}/news.json` : fileURLToPath(new URL('./news.json', import.meta.url));
    const legacy = JSON.parse(readFileSync(file, 'utf8')) as LegacyNews[];
    return legacy.map((n) => ({
        slug: n.path,
        title: TITLE_FIXES[n.path] ?? n.title.trim(),
        publishedOn: DATE_FIXES[n.path] ?? parseDate(n.date),
        html: n.html,
    }));
}
