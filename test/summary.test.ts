import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors/ApiError.js';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import { SummaryPeriod, type InvoiceSummaryInput } from '../src/model/InvoiceSummary.js';
import { json, problem } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

describe('invoice summary', () => {
  it('asks for a period and reads the totals', async () => {
    const summary = example('GET', '/v1/invoices/summary', 200);
    const { client, http } = testClient([json(200, summary)]);
    const result = await client.invoices.summary({ period: SummaryPeriod.LAST_7_DAYS });
    expect(http.last()).toMatchObject({ method: 'GET', url: 'https://api.stablevoy.com/v1/invoices/summary?period=last_7_days' });
    const invoices = summary['invoices'] as { count: number; byStatus: Record<string, number> };
    expect(result).toEqual({
      createdFrom: summary['createdFrom'],
      createdTo: summary['createdTo'],
      invoiceCount: invoices.count,
      invoicesByStatus: invoices.byStatus,
      invoicedUsdCents: summary['invoicedUsdCents'],
      receivedUsdMicros: summary['receivedUsdMicros'],
      byNetwork: summary['byNetwork'],
    });
  });

  it('asks for own days', async () => {
    const { client, http } = testClient([json(200, example('GET', '/v1/invoices/summary', 200))]);
    await client.invoices.summary({ createdFrom: '2026-10-01', createdTo: '2026-10-31' });
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/invoices/summary?createdFrom=2026-10-01&createdTo=2026-10-31');
  });

  it.each([
    [{}],
    [{ period: 'last_7_days', createdFrom: '2026-10-01', createdTo: '2026-10-31' }],
    [{ period: 'last_year' }],
    [{ createdFrom: '2026-10-01' }],
    [{ createdTo: '2026-10-31' }],
    [{ createdFrom: '1.10.2026', createdTo: '2026-10-31' }],
  ])('refuses %j before sending anything', async (input) => {
    const { client, http } = testClient([]);
    await expect(client.invoices.summary(input as unknown as InvoiceSummaryInput)).rejects.toThrow(RangeError);
    expect(http.requests).toEqual([]);
  });

  it('passes on the API refusal of a range over 92 days', async () => {
    const { client } = testClient([json(400, problem(400, 'invalid_invoice_filter', 'createdFrom and createdTo are at most 92 days apart'))]);
    await expect(client.invoices.summary({ createdFrom: '2026-01-01', createdTo: '2026-12-31' })).rejects.toMatchObject({ status: 400, code: ApiError.INVALID_INVOICE_FILTER });
  });

  it('refuses an answer without the counts', async () => {
    const old = example('GET', '/v1/invoices/summary', 200);
    delete old['invoices'];
    await expect(testClient([json(200, old)]).client.invoices.summary({ period: SummaryPeriod.THIS_MONTH })).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('unmatched transfers', () => {
  it('lists the transfers of the store with sharedWithStores', async () => {
    const list = example('GET', '/v1/unmatched-transfers', 200) as unknown as Record<string, unknown>[];
    const { client, http } = testClient([json(200, list)]);
    const result = await client.unmatchedTransfers.list();
    expect(http.last()).toMatchObject({ method: 'GET', url: 'https://api.stablevoy.com/v1/unmatched-transfers' });
    expect(result).toHaveLength(list.length);
    expect(result[0]).toEqual({ ...list[0], detectedAt: new Date(String(list[0]?.['detectedAt'])) });
  });

  it('refuses an answer that is not a list, or a transfer without sharedWithStores', async () => {
    await expect(testClient([json(200, {})]).client.unmatchedTransfers.list()).rejects.toBeInstanceOf(UnexpectedResponseError);
    const [first] = example('GET', '/v1/unmatched-transfers', 200) as unknown as Record<string, unknown>[];
    delete first?.['sharedWithStores'];
    await expect(testClient([json(200, [first])]).client.unmatchedTransfers.list()).rejects.toThrow('unmatchedTransfers[0].sharedWithStores is missing');
  });
});
