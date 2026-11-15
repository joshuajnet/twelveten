import { formatDate, INVOICE_STATUSES, type InvoiceStatus, WORK_LOCATIONS, WORK_STATUSES, type WorkLocation, type WorkStatus } from '@twelveten/shared';

export const statusLabel = (s: WorkStatus) => WORK_STATUSES[s];
export const locationLabel = (l: WorkLocation | null) => (l ? WORK_LOCATIONS[l] : '');

/** Badge colours per sale status. */
export const statusClass: Record<WorkStatus, string> = {
    available: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    on_hold: 'bg-amber-50 text-amber-900 ring-amber-600/20',
    sold: 'bg-rose-50 text-rose-800 ring-rose-600/20',
    nfs: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    returned: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export const born = (date: string | null, place?: string | null) => [date ? formatDate(date) : null, place].filter(Boolean).join(', ');

/** Birth year only, for compact tables. */
export const bornYear = (date: string | null) => (date ? date.slice(0, 4) : '');

export const dateTime = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter((w) => /^[\p{L}]/u.test(w))
        .slice(0, 2)
        .map((w) => w[0]!.toUpperCase())
        .join('');

export const invoiceStatusLabel = (s: InvoiceStatus) => INVOICE_STATUSES[s];
export const invoiceStatusClass: Record<InvoiceStatus, string> = {
    open: 'bg-amber-50 text-amber-900 ring-amber-600/20',
    partial: 'bg-sky-50 text-sky-900 ring-sky-700/20',
    paid: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
    cancelled: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

/** Always two decimals: '$2,646.00'. */
export const money = (cents: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(cents / 100);

/** Today as YYYY-MM-DD in local time. */
export const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
