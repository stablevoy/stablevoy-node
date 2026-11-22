import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import { CheckoutStep, CheckoutSurface } from '../src/model/CheckoutStep.js';
import { SummaryPeriod, type InvoiceSummaryInput } from '../src/model/InvoiceSummary.js';
import { json } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

const FUNNEL_PATH = '/v1/store/checkout-funnel';
const TRAIL_PATH = '/v1/invoices/{invoiceId}/checkout-trail';
const INVOICE = '7c3360b5-e8cc-4775-8a13-7324d4f1296e';

describe('payment page funnel', () => {
  it('asks for the key\'s store and reads every count', async () => {
    const funnel = example('GET', FUNNEL_PATH, 200);
    const { client, http } = testClient([json(200, funnel)]);
    const result = await client.stores.checkoutFunnel({ period: SummaryPeriod.LAST_30_DAYS });
    expect(http.last()).toMatchObject({ method: 'GET', url: 'https://api.stablevoy.com/v1/store/checkout-funnel?period=last_30_days' });
    expect(result).toEqual(funnel);
    expect(result.steps[CheckoutStep.OPENED]).toBe((funnel['steps'] as Record<string, number>)['opened']);
    expect(result.openedOn[CheckoutSurface.WIDGET]).toBe((funnel['openedOn'] as Record<string, number>)['widget']);
  });

  it('asks for own days', async () => {
    const { client, http } = testClient([json(200, example('GET', FUNNEL_PATH, 200))]);
    await client.stores.checkoutFunnel({ createdFrom: '2026-11-01', createdTo: '2026-11-30' });
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/store/checkout-funnel?createdFrom=2026-11-01&createdTo=2026-11-30');
  });

  it.each([[{}], [{ period: 'last_year' }], [{ createdFrom: '2026-11-01' }], [{ period: 'last_7_days', createdTo: '2026-11-30' }]])('refuses %j before sending anything', async (input) => {
    const { client, http } = testClient([]);
    await expect(client.stores.checkoutFunnel(input as unknown as InvoiceSummaryInput)).rejects.toThrow(RangeError);
    expect(http.requests).toEqual([]);
  });

  it.each(['steps', 'paid'])('refuses an answer without %s', async (field) => {
    const answer = Object.fromEntries(Object.entries(example('GET', FUNNEL_PATH, 200)).filter(([key]) => key !== field));
    await expect(testClient([json(200, answer)]).client.stores.checkoutFunnel({ period: SummaryPeriod.THIS_MONTH })).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('refuses a count that is not a whole number', async () => {
    const answer = example('GET', FUNNEL_PATH, 200);
    (answer['steps'] as Record<string, unknown>)['opened'] = '31';
    await expect(testClient([json(200, answer)]).client.stores.checkoutFunnel({ period: SummaryPeriod.THIS_MONTH })).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});

describe('payment page trail', () => {
  it('reads the steps of one invoice with their times', async () => {
    const trail = example('GET', TRAIL_PATH, 200);
    const { client, http } = testClient([json(200, trail)]);
    const result = await client.invoices.checkoutTrail(INVOICE);
    expect(http.last()).toMatchObject({ method: 'GET', url: `https://api.stablevoy.com/v1/invoices/${INVOICE}/checkout-trail` });
    const steps = trail['steps'] as { step: string; at: string; surface: string | null }[];
    expect(result).toEqual({ invoiceId: trail['invoiceId'], steps: steps.map((s) => ({ step: s.step, at: new Date(s.at), surface: s.surface })) });
  });

  it('keeps a step this library does not know yet', async () => {
    const trail = { invoiceId: INVOICE, steps: [{ step: 'refunded', at: '2026-11-20T14:01:12.000Z', surface: null }] };
    const result = await testClient([json(200, trail)]).client.invoices.checkoutTrail(INVOICE);
    expect(result.steps[0]?.step).toBe('refunded');
  });

  it.each(['../store', 'not-a-uuid', ''])('refuses the id %j before sending anything', async (id) => {
    const { client, http } = testClient([]);
    await expect(client.invoices.checkoutTrail(id)).rejects.toThrow(RangeError);
    expect(http.requests).toEqual([]);
  });

  it('refuses a step without a valid time', async () => {
    const trail = { invoiceId: INVOICE, steps: [{ step: 'created', at: 'yesterday', surface: null }] };
    await expect(testClient([json(200, trail)]).client.invoices.checkoutTrail(INVOICE)).rejects.toBeInstanceOf(UnexpectedResponseError);
  });
});
