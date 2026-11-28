import { describe, expect, it } from 'vitest';
import { CheckoutLink } from '../src/checkout/CheckoutLink.js';
import { PayoutAnchor } from '../src/checkout/PayoutAnchor.js';
import { PayoutMismatchError } from '../src/errors/PayoutMismatchError.js';
import { UnexpectedResponseError } from '../src/errors/UnexpectedResponseError.js';
import type { CreatedInvoice } from '../src/model/Invoice.js';
import { json } from './support/FakeFetch.js';
import { example } from './support/openApi.js';
import { testClient } from './support/client.js';

const EVM = '0x5cc5bc5cc5bc5cc5bc5cc5bc5cc5bc5cc5bc5cc5';
const TRON = 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8';

/** The documented answer of POST /v1/invoices, read by the client, with the payout wallets set per network. */
async function created(evmPayout: string, tronPayout: string | null = null, checkoutUrl: string | null = null): Promise<CreatedInvoice> {
  const answer = example('POST', '/v1/invoices', 201);
  const [first] = answer['depositAddresses'] as Record<string, unknown>[];
  if (first === undefined) throw new Error('the example invoice has no deposit address');
  const addresses: Record<string, unknown>[] = [{ ...first, network: 'base', payoutAddress: evmPayout }];
  if (tronPayout !== null) addresses.push({ ...first, network: 'tron', address: tronPayout, payoutAddress: tronPayout });
  answer['depositAddresses'] = addresses;
  if (checkoutUrl !== null) answer['checkoutUrl'] = checkoutUrl;
  return testClient([json(201, answer)]).client.invoices.create({ amountUsdCents: 1500 });
}

describe('PayoutAnchor', () => {
  it('builds the fragment and refuses what is not a wallet', () => {
    expect(new PayoutAnchor({ evm: EVM, tron: TRON }).fragment()).toBe(`payout=evm:${EVM};tron:${TRON}`);
    expect(new PayoutAnchor({ tron: TRON }).fragment()).toBe(`payout=tron:${TRON}`);
    for (const wallets of [{}, { evm: null, tron: null }, { evm: '0x12' }, { tron: 'T123' }, { evm: `${EVM}ff` }]) {
      expect(() => new PayoutAnchor(wallets)).toThrow(RangeError);
    }
  });

  it('compares EVM without case and Tron exactly', () => {
    const anchor = new PayoutAnchor({ evm: `0x${EVM.slice(2).toUpperCase()}`, tron: TRON });
    expect(anchor.accepts(EVM)).toBe(true);
    expect(anchor.accepts(TRON)).toBe(true);
    expect(anchor.accepts(TRON.toLowerCase())).toBe(false);
    expect(new PayoutAnchor({ tron: TRON }).accepts(EVM)).toBe(false);
    expect(new PayoutAnchor({ evm: EVM }).accepts(TRON)).toBe(false);
    expect(anchor.accepts('not an address')).toBe(false);
  });
});

describe('CheckoutLink', () => {
  it('builds the link from the site and the invoice id', async () => {
    const invoice = await created(EVM);
    const link = new CheckoutLink().for(invoice, new PayoutAnchor({ evm: EVM }));
    expect(link).toEqual({ url: `https://stablevoy.com/pay/?i=${invoice.invoice.id}#payout=evm:${EVM}`, mismatchedNetworks: [] });
  });

  it('reports the networks whose wallet changed and stops when none is left', async () => {
    expect(new CheckoutLink().for(await created(EVM, TRON), new PayoutAnchor({ evm: EVM })).mismatchedNetworks).toEqual(['tron']);
    const other = `0x${'99'.repeat(20)}`;
    const all = await created(other);
    expect(() => new CheckoutLink().for(all, new PayoutAnchor({ evm: EVM }))).toThrow(PayoutMismatchError);
    expect(() => new CheckoutLink().for(all, new PayoutAnchor({ evm: EVM }))).toThrow(`base: ${other}`);
  });

  it('refuses a payment link of another site', async () => {
    const invoice = await created(EVM, null, 'https://evil.example/pay/?i=x');
    expect(() => new CheckoutLink().for(invoice, new PayoutAnchor({ evm: EVM }))).toThrow(UnexpectedResponseError);
  });

  it('takes a local site and refuses anything but a bare https origin', async () => {
    const invoice = await created(EVM, null, 'https://stablevoy.test:8443/pay/?i=x');
    expect(new CheckoutLink('https://Stablevoy.test:8443').for(invoice, new PayoutAnchor({ evm: EVM })).url).toMatch(/^https:\/\/stablevoy\.test:8443\/pay\/\?i=/);
    for (const bad of ['http://stablevoy.com', 'https://stablevoy.com/', 'https://stablevoy.com/pay', 'https://u@stablevoy.com', 'https://stablevoy.com?x=1', 'https://stablevoy.com#x', 'stablevoy.com']) {
      expect(() => new CheckoutLink(bad), bad).toThrow(RangeError);
    }
  });
});
