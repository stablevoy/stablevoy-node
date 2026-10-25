import type { Fields } from './Fields.js';

/** The store the API key belongs to. */
export interface Store {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  /** Network keys, e.g. "base", "tron". */
  readonly enabledNetworks: readonly string[];
  readonly minInvoiceUsdCents: number | null;
  readonly maxInvoiceUsdCents: number | null;
  readonly webhookUrl: string | null;
  readonly websiteUrl: string | null;
  readonly defaultReturnUrl: string | null;
  readonly createdAt: Date;
}

export function parseStore(f: Fields): Store {
  return {
    id: f.string('id'),
    name: f.string('name'),
    status: f.string('status'),
    enabledNetworks: f.strings('enabledNetworks'),
    minInvoiceUsdCents: f.nullableInt('minInvoiceUsdCents'),
    maxInvoiceUsdCents: f.nullableInt('maxInvoiceUsdCents'),
    webhookUrl: f.nullableString('webhookUrl'),
    websiteUrl: f.nullableString('websiteUrl'),
    defaultReturnUrl: f.nullableString('defaultReturnUrl'),
    createdAt: f.date('createdAt'),
  };
}

/** The smallest and largest invoice the platform accepts, in US cents. */
export interface Limits {
  readonly minInvoiceUsdCents: number;
  readonly maxInvoiceUsdCents: number;
}

export function parseLimits(f: Fields): Limits {
  return { minInvoiceUsdCents: f.int('minInvoiceUsdCents'), maxInvoiceUsdCents: f.int('maxInvoiceUsdCents') };
}

/** The live price list: the free volume per payout wallet, the fee and the cap written into the contracts (50 bps is 0.5%). */
export interface Pricing {
  readonly freeVolumeUsdCents: number;
  readonly feeBps: number;
  readonly maxFeeBps: number;
}

export function parsePricing(f: Fields): Pricing {
  return { freeVolumeUsdCents: f.int('freeVolumeUsdCents'), feeBps: f.int('feeBps'), maxFeeBps: f.int('maxFeeBps') };
}

export interface Token {
  readonly symbol: string;
  readonly address: string;
  readonly decimals: number;
}

/** A network the platform accepts payments on. settlement is "forwarder" (deposit contracts) or "direct" (Tron: the merchant's own wallet). */
export interface Network {
  readonly key: string;
  readonly displayName: string;
  readonly family: string;
  readonly chainId: number;
  readonly confirmations: number;
  readonly settlement: string;
  readonly factoryAddress: string | null;
  readonly explorerUrl: string | null;
  readonly tokens: readonly Token[];
}

export function parseNetwork(f: Fields): Network {
  return {
    key: f.string('key'),
    displayName: f.string('displayName'),
    family: f.string('family'),
    chainId: f.int('chainId'),
    confirmations: f.int('confirmations'),
    settlement: f.string('settlement'),
    factoryAddress: f.nullableString('factoryAddress'),
    explorerUrl: f.nullableString('explorerUrl'),
    tokens: f.objects('tokens', (t) => ({ symbol: t.string('symbol'), address: t.string('address'), decimals: t.int('decimals') })),
  };
}
