import type { Query, Transport } from '../http/Transport.js';
import { Fields } from '../model/Fields.js';
import { parseCreatedInvoice, parseInvoice, parseInvoicePage, type CreatedInvoice, type CreateInvoiceInput, type Invoice, type InvoicePage } from '../model/Invoice.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ListInvoicesOptions {
  /** 1 to 100, 50 by default. */
  readonly limit?: number;
  readonly cursor?: string;
  /** Only invoices in this status (see InvoiceStatus). */
  readonly status?: string;
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
    const body: Record<string, string | number> = { amountUsdCents: input.amountUsdCents };
    if (input.externalReference !== undefined) body['externalReference'] = input.externalReference;
    if (input.returnUrl !== undefined) body['returnUrl'] = input.returnUrl;
    return parseCreatedInvoice(Fields.of(await this.transport.post('/v1/invoices', body, options.idempotencyKey), 'invoice'));
  }

  async get(invoiceId: string): Promise<Invoice> {
    // Ids are UUIDs; anything else (such as "..") could make the request reach another path with your key.
    if (!UUID.test(invoiceId)) throw new RangeError('An invoice id is a UUID, like 7c3360b5-e8cc-4775-8a13-7324d4f1296e');
    return parseInvoice(Fields.of(await this.transport.get(`/v1/invoices/${invoiceId}`), 'invoice'));
  }

  /** One page of invoices, newest first. */
  async list(options: ListInvoicesOptions = {}): Promise<InvoicePage> {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('limit must be a whole number from 1 to 100');
    const query: Record<string, string | number> = { limit };
    if (options.cursor !== undefined) query['cursor'] = options.cursor;
    if (options.status !== undefined) query['status'] = options.status;
    return parseInvoicePage(Fields.of(await this.transport.get('/v1/invoices', query satisfies Query), 'invoices'));
  }

  /** Every invoice, newest first, fetching the pages as you iterate: `for await (const invoice of invoices.all())`. */
  async *all(options: { readonly status?: string; readonly pageSize?: number } = {}): AsyncGenerator<Invoice> {
    let cursor: string | null = null;
    do {
      const page: InvoicePage = await this.list({
        limit: options.pageSize ?? 100,
        ...(cursor === null ? {} : { cursor }),
        ...(options.status === undefined ? {} : { status: options.status }),
      });
      yield* page.items;
      cursor = page.nextCursor;
    } while (cursor !== null);
  }
}
