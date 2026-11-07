import type { Query, Transport } from '../http/Transport.js';
import { Fields } from '../model/Fields.js';
import { parseCreatedInvoice, parseInvoice, parseInvoicePage, type CreatedInvoice, type CreateInvoiceInput, type Invoice, type InvoicePage } from '../model/Invoice.js';
import { parseInvoiceSummary, SummaryPeriod, type InvoiceSummary, type InvoiceSummaryInput } from '../model/InvoiceSummary.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,255}$/;

/** Which invoices to list. Every filter is optional and they combine. Days are whole UTC days, both ends included. */
export interface InvoiceListFilter {
  /** Only invoices in this status (see InvoiceStatus). */
  readonly status?: string;
  /** See InvoiceSourceFilter: payment_link, woocommerce, edd, whmcs, api_key or not_recorded. */
  readonly source?: string;
  /** YYYY-MM-DD. */
  readonly createdFrom?: string;
  /** YYYY-MM-DD. */
  readonly createdTo?: string;
  /** An exact invoice id, or the start of the external reference. */
  readonly search?: string;
}

export interface ListInvoicesOptions extends InvoiceListFilter {
  /** 1 to 100, 50 by default. */
  readonly limit?: number;
  readonly cursor?: string;
}

/** Invoices of the store the API key belongs to. */
export class Invoices {
  constructor(private readonly transport: Transport) {}

  /**
   * Creates an invoice. Pass your order id as the idempotency key: a retry with the same key and request returns the
   * first invoice (replayed: true) instead of a second one, and only then does this library retry on its own.
   */
  async create(input: CreateInvoiceInput, options: { readonly idempotencyKey?: string } = {}): Promise<CreatedInvoice> {
    if (!Number.isSafeInteger(input.amountUsdCents) || input.amountUsdCents < 1) {
      throw new RangeError('amountUsdCents must be a positive whole number of US cents, for example 1999 for $19.99');
    }
    // What the API accepts; anything else would be refused there, or make fetch throw on the header.
    if (options.idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(options.idempotencyKey)) {
      throw new RangeError('The idempotency key must be 1 to 255 printable ASCII characters without spaces, such as your order id');
    }
    // The bounds (platform.limits()) are checked by the API, which answers invalid_invoice_lifetime.
    if (input.expiresInMinutes !== undefined && !Number.isSafeInteger(input.expiresInMinutes)) {
      throw new RangeError('expiresInMinutes must be a whole number of minutes, for example 60 or 1440');
    }
    const body: Record<string, string | number> = { amountUsdCents: input.amountUsdCents };
    if (input.externalReference !== undefined) body['externalReference'] = input.externalReference;
    if (input.returnUrl !== undefined) body['returnUrl'] = input.returnUrl;
    if (input.expiresInMinutes !== undefined) body['expiresInMinutes'] = input.expiresInMinutes;
    return parseCreatedInvoice(Fields.of(await this.transport.post('/v1/invoices', body, options.idempotencyKey), 'invoice'));
  }

  async get(invoiceId: string): Promise<Invoice> {
    Invoices.checkId(invoiceId);
    return parseInvoice(Fields.of(await this.transport.get(`/v1/invoices/${invoiceId}`), 'invoice'));
  }

  /**
   * Cancels an invoice that is still waiting for its first payment, for example when the order was cancelled: the payment
   * page tells the buyer not to pay and the webhook invoice.cancelled is sent. Cancelling it again returns it unchanged.
   * Once a payment has been seen the API refuses with ApiError.INVOICE_NOT_CANCELLABLE; money that still arrives after a
   * cancel makes the invoice paid_late. Not retried on its own; calling it again is safe.
   */
  async cancel(invoiceId: string): Promise<Invoice> {
    Invoices.checkId(invoiceId);
    return parseInvoice(Fields.of(await this.transport.post(`/v1/invoices/${invoiceId}/cancel`, {}), 'invoice'));
  }

  // Ids are UUIDs; anything else (such as "..") could make the request reach another path with your key.
  private static checkId(invoiceId: string): void {
    if (!UUID.test(invoiceId)) throw new RangeError('An invoice id is a UUID, like 7c3360b5-e8cc-4775-8a13-7324d4f1296e');
  }

  /** One page of invoices, newest first. */
  async list(options: ListInvoicesOptions = {}): Promise<InvoicePage> {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('limit must be a whole number from 1 to 100');
    for (const name of ['createdFrom', 'createdTo'] as const) {
      const day = options[name];
      if (day !== undefined && !DAY.test(day)) throw new RangeError(`${name} must be a date as YYYY-MM-DD`);
    }
    if (options.search !== undefined && (options.search === '' || options.search.length > 200)) throw new RangeError('search must be 1 to 200 characters');
    const query: Record<string, string | number> = { limit };
    if (options.cursor !== undefined) query['cursor'] = options.cursor;
    if (options.status !== undefined) query['status'] = options.status;
    if (options.source !== undefined) query['source'] = options.source;
    if (options.createdFrom !== undefined) query['createdFrom'] = options.createdFrom;
    if (options.createdTo !== undefined) query['createdTo'] = options.createdTo;
    if (options.search !== undefined) query['q'] = options.search;
    return parseInvoicePage(Fields.of(await this.transport.get('/v1/invoices', query satisfies Query), 'invoices'));
  }

  /**
   * Totals of the invoices created in a range of UTC days: counts per status, the invoiced amount and the money received,
   * also per network and token. Pass a period (SummaryPeriod) or both days. One request covers at most 92 days, so ask for
   * a year in four parts; a longer range is refused with ApiError.INVALID_INVOICE_FILTER. The API allows 30 calls a minute per store.
   */
  async summary(input: InvoiceSummaryInput): Promise<InvoiceSummary> {
    // Read loosely: a JavaScript caller can pass any mix, and it is refused here rather than by the API.
    const given = input as { readonly period?: unknown; readonly createdFrom?: unknown; readonly createdTo?: unknown };
    const query: Record<string, string> = {};
    const hasDays = given.createdFrom !== undefined || given.createdTo !== undefined;
    if ((given.period !== undefined) === hasDays) throw new RangeError('Pass either period or both createdFrom and createdTo');
    if (hasDays) {
      for (const name of ['createdFrom', 'createdTo'] as const) {
        const day = given[name];
        if (typeof day !== 'string' || !DAY.test(day)) throw new RangeError(`${name} must be a date as YYYY-MM-DD`);
        query[name] = day;
      }
    } else {
      const period = given.period;
      if (typeof period !== 'string' || !(Object.values(SummaryPeriod) as string[]).includes(period)) throw new RangeError(`period must be one of ${Object.values(SummaryPeriod).join(', ')}`);
      query['period'] = period;
    }
    return parseInvoiceSummary(Fields.of(await this.transport.get('/v1/invoices/summary', query satisfies Query), 'summary'));
  }

  /** Every invoice, newest first, fetching the pages as you iterate: `for await (const invoice of invoices.all())`. */
  async *all(options: InvoiceListFilter & { readonly pageSize?: number } = {}): AsyncGenerator<Invoice> {
    const { pageSize, ...filter } = options;
    let cursor: string | null = null;
    do {
      const page: InvoicePage = await this.list({ ...filter, limit: pageSize ?? 100, ...(cursor === null ? {} : { cursor }) });
      yield* page.items;
      cursor = page.nextCursor;
    } while (cursor !== null);
  }
}
