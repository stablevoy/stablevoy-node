import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors/ApiError.js';
import { json } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

const STORE = '7c3360b5-e8cc-4775-8a13-7324d4f1296e';
const PRICING = { currency: 'EUR', amount: 4999, exponent: 2, usdPerUnit: '1.0992', rateSource: 'ecb', rateAt: '2026-11-19T15:00:00.000Z' };

describe('prices in other currencies', () => {
  it('creates an invoice priced in EUR and reads the price and the rate back', async () => {
    const created = { ...example('POST', '/v1/invoices', 201), amountUsdCents: 5495, pricing: PRICING };
    const { client, http } = testClient([json(201, created)]);
    const result = await client.invoices.create({ amount: 4999, currency: 'EUR', externalReference: 'order-1' });
    expect(JSON.parse(http.last().body ?? '')).toEqual({ amount: 4999, currency: 'EUR', externalReference: 'order-1' });
    expect(result.invoice.amountUsdCents).toBe(5495);
    expect(result.invoice.pricing).toEqual({ ...PRICING, rateAt: new Date(PRICING.rateAt) });
  });

  it('reads a USD invoice with pricing null, and an old webhook payload without the field', async () => {
    const usd = example('GET', '/v1/invoices/{invoiceId}', 200);
    const old: Record<string, unknown> = { ...usd };
    delete old['pricing'];
    const { client } = testClient([json(200, usd), json(200, old)]);
    expect((await client.invoices.get(STORE)).pricing).toBeNull();
    expect('pricing' in (await client.invoices.get(STORE))).toBe(false);
  });

  it.each([
    ['both forms', { amountUsdCents: 100, amount: 100, currency: 'EUR' }],
    ['amountUsdCents with a currency', { amountUsdCents: 100, currency: 'EUR' }],
    ['neither form', {}],
    ['amount without currency', { amount: 100 }],
    ['currency without amount', { currency: 'EUR' }],
    ['a fractional amount', { amount: 10.5, currency: 'EUR' }],
    ['a zero amount', { amount: 0, currency: 'EUR' }],
    ['a lowercase code', { amount: 100, currency: 'eur' }],
  ])('refuses %s before sending anything', async (_, input) => {
    const { client, http } = testClient([]);
    await expect(client.invoices.create(input)).rejects.toThrow(RangeError);
    expect(http.requests).toEqual([]);
  });

  it('lists the currencies, and those of a store with its own rates', async () => {
    const list = example('GET', '/v1/currencies', 200) as unknown as unknown[];
    const mine = example('GET', '/v1/stores/{storeId}/currencies', 200) as unknown as unknown[];
    const { client, http } = testClient([json(200, list), json(200, mine)]);
    const all = await client.currencies.list();
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/currencies');
    expect(all.length).toBe(list.length);
    expect(all.find((c) => c.code === 'EUR')).toMatchObject({ exponent: 2, market: { usable: true }, store: null, effective: { source: 'ecb' } });
    const own = await client.currencies.forStore(STORE);
    expect(http.last().url).toBe(`https://api.stablevoy.com/v1/stores/${STORE}/currencies`);
    expect(own.find((c) => c.code === 'EUR')).toMatchObject({ store: { divergesFromMarket: false }, effective: { source: 'merchant' } });
    expect(own.find((c) => c.code === 'EUR')?.store?.setAt).toBeInstanceOf(Date);
  });

  it('reads a currency that prices no invoice right now', async () => {
    const stale = { code: 'GBP', exponent: 2, market: { usdPerUnit: '1.3', source: 'ecb', rateAt: '2026-11-01T15:00:00.000Z', usable: false }, store: null, effective: null };
    const { client } = testClient([json(200, [stale])]);
    expect(await client.currencies.list()).toEqual([{ ...stale, market: { ...stale.market, rateAt: new Date(stale.market.rateAt) } }]);
  });

  it('refuses a store id that is not a UUID, and an answer that is not a list', async () => {
    const { client, http } = testClient([json(200, { not: 'a list' })]);
    await expect(client.currencies.forStore('../me')).rejects.toThrow(RangeError);
    expect(http.requests).toEqual([]);
    await expect(client.currencies.list()).rejects.toThrow('currencies is not a list');
  });

  it('names the new error codes', () => {
    expect(ApiError.EXCHANGE_RATE_UNAVAILABLE).toBe('exchange_rate_unavailable');
    expect(ApiError.CURRENCY_NOT_SUPPORTED).toBe('currency_not_supported');
  });
});
