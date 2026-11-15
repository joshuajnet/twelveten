import type { InvoicePaymentDetails } from '@twelveten/shared';
import { config } from '../config.ts';

/** Payment details for invoices, from env (INVOICE_*). */
export function paymentDetails(): InvoicePaymentDetails {
    const c = config();
    return {
        zelle: c.INVOICE_ZELLE || null,
        wireRouting: c.INVOICE_WIRE_ROUTING || null,
        wireAccount: c.INVOICE_WIRE_ACCOUNT || null,
        checksPayableTo: c.INVOICE_CHECKS_PAYABLE_TO || null,
    };
}

/** For the back office: shows what is set without exposing the account number. */
export function maskedPaymentDetails(): InvoicePaymentDetails {
    const d = paymentDetails();
    return { ...d, wireAccount: d.wireAccount ? `••••${d.wireAccount.slice(-4)}` : null };
}
