import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errors/ApiError.js';
import { AuthenticationError } from '../src/errors/AuthenticationError.js';
import { MaintenanceError } from '../src/errors/MaintenanceError.js';
import { NotFoundError } from '../src/errors/NotFoundError.js';
import { RateLimitedError } from '../src/errors/RateLimitedError.js';
import { StablevoyError } from '../src/errors/StablevoyError.js';
import { TransportError } from '../src/errors/TransportError.js';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import { ValidationError } from '../src/errors/ValidationError.js';
import { RetryPolicy } from '../src/http/RetryPolicy.js';
import { json, problem } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

const ID = '7c3360b5-e8cc-4775-8a13-7324d4f1296e';

describe('errors', () => {
  it.each([
    [401, 'authentication_failed', AuthenticationError],
    [404, 'not_found', NotFoundError],
    [400, 'validation_failed', ValidationError],
    [422, 'amount_below_minimum', ValidationError],
    [409, 'conflict', ApiError],
    [503, 'networks_unavailable', ApiError],
  ] as const)('maps HTTP %i %s to its error', async (status, code, type) => {
    const { client } = testClient([json(status, problem(status, code, 'Something went wrong'))], RetryPolicy.none);
    const error: unknown = await client.invoices.get(ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StablevoyError);
    expect((error as ApiError).constructor).toBe(type);
    expect(error).toMatchObject({ status, code, detail: 'Something went wrong', type: `https://stablevoy.com/docs/api/errors/#error-${code}`, name: type.name });
    expect((error as Error).message).toContain(`HTTP ${status}`);
  });

  it('keeps the issues of a validation error and drops malformed ones', async () => {
    const body = { ...problem(400, 'validation_failed', 'Invalid body'), issues: [{ path: 'amountUsdCents', message: 'Expected integer' }, 'junk', null, { path: 1 }] };
    const error = await testClient([json(400, body)]).client.invoices.create({ amountUsdCents: 1 }).catch((e: unknown) => e);
    expect((error as ValidationError).issues).toEqual([{ path: 'amountUsdCents', message: 'Expected integer' }]);
  });

  it.each(['Bad Gateway', '[1]', '{"issues":"none"}'])('names an error without a usable problem body %j by its status', async (body) => {
    const error = await testClient([json(502, body)], RetryPolicy.none).client.stores.current().catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'http_502', detail: 'The API answered HTTP 502', type: null, issues: [] });
  });
});

describe('retries', () => {
  it('retries a read on rate limit as long as Retry-After says', async () => {
    const { client, http, slept } = testClient([json(429, problem(429, 'rate_limited', 'Slow down'), { 'Retry-After': '3' }), json(200, example('GET', '/v1/limits', 200))]);
    await client.platform.limits();
    expect(slept).toEqual([3]);
    expect(http.requests).toHaveLength(2);
  });

  it('backs off without Retry-After and gives up after the last retry', async () => {
    const limited = () => json(429, problem(429, 'rate_limited', 'Slow down'), { 'Retry-After': 'soon' });
    const { client, slept } = testClient([limited(), limited(), limited()]);
    const error = await client.platform.limits().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterSeconds).toBeNull();
    expect(slept).toEqual([1, 2]);
  });

  it('does not sleep through maintenance but reports when to come back', async () => {
    const { client, slept } = testClient([json(503, problem(503, 'maintenance', 'Stablevoy is under maintenance.'), { 'Retry-After': '300' })]);
    const error = await client.invoices.get(ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MaintenanceError);
    expect((error as MaintenanceError).retryAfterSeconds).toBe(300);
    expect(slept).toEqual([]);
  });

  it('retries a create only with an idempotency key', async () => {
    const busy = () => json(503, problem(503, 'maintenance', 'Back soon'), { 'Retry-After': '2' });
    const withKey = testClient([busy(), json(201, example('POST', '/v1/invoices', 201))]);
    await withKey.client.invoices.create({ amountUsdCents: 1999 }, { idempotencyKey: 'order-1' });
    expect(withKey.slept).toEqual([2]);

    const withoutKey = testClient([busy()]);
    await expect(withoutKey.client.invoices.create({ amountUsdCents: 1999 })).rejects.toThrow(MaintenanceError);
    expect(withoutKey.slept).toEqual([]);
    expect(withoutKey.http.requests).toHaveLength(1);
  });

  it('does not retry an error that a repeat cannot fix', async () => {
    const { client, slept } = testClient([json(404, problem(404, 'not_found', 'Invoice not found'))]);
    await expect(client.invoices.get(ID)).rejects.toThrow(NotFoundError);
    expect(slept).toEqual([]);
  });

  it('retries a failed connection, then reports it with the cause', async () => {
    const retried = testClient([new TypeError('fetch failed'), json(200, example('GET', '/v1/limits', 200))]);
    await retried.client.platform.limits();
    expect(retried.slept).toEqual([1]);

    const failed = testClient(['ECONNRESET' as unknown as Error], RetryPolicy.none);
    const error = await failed.client.platform.limits().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TransportError);
    expect((error as Error).message).toBe('Cannot reach the Stablevoy API: ECONNRESET');
    expect((error as Error).cause).toBe('ECONNRESET');
  });

  it('never retries a create without a key after a failed connection', async () => {
    const { client, slept } = testClient([new TypeError('fetch failed')]);
    await expect(client.invoices.create({ amountUsdCents: 1 })).rejects.toThrow(TransportError);
    expect(slept).toEqual([]);
  });

  it.each([
    ['not JSON', '<html>'],
    ['JSON that is no object', '"text"'],
  ])('refuses an answer that is %s', async (_what, body) => {
    await expect(testClient([json(200, body)]).client.platform.limits()).rejects.toThrow(UnexpectedResponseError);
  });

  it('names the field of an answer it cannot read', async () => {
    await expect(testClient([json(200, { minInvoiceUsdCents: 500, maxInvoiceUsdCents: '1000' })]).client.platform.limits()).rejects.toThrow('limits.maxInvoiceUsdCents is not an integer');
  });

  it('refuses retry settings that make no sense', () => {
    expect(() => new RetryPolicy(-1)).toThrow(RangeError);
    expect(() => new RetryPolicy(1, 1.5)).toThrow(RangeError);
  });
});
