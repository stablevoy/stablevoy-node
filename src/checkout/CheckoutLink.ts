import { PayoutMismatchError } from '../errors/PayoutMismatchError.js';
import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import type { CreatedInvoice } from '../model/Invoice.js';
import type { AnchoredLink } from './AnchoredLink.js';
import type { PayoutAnchor } from './PayoutAnchor.js';

/**
 * Builds the payment link of a new invoice with the shop's payout anchor. The link is built from the configured site and
 * the invoice id, never taken from the answer as it is: a checkoutUrl of another site is refused, so a lying answer cannot
 * send the buyer elsewhere. Networks whose wallet the anchor does not name are reported; with none left it throws.
 */
export class CheckoutLink {
  private readonly siteUrl: string;

  constructor(siteUrl = 'https://stablevoy.com') {
    const origin = CheckoutLink.httpsOrigin(siteUrl);
    // Only a bare origin: no path, query, fragment or user part, so the link cannot be bent to another place.
    if (origin === null || origin !== siteUrl.toLowerCase()) throw new RangeError('siteUrl must be a bare https origin such as https://stablevoy.com');
    this.siteUrl = origin;
  }

  private static httpsOrigin(siteUrl: string): string | null {
    try {
      const url = new URL(siteUrl);
      return url.protocol === 'https:' ? url.origin : null;
    } catch {
      return null;
    }
  }

  for(created: CreatedInvoice, anchor: PayoutAnchor): AnchoredLink {
    if (!created.checkoutUrl.startsWith(`${this.siteUrl}/`)) {
      throw new UnexpectedResponseError(`The payment link of the answer is not on ${this.siteUrl}; refusing to send the buyer there`);
    }
    const addresses = created.invoice.depositAddresses;
    const mismatched = addresses.filter((a) => !anchor.accepts(a.payoutAddress));
    if (addresses.length > 0 && mismatched.length === addresses.length) {
      const wallets = mismatched.map((a) => `${a.network}: ${a.payoutAddress}`).join(', ');
      throw new PayoutMismatchError(`No network of the invoice pays to a wallet the shop confirmed (${anchor.fragment()}); the invoice pays to ${wallets}`);
    }
    return { url: `${this.siteUrl}/pay/?i=${encodeURIComponent(created.invoice.id)}#${anchor.fragment()}`, mismatchedNetworks: mismatched.map((a) => a.network) };
  }
}
