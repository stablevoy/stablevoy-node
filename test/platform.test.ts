import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import { json } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

describe('store and platform', () => {
  it('reads the store of the key', async () => {
    const store = example('GET', '/v1/store', 200);
    const { client, http } = testClient([json(200, store)]);
    const result = await client.stores.current();
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/store');
    expect(result).toMatchObject({ name: store['name'], enabledNetworks: store['enabledNetworks'] });
  });

  it('reads limits, pricing and networks', async () => {
    const { client } = testClient([json(200, example('GET', '/v1/limits', 200)), json(200, example('GET', '/v1/pricing', 200)), json(200, example('GET', '/v1/networks', 200))]);
    expect((await client.platform.limits()).maxInvoiceUsdCents).toBeGreaterThan(0);
    expect((await client.platform.pricing()).feeBps).toBeGreaterThanOrEqual(0);
    const networks = await client.platform.networks();
    expect(networks.length).toBeGreaterThan(0);
    expect(networks[0]?.tokens.length).toBeGreaterThan(0);
  });

  it('refuses networks that are not a list', async () => {
    await expect(testClient([json(200, { key: 'base' })]).client.platform.networks()).rejects.toThrow(UnexpectedResponseError);
  });
});
