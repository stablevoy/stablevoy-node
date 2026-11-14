import { describe, expect, it } from 'vitest';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import { canAcceptPayments, evmPayoutNeedsReview, EVM_PAYOUT_STATUS, PAYOUT_SOURCE } from '../src/model/Platform.js';
import { ApiError } from '../src/errors/ApiError.js';
import { WEBHOOK_HEALTH_STATUS } from '../src/model/WebhookHealth.js';
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

  it('reads the payout addresses of the account', async () => {
    const store = example('GET', '/v1/store', 200);
    const read = await testClient([json(200, { ...store, payoutAddresses: { evm: '0x' + 'ab'.repeat(20), tron: null } })]).client.stores.current();
    expect(read.payoutAddresses).toEqual({ evm: '0x' + 'ab'.repeat(20), tron: null });
    const old = { ...store };
    delete old['payoutAddresses'];
    await expect(testClient([json(200, old)]).client.stores.current()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('reads where each payout wallet comes from, the account wallets and the archive date (store payout addresses)', async () => {
    const store = example('GET', '/v1/store', 200);
    const read = await testClient([json(200, { ...store, payoutSources: { evm: PAYOUT_SOURCE.STORE, tron: null }, accountPayoutAddresses: { evm: '0x' + 'cd'.repeat(20), tron: null } })]).client.stores.current();
    expect(read.payoutSources).toEqual({ evm: 'store', tron: null });
    expect(read.accountPayoutAddresses).toEqual({ evm: '0x' + 'cd'.repeat(20), tron: null });
    expect(read.archivedAt).toBeNull();
    expect((await testClient([json(200, { ...store, archivedAt: '2026-11-10T10:00:00.000Z' })]).client.stores.current()).archivedAt).toEqual(new Date('2026-11-10T10:00:00.000Z'));
    for (const field of ['payoutSources', 'accountPayoutAddresses', 'archivedAt']) {
      const old = Object.fromEntries(Object.entries(store).filter(([key]) => key !== field));
      await expect(testClient([json(200, old)]).client.stores.current()).rejects.toBeInstanceOf(UnexpectedResponseError);
    }
  });

  it('reads the state of the webhook endpoint, null without a webhook URL (paused endpoints)', async () => {
    const store = example('GET', '/v1/store', 200);
    const paused = { status: WEBHOOK_HEALTH_STATUS.PAUSED, failingSince: '2026-11-12T10:00:00.000Z', failedAttempts: 31, pausesAt: null, pausedAt: '2026-11-13T10:00:00.000Z', pauseReason: 'Endpoint answered HTTP 500' };
    const read = await testClient([json(200, { ...store, webhookHealth: paused })]).client.stores.current();
    expect(read.webhookHealth).toEqual({ status: 'paused', failingSince: new Date('2026-11-12T10:00:00.000Z'), failedAttempts: 31, pausesAt: null, pausedAt: new Date('2026-11-13T10:00:00.000Z'), pauseReason: 'Endpoint answered HTTP 500' });
    const failing = { status: WEBHOOK_HEALTH_STATUS.FAILING, failingSince: '2026-11-12T10:00:00.000Z', failedAttempts: 12, pausesAt: '2026-11-13T10:00:00.000Z', pausedAt: null, pauseReason: null };
    expect((await testClient([json(200, { ...store, webhookHealth: failing })]).client.stores.current()).webhookHealth?.pausesAt).toEqual(new Date('2026-11-13T10:00:00.000Z'));
    expect((await testClient([json(200, { ...store, webhookHealth: null })]).client.stores.current()).webhookHealth).toBeNull();
    expect(WEBHOOK_HEALTH_STATUS.ACTIVE).toBe('active');
    const old = Object.fromEntries(Object.entries(store).filter(([key]) => key !== 'webhookHealth'));
    await expect(testClient([json(200, old)]).client.stores.current()).rejects.toBeInstanceOf(UnexpectedResponseError);
    await expect(testClient([json(200, { ...store, webhookHealth: { ...failing, failedAttempts: 'many' } })]).client.stores.current()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('reads the payment window of the store, null for the platform default', async () => {
    const store = example('GET', '/v1/store', 200);
    expect((await testClient([json(200, store)]).client.stores.current()).invoiceLifetimeMinutes).toBeNull();
    expect((await testClient([json(200, { ...store, invoiceLifetimeMinutes: 1440 })]).client.stores.current()).invoiceLifetimeMinutes).toBe(1440);
    const old = { ...store };
    delete old['invoiceLifetimeMinutes'];
    await expect(testClient([json(200, old)]).client.stores.current()).rejects.toBeInstanceOf(UnexpectedResponseError);
  });

  it('reads the invoice lifetime from the limits', async () => {
    const limits = example('GET', '/v1/limits', 200);
    expect(await testClient([json(200, limits)]).client.platform.limits()).toEqual(limits);
    expect(ApiError.INVALID_INVOICE_LIFETIME).toBe('invalid_invoice_lifetime');
  });

  it('reads the per-store limits and refuses limits without them', async () => {
    const limits = await testClient([json(200, example('GET', '/v1/limits', 200))]).client.platform.limits();
    expect(limits.apiKeysPerStore.mcp).toBeGreaterThan(0);
    expect(limits.openInvoicesPerStore).toBeGreaterThan(0);
    expect(limits.invoicesPerMinutePerStore).toBeGreaterThan(0);
    expect(ApiError.OPEN_INVOICE_LIMIT_REACHED).toBe('open_invoice_limit_reached');
    const old = example('GET', '/v1/limits', 200);
    delete old['openInvoicesPerStore'];
    await expect(testClient([json(200, old)]).client.platform.limits()).rejects.toBeInstanceOf(UnexpectedResponseError);
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
