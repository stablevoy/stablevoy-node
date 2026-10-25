import type { Fields } from './Fields.js';

/** Where the buyer pays on one network: a one-time deposit address, or on Tron the merchant's own wallet. */
export interface DepositAddress {
  readonly network: string;
  readonly address: string;
  readonly payoutAddress: string;
  readonly amountDueUsdCents: number;
}

/** A transfer to the invoice. The amount is in the token's smallest units, as a string: "19990000" is 19.99 USDC. */
export interface Payment {
  readonly id: string;
  readonly network: string;
  readonly amountDueUsdCents: number;
  readonly token: string;
  readonly amount: string;
  readonly txHash: string;
  /** "detected" or "confirmed". */
  readonly status: string;
  readonly screeningStatus: string;
  readonly detectedAt: Date;
}

/** An invoice as the API returns it. Amounts are integers in US cents. */
export interface Invoice {
  readonly id: string;
  readonly storeId: string;
  /** See InvoiceStatus; isPaidStatus() says whether the order can be fulfilled. */
  readonly status: string;
  readonly amountUsdCents: number;
  readonly feeBps: number;
  readonly invoiceSalt: string;
  readonly externalReference: string | null;
  readonly returnUrl: string | null;
  readonly expiresAt: Date;
  readonly paidAt: Date | null;
  readonly holdReason: string | null;
  readonly createdAt: Date;
  readonly depositAddresses: readonly DepositAddress[];
  readonly payments: readonly Payment[];
}

export function parseInvoice(f: Fields): Invoice {
  return {
    id: f.string('id'),
    storeId: f.string('storeId'),
    status: f.string('status'),
    amountUsdCents: f.int('amountUsdCents'),
    feeBps: f.int('feeBps'),
    invoiceSalt: f.string('invoiceSalt'),
    externalReference: f.nullableString('externalReference'),
    returnUrl: f.nullableString('returnUrl'),
    expiresAt: f.date('expiresAt'),
    paidAt: f.nullableDate('paidAt'),
    holdReason: f.nullableString('holdReason'),
    createdAt: f.date('createdAt'),
    depositAddresses: f.objects('depositAddresses', (a) => ({
      network: a.string('network'),
      address: a.string('address'),
      payoutAddress: a.string('payoutAddress'),
      amountDueUsdCents: a.int('amountDueUsdCents'),
    })),
    payments: f.objects('payments', (p) => ({
      id: p.string('id'),
      network: p.string('network'),
      amountDueUsdCents: p.int('amountDueUsdCents'),
      token: p.string('token'),
      amount: p.string('amount'),
      txHash: p.string('txHash'),
      status: p.string('status'),
      screeningStatus: p.string('screeningStatus'),
      detectedAt: p.date('detectedAt'),
    })),
  };
}

/** The answer to creating an invoice: the invoice, the hosted payment page to send the buyer to, and what was left out. */
export interface CreatedInvoice {
  readonly invoice: Invoice;
  readonly checkoutUrl: string;
  /** Enabled networks left out of this invoice right now. */
  readonly unavailableNetworks: readonly string[];
  /** True when the idempotency key matched an earlier request and that invoice is returned. */
  readonly replayed: boolean;
}

export function parseCreatedInvoice(f: Fields): CreatedInvoice {
  return { invoice: parseInvoice(f), checkoutUrl: f.string('checkoutUrl'), unavailableNetworks: f.strings('unavailableNetworks'), replayed: f.bool('replayed') };
}

/** One page of invoices, newest first; pass nextCursor to get the next page, null on the last one. */
export interface InvoicePage {
  readonly items: readonly Invoice[];
  readonly nextCursor: string | null;
}

export function parseInvoicePage(f: Fields): InvoicePage {
  return { items: f.objects('items', parseInvoice), nextCursor: f.nullableString('nextCursor') };
}

/** What to create an invoice for: the amount in US cents, your order id and where the buyer returns after paying. */
export interface CreateInvoiceInput {
  readonly amountUsdCents: number;
  readonly externalReference?: string;
  readonly returnUrl?: string;
}
