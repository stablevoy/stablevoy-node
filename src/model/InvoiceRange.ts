import type { Fields } from './Fields.js';

/**
 * The amounts an invoice of the store may have now, in US cents: the bounds of the account (the platform ones, or a higher
 * or lower cap set for the account on request) narrowed by the store's own minimum and maximum. Use it to decide whether to
 * offer the payment method; never compute it from platform.limits(), which shows only the platform default.
 */
export interface InvoiceRange {
  readonly minUsdCents: number;
  readonly maxUsdCents: number;
}

/** True when an invoice of `amountUsdCents` would be accepted by `range`. */
export function invoiceRangeContains(range: InvoiceRange, amountUsdCents: number): boolean {
  return amountUsdCents >= range.minUsdCents && amountUsdCents <= range.maxUsdCents;
}

export function parseInvoiceRange(f: Fields): InvoiceRange {
  return { minUsdCents: f.int('minUsdCents'), maxUsdCents: f.int('maxUsdCents') };
}
