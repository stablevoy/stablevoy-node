import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import type { Transport } from '../http/Transport.js';
import { Fields } from '../model/Fields.js';
import { parseCurrency, type Currency } from '../model/Currency.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Currencies an invoice can be priced in, and their exchange rates. Read only: a store's own rate is set in the dashboard. */
export class Currencies {
  constructor(private readonly transport: Transport) {}

  /** Every supported currency with the market rate in use (ECB reference rates, checked against Coinbase). */
  async list(): Promise<Currency[]> {
    return Currencies.parse(await this.transport.get('/v1/currencies'));
  }

  /**
   * The same list for one store (the key's own store), with its own fixed rates and the rate an invoice of the store would
   * use now. effective null: an invoice in that currency is refused right now. store.divergesFromMarket: the own rate is more
   * than 10% away from the market rate.
   */
  async forStore(storeId: string): Promise<Currency[]> {
    // Ids are UUIDs; anything else (such as "..") could make the request reach another path with your key.
    if (!UUID.test(storeId)) throw new RangeError('A store id is a UUID, like 7c3360b5-e8cc-4775-8a13-7324d4f1296e');
    return Currencies.parse(await this.transport.get(`/v1/stores/${storeId}/currencies`));
  }

  private static parse(data: unknown): Currency[] {
    if (!Array.isArray(data)) throw new UnexpectedResponseError('currencies is not a list');
    return data.map((item, i) => parseCurrency(Fields.of(item, `currencies[${i}]`)));
  }
}
