import { describe, expect, it } from 'vitest';
import { InvoiceStatus, isPaidStatus } from '../src/model/InvoiceStatus.js';
import { InvoiceSourceFilter } from '../src/model/InvoiceSource.js';
import { json } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

const ID = '7c3360b5-e8cc-4775-8a13-7324d4f1296e';

describe('invoices', () => {
  it('creates an invoice with the key, the idempotency key and JSON', async () => {
    const created = example('POST', '/v1/invoices', 201);
    const { client, http } = testClient([json(201, created)]);
    const result = await client.invoices.create({ amountUsdCents: 1999, externalReference: 'order-1042', returnUrl: 'https://shop.example/thanks' }, { idempotencyKey: 'order-1042' });
    const sent = http.last();
    expect(sent).toMatchObject({ method: 'POST', url: 'https://api.stablevoy.com/v1/invoices' });
    expect(sent.headers).toMatchObject({ Authorization: 'Bearer sk_test_key', 'Idempotency-Key': 'order-1042', 'Content-Type': 'application/json', Accept: 'application/json' });
    expect(sent.headers['User-Agent']).toMatch(/^stablevoy-node\/1\.1\.0 /);
    expect(JSON.parse(sent.body ?? '')).toEqual({ amountUsdCents: 1999, externalReference: 'order-1042', returnUrl: 'https://shop.example/thanks' });
    expect(result).toMatchObject({ checkoutUrl: created['checkoutUrl'], replayed: created['replayed'] });
    expect(result.invoice.id).toBe(created['id']);
    expect(result.invoice.expiresAt).toBeInstanceOf(Date);
  });

  it('sends only the fields that are set, and no idempotency key unless given', async () => {
    const { client, http } = testClient([json(201, example('POST', '/v1/invoices', 201))]);
    await client.invoices.create({ amountUsdCents: 500 });
    expect(JSON.parse(http.last().body ?? '')).toEqual({ amountUsdCents: 500 });
    expect(http.last().headers).not.toHaveProperty('Idempotency-Key');
  });

  it.each([0, -1, 19.99, Number.NaN])('refuses the amount %s before sending anything', async (amount) => {
    const { client, http } = testClient([]);
    await expect(client.invoices.create({ amountUsdCents: amount })).rejects.toThrow(RangeError);
    expect(http.requests).toEqual([]);
  });

  it('reads an invoice by its id', async () => {
    const invoice = example('GET', '/v1/invoices/{invoiceId}', 200);
    const { client, http } = testClient([json(200, invoice)]);
    const result = await client.invoices.get(ID);
    expect(http.last().url).toBe(`https://api.stablevoy.com/v1/invoices/${ID}`);
    expect(result).toMatchObject({ id: invoice['id'], amountUsdCents: invoice['amountUsdCents'], status: invoice['status'] });
    expect(result.depositAddresses).toHaveLength((invoice['depositAddresses'] as unknown[]).length);
    expect(isPaidStatus(result.status)).toBe([InvoiceStatus.PAID, InvoiceStatus.OVERPAID, InvoiceStatus.PAID_LATE].includes(result.status as 'paid'));
  });

  it.each(['..', '../stores', 'x?status=paid', '', '7c3360b5-e8cc-4775-8a13-7324d4f1296'])('refuses the invoice id %j before sending anything', async (id) => {
    const { client, http } = testClient([]);
    await expect(client.invoices.get(id)).rejects.toThrow(RangeError);
    expect(http.requests).toEqual([]);
  });

  it('reads the payments of an invoice', async () => {
    const invoice = example('GET', '/v1/invoices/{invoiceId}', 200);
    const payment = { id: ID, network: 'tron', amountDueUsdCents: 1500, token: 'USDT', amount: '15000042', txHash: 'ab'.repeat(32), status: 'confirmed', screeningStatus: 'clear', detectedAt: '2026-10-25T10:00:00.000Z' };
    const { client } = testClient([json(200, { ...invoice, payments: [payment] })]);
    const result = await client.invoices.get(ID);
    expect(result.payments).toEqual([{ ...payment, detectedAt: new Date('2026-10-25T10:00:00.000Z') }]);
  });

  it('sends the order id alone when no return URL is given', async () => {
    const { client, http } = testClient([json(201, example('POST', '/v1/invoices', 201))]);
    await client.invoices.create({ amountUsdCents: 700, externalReference: 'order-7' });
    expect(JSON.parse(http.last().body ?? '')).toEqual({ amountUsdCents: 700, externalReference: 'order-7' });
  });

  it('lists a page with its filters', async () => {
    const { client, http } = testClient([json(200, example('GET', '/v1/invoices', 200))]);
    const page = await client.invoices.list({ limit: 20, cursor: 'cursor-1', status: InvoiceStatus.PAID });
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/invoices?limit=20&cursor=cursor-1&status=paid');
    expect(page.items.length).toBeGreaterThan(0);
  });

  it('asks for 50 invoices by default', async () => {
    const { client, http } = testClient([json(200, { items: [], nextCursor: null })]);
    await client.invoices.list();
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/invoices?limit=50');
  });

  it.each([0, 101, 2.5])('refuses the page size %s', async (limit) => {
    await expect(testClient([]).client.invoices.list({ limit })).rejects.toThrow(RangeError);
  });

  it('walks every page', async () => {
    const invoice = example('GET', '/v1/invoices/{invoiceId}', 200);
    const { client, http } = testClient([json(200, { items: [invoice, invoice], nextCursor: 'next' }), json(200, { items: [invoice], nextCursor: null })]);
    const all = [];
    for await (const item of client.invoices.all({ status: InvoiceStatus.EXPIRED, pageSize: 2 })) all.push(item);
    expect(all).toHaveLength(3);
    expect(http.requests.map((r) => r.url)).toEqual([
      'https://api.stablevoy.com/v1/invoices?limit=2&status=expired',
      'https://api.stablevoy.com/v1/invoices?limit=2&cursor=next&status=expired',
    ]);
  });

  it('walks with the default page size and no filter', async () => {
    const { client, http } = testClient([json(200, { items: [], nextCursor: null })]);
    for await (const item of client.invoices.all()) expect(item).toBeUndefined();
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/invoices?limit=100');
  });

  it('sends the filters and reads the source of each listed invoice', async () => {
    const invoice = example('GET', '/v1/invoices/{invoiceId}', 200) ;
    const items = [
      { ...invoice, source: { kind: 'plugin', platform: 'woocommerce', apiKeyId: 'k1' } },
      { ...invoice, source: { kind: 'api_key', apiKeyId: 'k2', apiKeyName: 'own code' } },
      { ...invoice, source: { kind: 'payment_link' } },
      { ...invoice, source: null },
    ];
    const { client, http } = testClient([json(200, { items, nextCursor: null })]);
    const page = await client.invoices.list({ limit: 10, status: InvoiceStatus.PAID, source: InvoiceSourceFilter.WooCommerce, createdFrom: '2026-10-01', createdTo: '2026-10-31', search: 'order 1/2' });
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/invoices?limit=10&status=paid&source=woocommerce&createdFrom=2026-10-01&createdTo=2026-10-31&q=order+1%2F2');
    expect(page.items.map((i) => i.source)).toEqual([
      { kind: 'plugin', platform: 'woocommerce', apiKeyId: 'k1', apiKeyName: null },
      { kind: 'api_key', platform: null, apiKeyId: 'k2', apiKeyName: 'own code' },
      { kind: 'payment_link', platform: null, apiKeyId: null, apiKeyName: null },
      { kind: 'not_recorded', platform: null, apiKeyId: null, apiKeyName: null },
    ]);
  });

  it('reads the source of a single invoice, and none from an older API', async () => {
    const older = Object.fromEntries(Object.entries(example('GET', '/v1/invoices/{invoiceId}', 200)).filter(([key]) => key !== 'source'));
    const { client } = testClient([json(200, example('GET', '/v1/invoices/{invoiceId}', 200)), json(200, older)]);
    expect((await client.invoices.get(ID)).source?.kind).toBe('plugin');
    expect(await client.invoices.get(ID)).not.toHaveProperty('source');
  });

  it.each([{ createdFrom: '1.10.2026' }, { createdTo: '2026-10-1' }, { search: '' }, { search: 'x'.repeat(201) }])('refuses the filter %o before sending anything', async (filter) => {
    const { client, http } = testClient([]);
    await expect(client.invoices.list(filter)).rejects.toThrow(RangeError);
    expect(http.requests).toEqual([]);
  });

  it('walks every page of a filter', async () => {
    const { client, http } = testClient([json(200, { items: [], nextCursor: null })]);
    for await (const item of client.invoices.all({ source: InvoiceSourceFilter.PaymentLink, pageSize: 50 })) expect(item).toBeUndefined();
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/invoices?limit=50&source=payment_link');
  });
});
