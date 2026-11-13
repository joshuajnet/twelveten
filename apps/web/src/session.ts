import { computed, reactive } from 'vue';
import { api } from '@/api/client';

export interface SessionUser {
    id: string;
    name: string;
    email: string;
    role: string;
}

/**
 * Who is signed in. Only checked when this browser has signed in before (a localStorage hint),
 * so ordinary visitors never call the session endpoint.
 */
const HINT = 'tt-admin';
export const session = reactive<{ user: SessionUser | null; loaded: boolean }>({ user: null, loaded: false });
export const isAdmin = computed(() => session.user?.role === 'admin');

function hasHint(): boolean {
    try {
        return localStorage.getItem(HINT) === '1';
    } catch {
        return false;
    }
}

export function setHint(on: boolean) {
    try {
        if (on) localStorage.setItem(HINT, '1');
        else localStorage.removeItem(HINT);
    } catch {
        // storage unavailable (private mode): sessions still work, just re-checked via /admin/login
    }
}

export async function loadSession(force = false): Promise<SessionUser | null> {
    if (!force && !hasHint()) {
        session.loaded = true;
        return null;
    }
    try {
        const { user } = await api.request<{ user: SessionUser | null }>('/session');
        session.user = user;
        if (!user) setHint(false);
    } catch {
        session.user = null;
    }
    session.loaded = true;
    return session.user;
}
