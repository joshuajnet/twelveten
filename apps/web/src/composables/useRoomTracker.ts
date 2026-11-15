import { onBeforeUnmount, onMounted, type Directive } from 'vue';
import { MAX_POINTER_POINTS, type TrackBatch, type TrackEventType } from '@twelveten/shared';

/** Seconds of no input after which time stops counting as active. */
const IDLE_MS = 60_000;
const TICK_MS = 1000;
const FLUSH_MS = 10_000;
const MIN_POINTER_GAP_MS = 250;

interface WorkAcc {
    viewMs: number;
    hoverMs: number;
    zoomMs: number;
    focus: number;
    zooms: number;
    maxZoom: number;
    clicks: number;
    inquiries: number;
}
interface ArtistAcc {
    readMs: number;
    opens: number;
    cvOpens: number;
    pressClicks: number;
}

const emptyWork = (): WorkAcc => ({ viewMs: 0, hoverMs: 0, zoomMs: 0, focus: 0, zooms: 0, maxZoom: 1, clicks: 0, inquiries: 0 });
const emptyArtist = (): ArtistAcc => ({ readMs: 0, opens: 0, cvOpens: 0, pressClicks: 0 });

export interface RoomTracker {
    /** `v-track-work="workId"`: time in view, hover time and pointer samples over the element. */
    vTrackWork: Directive<HTMLElement, string>;
    /** `v-track-artist="artistId"`: time the artist's section is in view. */
    vTrackArtist: Directive<HTMLElement, string>;
    count(workId: string, what: 'focus' | 'zooms' | 'clicks' | 'inquiries'): void;
    countArtist(artistId: string, what: 'opens' | 'cvOpens' | 'pressClicks'): void;
    event(type: TrackEventType, opts?: { workId?: string | null; artistId?: string | null; data?: Record<string, string | number | boolean | null> }): void;
    /** Pointer over a work's image, x and y 0–1 across it. */
    pointer(workId: string, x: number, y: number, zoom?: number): void;
    /** The zoom viewer is showing this work (null when closed). */
    zooming(workId: string | null, level?: number): void;
    flush(beacon?: boolean): void;
}

/**
 * Records how a visitor browses a viewing room and sends it in small batches (every 10 s, and with
 * `sendBeacon` when the page is hidden or left). Time only counts while the tab is visible and the
 * visitor has done something in the last minute. With no `visitId` (admin preview) nothing is sent.
 */
export function useRoomTracker(opts: { token: string; visitId: string | null }): RoomTracker {
    const enabled = Boolean(opts.visitId);
    let works = new Map<string, WorkAcc>();
    let artists = new Map<string, ArtistAcc>();
    let events: NonNullable<TrackBatch['events']> = [];
    let pointer = new Map<string, number[]>();
    let pointerCount = 0;
    let activeMs = 0;

    const inView = new Map<Element, string>();
    const artistsInView = new Map<Element, string>();
    let hovered: string | null = null;
    let zoomWork: string | null = null;
    let zoomLevel = 1;
    let lastInput = Date.now();
    let lastPointerAt = 0;

    const work = (id: string) => works.get(id) ?? (works.set(id, emptyWork()), works.get(id)!);
    const artist = (id: string) => artists.get(id) ?? (artists.set(id, emptyArtist()), artists.get(id)!);
    const active = () => document.visibilityState === 'visible' && Date.now() - lastInput < IDLE_MS;

    const observer =
        typeof IntersectionObserver !== 'undefined'
            ? new IntersectionObserver(
                  (entries) => {
                      for (const e of entries) {
                          const map = (e.target as HTMLElement).dataset.trackArtist ? artistsInView : inView;
                          const id = (e.target as HTMLElement).dataset.trackWork ?? (e.target as HTMLElement).dataset.trackArtist!;
                          if (e.intersectionRatio >= 0.5) map.set(e.target, id);
                          else map.delete(e.target);
                      }
                  },
                  { threshold: [0, 0.5, 1] },
              )
            : null;

    function tick() {
        if (!active()) return;
        activeMs += TICK_MS;
        // Behind the zoom viewer the page isn't being looked at.
        if (zoomWork) {
            const w = work(zoomWork);
            w.zoomMs += TICK_MS;
            w.viewMs += TICK_MS;
            return;
        }
        for (const id of new Set(inView.values())) work(id).viewMs += TICK_MS;
        for (const id of new Set(artistsInView.values())) artist(id).readMs += TICK_MS;
        if (hovered) work(hovered).hoverMs += TICK_MS;
    }

    function take(): TrackBatch | null {
        if (!works.size && !artists.size && !events.length && !pointer.size && activeMs < TICK_MS) return null;
        const batch: TrackBatch = {
            visitId: opts.visitId!,
            activeMs,
            works: [...works].map(([workId, w]) => ({ workId, ...w })),
            artists: [...artists].map(([artistId, a]) => ({ artistId, ...a })),
            events,
            pointer: [...pointer].map(([workId, points]) => ({ workId, points })),
        };
        works = new Map();
        artists = new Map();
        events = [];
        pointer = new Map();
        pointerCount = 0;
        activeMs = 0;
        return batch;
    }

    /** Put a batch that failed to send back, so the next flush retries it. */
    function restore(b: TrackBatch) {
        activeMs += b.activeMs;
        for (const w of b.works ?? []) {
            const acc = work(w.workId);
            for (const k of ['viewMs', 'hoverMs', 'zoomMs', 'focus', 'zooms', 'clicks', 'inquiries'] as const) acc[k] += w[k] ?? 0;
            acc.maxZoom = Math.max(acc.maxZoom, w.maxZoom ?? 1);
        }
        for (const a of b.artists ?? []) {
            const acc = artist(a.artistId);
            for (const k of ['readMs', 'opens', 'cvOpens', 'pressClicks'] as const) acc[k] += a[k] ?? 0;
        }
        events = [...(b.events ?? []), ...events].slice(-200);
    }

    const url = `/api/rooms/${opts.token}/track`;
    function flush(beacon = false) {
        if (!enabled) return;
        const batch = take();
        if (!batch) return;
        const body = JSON.stringify(batch);
        if (beacon && navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return;
        fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', keepalive: true })
            .then((r) => {
                // 4xx: the batch is bad (or the room closed); don't retry it.
                if (r.status >= 500) restore(batch);
            })
            .catch(() => restore(batch));
    }

    const onInput = () => (lastInput = Date.now());
    const onHide = () => document.visibilityState === 'hidden' && flush(true);
    const onPageHide = () => flush(true);
    let tickTimer: ReturnType<typeof setInterval> | undefined;
    let flushTimer: ReturnType<typeof setInterval> | undefined;

    onMounted(() => {
        if (!enabled) return;
        for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']) window.addEventListener(e, onInput, { passive: true });
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', onPageHide);
        tickTimer = setInterval(tick, TICK_MS);
        flushTimer = setInterval(() => flush(), FLUSH_MS);
    });
    onBeforeUnmount(() => {
        clearInterval(tickTimer);
        clearInterval(flushTimer);
        observer?.disconnect();
        for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']) window.removeEventListener(e, onInput);
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('pagehide', onPageHide);
        flush(true);
    });

    function addPointer(workId: string, x: number, y: number, zoom: number) {
        if (!enabled || pointerCount >= MAX_POINTER_POINTS) return;
        const list = pointer.get(workId) ?? (pointer.set(workId, []), pointer.get(workId)!);
        const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 65535);
        list.push(clamp(x), clamp(y), Math.round(Math.min(25.5, Math.max(1, zoom)) * 10));
        pointerCount++;
    }

    function onElementMove(this: void, e: PointerEvent) {
        const el = e.currentTarget as HTMLElement;
        const id = el.dataset.trackWork;
        const now = performance.now();
        if (!id || now - lastPointerAt < MIN_POINTER_GAP_MS) return;
        // Measure against the image inside the element when there is one.
        const img = el.tagName === 'IMG' ? el : el.querySelector('img');
        const r = (img ?? el).getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        if (x < 0 || x > 1 || y < 0 || y > 1) return;
        lastPointerAt = now;
        addPointer(id, x, y, 1);
    }
    const onEnter = (e: PointerEvent) => (hovered = (e.currentTarget as HTMLElement).dataset.trackWork ?? null);
    const onLeave = () => (hovered = null);

    const vTrackWork: Directive<HTMLElement, string> = {
        mounted(el, binding) {
            el.dataset.trackWork = binding.value;
            observer?.observe(el);
            el.addEventListener('pointerenter', onEnter);
            el.addEventListener('pointerleave', onLeave);
            el.addEventListener('pointermove', onElementMove);
        },
        updated(el, binding) {
            if (el.dataset.trackWork === binding.value) return;
            el.dataset.trackWork = binding.value;
            inView.delete(el);
            observer?.unobserve(el);
            observer?.observe(el);
        },
        unmounted(el) {
            observer?.unobserve(el);
            inView.delete(el);
            if (hovered === el.dataset.trackWork) hovered = null;
            el.removeEventListener('pointerenter', onEnter);
            el.removeEventListener('pointerleave', onLeave);
            el.removeEventListener('pointermove', onElementMove);
        },
    };
    const vTrackArtist: Directive<HTMLElement, string> = {
        mounted(el, binding) {
            el.dataset.trackArtist = binding.value;
            observer?.observe(el);
        },
        unmounted(el) {
            observer?.unobserve(el);
            artistsInView.delete(el);
        },
    };

    return {
        vTrackWork,
        vTrackArtist,
        count(workId, what) {
            if (enabled) work(workId)[what]++;
        },
        countArtist(artistId, what) {
            if (enabled) artist(artistId)[what]++;
        },
        event(type, o = {}) {
            if (!enabled || events.length >= 200) return;
            events.push({ type, at: new Date().toISOString(), workId: o.workId ?? null, artistId: o.artistId ?? null, data: o.data });
        },
        pointer(workId, x, y, zoom = 1) {
            addPointer(workId, x, y, zoom);
        },
        zooming(workId, level = 1) {
            if (!enabled) return;
            zoomWork = workId;
            zoomLevel = level;
            if (workId) work(workId).maxZoom = Math.max(work(workId).maxZoom, zoomLevel);
        },
        flush,
    };
}
