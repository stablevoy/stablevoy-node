import type { Fields } from './Fields.js';

/** Values of Store.evmPayoutStatus. */
export const EVM_PAYOUT_STATUS = {
  PLAIN: 'plain',
  ACKNOWLEDGED: 'acknowledged',
  UNACKNOWLEDGED: 'unacknowledged',
  UNCHECKED: 'unchecked',
} as const;

/** The store the API key belongs to. */
export interface Store {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  /** Network keys, e.g. "base", "tron". */
  readonly enabledNetworks: readonly string[];
  /** Enabled networks with no payout wallet for their family (EVM or Tron) on the account: buyers are not offered them. */
  readonly networksWithoutPayout: readonly string[];
  readonly minInvoiceUsdCents: number | null;
  readonly maxInvoiceUsdCents: number | null;
  readonly webhookUrl: string | null;
  readonly websiteUrl: string | null;
  readonly defaultReturnUrl: string | null;
  readonly createdAt: Date;
  /** The plugin connected to the store in one click ('woocommerce', 'edd', 'whmcs'), or null. */
  readonly connectedPlatform: string | null;
  /**
   * The EVM payout wallet as last read on every EVM network: plain (a regular wallet), acknowledged (a smart contract wallet
   * or EIP-7702 delegation the merchant confirmed), unacknowledged (not confirmed, or changed since: the EVM networks are
   * left out of new invoices until the merchant reviews it in the dashboard), unchecked (not read yet), or null when the
   * account has no EVM payout wallet.
   */
  readonly evmPayoutStatus: string | null;
  /** Enabled EVM networks new invoices leave out because evmPayoutStatus is unacknowledged; empty otherwise. */
  readonly evmNetworksBlocked: readonly string[];
  /** The account's payout wallets per network family, null when not set. Read only: they change in the dashboard with a wallet signature. */
  readonly payoutAddresses: PayoutAddresses;
}

export interface PayoutAddresses {
  readonly evm: string | null;
  readonly tron: string | null;
}

export function parseStore(f: Fields): Store {
  return {
    id: f.string('id'),
    name: f.string('name'),
    status: f.string('status'),
    enabledNetworks: f.strings('enabledNetworks'),
    networksWithoutPayout: f.strings('networksWithoutPayout'),
    minInvoiceUsdCents: f.nullableInt('minInvoiceUsdCents'),
    maxInvoiceUsdCents: f.nullableInt('maxInvoiceUsdCents'),
    webhookUrl: f.nullableString('webhookUrl'),
    websiteUrl: f.nullableString('websiteUrl'),
    defaultReturnUrl: f.nullableString('defaultReturnUrl'),
    createdAt: f.date('createdAt'),
    connectedPlatform: f.nullableString('connectedPlatform'),
    evmPayoutStatus: f.nullableString('evmPayoutStatus'),
    evmNetworksBlocked: f.strings('evmNetworksBlocked'),
    payoutAddresses: parsePayoutAddresses(f.object('payoutAddresses')),
  };
}

function parsePayoutAddresses(f: Fields): PayoutAddresses {
  return { evm: f.nullableString('evm'), tron: f.nullableString('tron') };
}

/**
 * False when no enabled network can be paid: none has a payout wallet (invoices are refused with payout_address_not_set),
 * or the only ones left are EVM networks blocked by an unconfirmed EVM payout wallet (payout_address_unacknowledged). Check
 * it before offering the payment method, and show the merchant networksWithoutPayout and evmNetworksBlocked when they are
 * not empty.
 */
export function canAcceptPayments(store: Store): boolean {
  return store.enabledNetworks.some((key) => !store.networksWithoutPayout.includes(key) && !store.evmNetworksBlocked.includes(key));
}

/**
 * True while the EVM payout wallet is not confirmed in the Stablevoy dashboard: show the merchant evmNetworksBlocked and
 * send them to the dashboard. A store.payout_attention webhook tells when this changes.
 */
export function evmPayoutNeedsReview(store: Store): boolean {
  return store.evmPayoutStatus === EVM_PAYOUT_STATUS.UNACKNOWLEDGED;
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
  /** The forwarder contract the deposit addresses clone; with factoryAddress it is what a manual recovery needs. */
  readonly forwarderImplementation: string | null;
  /** The explorer page of an address is this followed by the address. */
  readonly explorerAddressUrl: string | null;
  /** A public RPC endpoint of the network. */
  readonly rpcUrl: string | null;
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
    forwarderImplementation: f.nullableString('forwarderImplementation'),
    explorerAddressUrl: f.nullableString('explorerAddressUrl'),
    rpcUrl: f.nullableString('rpcUrl'),
  };
}
