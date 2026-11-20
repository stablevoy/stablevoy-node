import type { Fields } from './Fields.js';

/**
 * The price of an invoice created in another currency than USD, and the rate that turned it into amountUsdCents. Fixed when
 * the invoice was created. amount is in the smallest unit of currency: 4999 with exponent 2 is 49.99 EUR.
 */
export interface InvoicePricing {
  /** ISO 4217 code, one of currencies.list(). */
  readonly currency: string;
  readonly amount: number;
  /** Decimal places of currency: 2 for EUR, 0 for JPY. */
  readonly exponent: number;
  /** US dollars for one unit of currency, a decimal string such as "1.0992". */
  readonly usdPerUnit: string;
  /** 'ecb' (ECB reference rate, checked against Coinbase) or 'merchant' (the store's own fixed rate). */
  readonly rateSource: string;
  /** When the rate was valid: the ECB publication time, or when the merchant set the store rate. */
  readonly rateAt: Date;
}

export function parseInvoicePricing(f: Fields): InvoicePricing {
  return { currency: f.string('currency'), amount: f.int('amount'), exponent: f.int('exponent'), usdPerUnit: f.string('usdPerUnit'), rateSource: f.string('rateSource'), rateAt: f.date('rateAt') };
}
