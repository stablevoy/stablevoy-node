import type { Transport } from '../http/Transport.js';
import { Fields } from '../model/Fields.js';
import { parseStore, type Store } from '../model/Platform.js';
import { parseCheckoutFunnel, type CheckoutFunnel } from '../model/CheckoutFunnel.js';
import type { InvoiceSummaryInput } from '../model/InvoiceSummary.js';
import { summaryRangeQuery } from './SummaryRange.js';

export class Stores {
  constructor(private readonly transport: Transport) {}

  /** The store the API key belongs to: a cheap way to check that the key works. */
  async current(): Promise<Store> {
    return parseStore(Fields.of(await this.transport.get('/v1/store'), 'store'));
  }

  /**
   * Where buyers stop on the payment page, for the store's invoices created in a range of UTC days: how many opened the page,
   * changed the network or token, copied the payment details, started a wallet, had it refused or failed, sent the
   * transaction, saw a payment and were paid. The same range as invoices.summary(): a period (SummaryPeriod) or both days,
   * at most 92 days. Counts of invoices, not of visits. The API allows 30 calls a minute per store.
   */
  async checkoutFunnel(input: InvoiceSummaryInput): Promise<CheckoutFunnel> {
    return parseCheckoutFunnel(Fields.of(await this.transport.get('/v1/store/checkout-funnel', summaryRangeQuery(input)), 'checkoutFunnel'));
  }

  /**
   * Revokes the API key of this client; it stops working at once (use it when the shop disconnects). A key that is already
   * revoked answers with AuthenticationError, which for a disconnect means the same.
   */
  async revokeCurrentKey(): Promise<void> {
    await this.transport.delete('/v1/store/api-keys/current');
  }
}
