import { describe, expect, it } from 'vitest';
import { AuthenticationError } from '../src/errors/AuthenticationError.js';
import { ConfigurationError } from '../src/errors/ConfigurationError.js';
import { MaintenanceError } from '../src/errors/MaintenanceError.js';
import { TransportError } from '../src/errors/TransportError.js';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import { ValidationError } from '../src/errors/ValidationError.js';
import { StablevoyConnect } from '../src/StablevoyConnect.js';
import { FakeFetch, json, problem } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

const SITE = 'https://shop.example.com';

/**
 * The exchange example of the API document with whole secrets: the document shows shortened ones (svk_live_4f9a...e0f9), which
 * the SDK rightly refuses, so a real-looking answer uses the older formats the SDK still accepts.
 */
const exchangeAnswer = (): Record<string, unknown> => ({ ...example('POST', '/v1/connect/exchange', 200), apiKey: 'sk_live_example', webhookSecret: 'whsec_example' });

function connect(...answers: (Response | Error)[]): { connect: StablevoyConnect; http: FakeFetch; slept: number[] } {
  const http = new FakeFetch(...answers);
  const slept: number[] = [];
  const client = StablevoyConnect.create({
    fetch: http.fetch,
    sleep: (seconds) => {
      slept.push(seconds);
      return Promise.resolve();
    },
  });
  return { connect: client, http, slept };
}

describe('one-click connect', () => {
  it('redeems a connect code without an API key', async () => {
    const answer = exchangeAnswer();
    const { connect: client, http } = connect(json(200, answer));
    const store = await client.exchange({ code: 'code-1', codeVerifier: 'verifier-1', site: SITE });
    const sent = http.last();
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe('https://api.stablevoy.com/v1/connect/exchange');
    expect(sent.headers['Authorization']).toBeUndefined();
    expect(sent.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(sent.body ?? '')).toEqual({ code: 'code-1', codeVerifier: 'verifier-1', site: SITE });
    const expected = answer['store'] as Record<string, unknown>;
    expect(store).toEqual({ apiKey: answer['apiKey'], webhookSecret: answer['webhookSecret'], storeId: expected['id'], storeName: expected['name'] });
  });

  it.each([
    ['not a store key', { apiKey: 'pk_live_1' }, 'connected.apiKey is not an API key (svk_live_, svk_test_, or the older sk_live_, sk_test_)'],
    ['not a webhook secret', { webhookSecret: 'secret' }, 'connected.webhookSecret is not a webhook secret (svwhsec_, or the older whsec_)'],
    ['no store', { store: undefined }, 'connected.store is missing'],
    ['no store name', { store: { id: 'x' } }, 'connected.store.name is missing'],
  ])('refuses an answer with %s', async (_name, change, message) => {
    const answer: Record<string, unknown> = { ...exchangeAnswer(), ...change };
    if (answer['store'] === undefined) delete answer['store'];
    const { connect: client } = connect(json(200, answer));
    const error = await client.exchange({ code: 'c', codeVerifier: 'v', site: SITE }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect((error as Error).message).toBe(message);
  });

  it('raises the refusal of the API', async () => {
    const { connect: client } = connect(json(400, problem(400, 'invalid_connect_code', 'This connection code cannot be used.')));
    await expect(client.exchange({ code: 'c', codeVerifier: 'v', site: SITE })).rejects.toMatchObject({ code: 'invalid_connect_code', constructor: ValidationError });
  });

  it('never repeats an exchange: the first one spends the code', async () => {
    const busy = connect(json(503, problem(503, 'maintenance', 'Back soon'), { 'Retry-After': '1' }));
    await expect(busy.connect.exchange({ code: 'c', codeVerifier: 'v', site: SITE })).rejects.toThrow(MaintenanceError);
    expect(busy.http.requests).toHaveLength(1);
    expect(busy.slept).toEqual([]);

    const down = connect(new TypeError('fetch failed'));
    await expect(down.connect.exchange({ code: 'c', codeVerifier: 'v', site: SITE })).rejects.toThrow(TransportError);
    expect(down.slept).toEqual([]);
  });

  it('redeems an app connect code for one key per approved store, never retried', async () => {
    const answer = example('POST', '/v1/connect/app-exchange', 200);
    const { connect: client, http } = connect(json(200, { stores: [{ id: 's1', name: 'Main', apiKey: 'sk_live_a' }, { id: 's2', name: 'Second', apiKey: 'sk_live_b' }] }));
    expect(await client.exchangeApp({ code: 'code-1', codeVerifier: 'verifier-1' })).toEqual({
      stores: [
        { storeId: 's1', storeName: 'Main', apiKey: 'sk_live_a' },
        { storeId: 's2', storeName: 'Second', apiKey: 'sk_live_b' },
      ],
    });
    const sent = http.last();
    expect([sent.url, sent.headers['Authorization'], JSON.parse(sent.body ?? '')]).toEqual(['https://api.stablevoy.com/v1/connect/app-exchange', undefined, { code: 'code-1', codeVerifier: 'verifier-1' }]);
    expect(Array.isArray(answer['stores'])).toBe(true);

    const busy = connect(json(503, problem(503, 'maintenance', 'Back soon'), { 'Retry-After': '1' }));
    await expect(busy.connect.exchangeApp({ code: 'c', codeVerifier: 'v' })).rejects.toThrow(MaintenanceError);
    expect(busy.http.requests).toHaveLength(1);
  });

  it.each([
    ['a key that is not a store key', { stores: [{ id: 's1', name: 'Main', apiKey: 'pk_live_1' }] }, 'connected.stores[0].apiKey is not an API key (svk_live_, svk_test_, or the older sk_live_, sk_test_)'],
    ['no store at all', { stores: [] }, 'connected.stores is empty'],
  ])('refuses an app answer with %s', async (_name, body, message) => {
    const { connect: client } = connect(json(200, body));
    const error = await client.exchangeApp({ code: 'c', codeVerifier: 'v' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnexpectedResponseError);
    expect((error as Error).message).toBe(message);
  });

  it('applies the same base URL check and needs no key', () => {
    expect(() => StablevoyConnect.create({ baseUrl: 'http://api.stablevoy.com', fetch: new FakeFetch().fetch })).toThrow(ConfigurationError);
  });
});

describe('key revoke', () => {
  it('revokes the key of the client', async () => {
    const { client, http } = testClient([new Response(null, { status: 204 })]);
    await client.stores.revokeCurrentKey();
    expect(http.last()).toMatchObject({ method: 'DELETE', url: 'https://api.stablevoy.com/v1/store/api-keys/current' });
    expect(http.last().headers['Authorization']).toBe('Bearer sk_test_key');
  });

  it('repeats a revoke like a read', async () => {
    const { client, slept } = testClient([new Response('<html>Bad gateway</html>', { status: 502 }), json(503, problem(503, 'maintenance', 'Back soon'), { 'Retry-After': '2' }), new Response(null, { status: 204 })]);
    await client.stores.revokeCurrentKey();
    expect(slept).toEqual([1, 2]);
  });

  it('raises a key that is already revoked', async () => {
    const { client } = testClient([json(401, problem(401, 'authentication_failed', 'Invalid API key'))]);
    await expect(client.stores.revokeCurrentKey()).rejects.toThrow(AuthenticationError);
  });
});
