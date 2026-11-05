import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import { canAcceptPayments, evmPayoutNeedsReview, EVM_PAYOUT_STATUS } from '../src/model/Platform.js';
import { ApiError } from '../src/errors/ApiError.js';
import { json } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

describe('store and platform', () => {
  it('reads the store of the key', async () => {
    const store = example('GET', '/v1/store', 200);
    const { client, http } = testClient([json(200, store)]);
    const result = await client.stores.current();
    expect(http.last().url).toBe('https://api.stablevoy.com/v1/store');
    expect(result).toMatchObject({ name: store['name'], enabledNetworks: store['enabledNetworks'], networksWithoutPayout: [] });
    expect(canAcceptPayments(result)).toBe(true);
  });

  it('tells whether any enabled network has a payout wallet', async () => {
    const read = async (missing: string[]) =>
      testClient([json(200, { ...example('GET', '/v1/store', 200), enabledNetworks: ['base', 'tron'], networksWithoutPayout: missing })]).client.stores.current();
    expect((await read(['tron'])).networksWithoutPayout).toEqual(['tron']);
    expect(canAcceptPayments(await read(['tron']))).toBe(true);
    expect(canAcceptPayments(await read(['base', 'tron']))).toBe(false);
    expect(ApiError.PAYOUT_ADDRESS_NOT_SET).toBe('payout_address_not_set');
  });

  it('reads the EVM payout status and the networks it blocks', async () => {
    const store = example('GET', '/v1/store', 200);
    const plain = await testClient([json(200, store)]).client.stores.current();
    expect(plain).toMatchObject({ evmPayoutStatus: store['evmPayoutStatus'], evmNetworksBlocked: [] });
    expect(evmPayoutNeedsReview(plain)).toBe(false);
    const read = async (fields: Record<string, unknown>) =>
      testClient([json(200, { ...store, enabledNetworks: ['base', 'tron'], networksWithoutPayout: [], ...fields })]).client.stores.current();
    const blocked = await read({ evmPayoutStatus: EVM_PAYOUT_STATUS.UNACKNOWLEDGED, evmNetworksBlocked: ['base'] });
    expect(evmPayoutNeedsReview(blocked)).toBe(true);
    expect(blocked.evmNetworksBlocked).toEqual(['base']);
    expect(canAcceptPayments(blocked)).toBe(true);
    expect(canAcceptPayments(await read({ evmPayoutStatus: 'unacknowledged', evmNetworksBlocked: ['base'], networksWithoutPayout: ['tron'] }))).toBe(false);
    expect((await read({ evmPayoutStatus: null })).evmPayoutStatus).toBeNull();
    expect(ApiError.PAYOUT_ADDRESS_UNACKNOWLEDGED).toBe('payout_address_unacknowledged');
  });

  it('refuses a store without the EVM payout fields', async () => {
    const old = example('GET', '/v1/store', 200);
    delete old['evmNetworksBlocked'];
    await expect(testClient([json(200, old)]).client.stores.current()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('refuses a store without the payout field', async () => {
    const old = example('GET', '/v1/store', 200);
    delete old['networksWithoutPayout'];
    await expect(testClient([json(200, old)]).client.stores.current()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('reads limits, pricing and networks', async () => {
    const { client } = testClient([json(200, example('GET', '/v1/limits', 200)), json(200, example('GET', '/v1/pricing', 200)), json(200, example('GET', '/v1/networks', 200))]);
    expect((await client.platform.limits()).maxInvoiceUsdCents).toBeGreaterThan(0);
    expect((await client.platform.pricing()).feeBps).toBeGreaterThanOrEqual(0);
    const networks = await client.platform.networks();
    expect(networks.length).toBeGreaterThan(0);
    expect(networks[0]?.tokens.length).toBeGreaterThan(0);
    const first = (example('GET', '/v1/networks', 200) as unknown as Record<string, unknown>[])[0] ?? {};
    expect(networks[0]).toMatchObject({ forwarderImplementation: first['forwarderImplementation'], explorerAddressUrl: first['explorerAddressUrl'], rpcUrl: first['rpcUrl'] });
  });

  it('names the plugin connected to the store', async () => {
    const store = await testClient([json(200, { ...example('GET', '/v1/store', 200), connectedPlatform: 'woocommerce' })]).client.stores.current();
    expect(store.connectedPlatform).toBe('woocommerce');
    expect((await testClient([json(200, example('GET', '/v1/store', 200))]).client.stores.current()).connectedPlatform).toBeNull();
  });

  it('refuses networks that are not a list', async () => {
    await expect(testClient([json(200, { key: 'base' })]).client.platform.networks()).rejects.toThrow(UnexpectedResponseError);
  });
});
