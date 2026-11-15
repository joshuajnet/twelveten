import type { RouteLocationRaw } from 'vue-router';
import { exhibitionPath, type InquirySummary } from '@twelveten/shared';

/** Where an inquiry's item lives: the work in the inventory, else the exhibition page, else the room. */
export function itemLink(i: InquirySummary): { to: RouteLocationRaw } | { href: string } | null {
    if (i.workId) return { to: { name: 'bo-work', params: { id: i.workId } } };
    if (i.exhibition) return { href: exhibitionPath(i.exhibition) };
    if (i.room) return { to: { name: 'bo-room', params: { id: i.room.id } } };
    return null;
}

/** The inquiry on the person's collector tab. */
export const inquiryOnProfile = (i: InquirySummary): RouteLocationRaw => ({
    name: 'bo-person',
    params: { id: i.personId, profile: 'collector' },
    hash: `#inquiry-${i.id}`,
});

/** "2 h ago", "3 d ago", or a date. */
export function ago(iso: string): string {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
