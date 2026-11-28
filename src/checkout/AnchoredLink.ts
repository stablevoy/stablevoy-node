/** A payment link with the shop's payout anchor, and the networks of the invoice whose wallet the anchor does not name. */
export interface AnchoredLink {
  readonly url: string;
  /** Networks the payment page will leave out: tell the merchant their payout wallet changed. */
  readonly mismatchedNetworks: readonly string[];
}
