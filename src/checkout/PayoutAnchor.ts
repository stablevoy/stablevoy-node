const EVM = /^0x[0-9a-fA-F]{40}$/;
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

/**
 * The payout wallets your shop confirmed, put in the payment link after # so the Stablevoy payment page refuses any other
 * wallet, even one a compromised server would name. Store it when the merchant confirms the wallets in your shop, never
 * take it from an API answer: that answer is what it guards against.
 */
export class PayoutAnchor {
  readonly evm: string | null;
  readonly tron: string | null;

  constructor(wallets: { readonly evm?: string | null; readonly tron?: string | null }) {
    const evm = wallets.evm ?? null;
    const tron = wallets.tron ?? null;
    if (evm === null && tron === null) throw new RangeError('A payout anchor names at least one wallet (evm or tron)');
    if (evm !== null && !EVM.test(evm)) throw new RangeError('The EVM payout wallet must be an address like 0x followed by 40 hex characters');
    if (tron !== null && !TRON.test(tron)) throw new RangeError('The Tron payout wallet must be a Base58 address starting with T');
    this.evm = evm;
    this.tron = tron;
  }

  /** The part after # of the payment link: payout=evm:0x...;tron:T... */
  fragment(): string {
    const parts: string[] = [];
    if (this.evm !== null) parts.push(`evm:${this.evm}`);
    if (this.tron !== null) parts.push(`tron:${this.tron}`);
    return `payout=${parts.join(';')}`;
  }

  /**
   * Whether a payout address of an invoice is the anchored wallet of its family: EVM compared without regard to letter
   * case, Tron exactly. An address of no known form matches nothing.
   */
  accepts(payoutAddress: string): boolean {
    if (EVM.test(payoutAddress)) return this.evm !== null && this.evm.toLowerCase() === payoutAddress.toLowerCase();
    if (TRON.test(payoutAddress)) return this.tron === payoutAddress;
    return false;
  }
}
