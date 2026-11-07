import type { Fields } from './Fields.js';

/** The ready-made ranges of invoices.summary(): UTC days ending today; last_3_months is the last 92 days. */
export const SummaryPeriod = {
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  THIS_MONTH: 'this_month',
  LAST_MONTH: 'last_month',
  LAST_3_MONTHS: 'last_3_months',
} as const;

export type SummaryPeriodName = (typeof SummaryPeriod)[keyof typeof SummaryPeriod];

/** A ready-made period, or both days (YYYY-MM-DD, UTC, both included). One request covers at most 92 days. */
export type InvoiceSummaryInput = { readonly period: SummaryPeriodName } | { readonly createdFrom: string; readonly createdTo: string };

/** The received money on one network in one token. */
export interface NetworkTotal {
  readonly network: string;
  /** USDT or USDC. */
  readonly token: string;
  readonly payments: number;
  /** Millionths of a dollar, as a string: "251200000" is $251.20. */
  readonly receivedUsdMicros: string;
}

/** Totals of the store's invoices created in a range of UTC days. */
export interface InvoiceSummary {
  /** The first and last day counted, YYYY-MM-DD, also when a period was asked for. */
  readonly createdFrom: string;
  readonly createdTo: string;
  readonly invoiceCount: number;
  /** How many of them are in each status now, every status included (see InvoiceStatus). */
  readonly invoicesByStatus: Readonly<Record<string, number>>;
  /** Sum of their amounts in US cents, cancelled and expired invoices left out. */
  readonly invoicedUsdCents: number;
  /** The money that counts for them (confirmed and screened clear), in millionths of a dollar, as a string. */
  readonly receivedUsdMicros: string;
  readonly byNetwork: readonly NetworkTotal[];
}

export function parseInvoiceSummary(f: Fields): InvoiceSummary {
  const invoices = f.object('invoices');
  const byStatus = invoices.object('byStatus');
  return {
    createdFrom: f.string('createdFrom'),
    createdTo: f.string('createdTo'),
    invoiceCount: invoices.int('count'),
    invoicesByStatus: Object.fromEntries(Object.keys(byStatus.raw()).map((status) => [status, byStatus.int(status)])),
    invoicedUsdCents: f.int('invoicedUsdCents'),
    receivedUsdMicros: f.string('receivedUsdMicros'),
    byNetwork: f.objects('byNetwork', (n) => ({ network: n.string('network'), token: n.string('token'), payments: n.int('payments'), receivedUsdMicros: n.string('receivedUsdMicros') })),
  };
}
