import type { Fields } from './Fields.js';

/**
 * A payment to the payout wallet on a direct network (Tron) that matched no invoice, usually an exchange that took its
 * withdrawal fee out of the amount. Attach it to an invoice in the Stablevoy dashboard; an API key cannot.
 */
export interface UnmatchedTransfer {
  readonly id: string;
  /** Network key, for example tron. */
  readonly network: string;
  readonly networkName: string;
  /** The payout wallet the transfer arrived at. */
  readonly payoutAddress: string;
  readonly fromAddress: string;
  readonly txHash: string;
  readonly tokenSymbol: string;
  /** What arrived, in millionths of a dollar, as a string: "98500137" is $98.500137. */
  readonly amountUsdMicros: string;
  readonly detectedAt: Date;
  /** Prefix of the transaction page on the block explorer; Tronscan takes the hash without its 0x prefix. */
  readonly explorerTxUrl: string;
  /**
   * How many active stores of the account offer this network. The payout wallet belongs to the account, not to one store,
   * so 1 means the transfer is certainly this store's and more means it may belong to any of that many stores.
   */
  readonly sharedWithStores: number;
}

export function parseUnmatchedTransfer(f: Fields): UnmatchedTransfer {
  return {
    id: f.string('id'),
    network: f.string('network'),
    networkName: f.string('networkName'),
    payoutAddress: f.string('payoutAddress'),
    fromAddress: f.string('fromAddress'),
    txHash: f.string('txHash'),
    tokenSymbol: f.string('tokenSymbol'),
    amountUsdMicros: f.string('amountUsdMicros'),
    detectedAt: f.date('detectedAt'),
    explorerTxUrl: f.string('explorerTxUrl'),
    sharedWithStores: f.int('sharedWithStores'),
  };
}
