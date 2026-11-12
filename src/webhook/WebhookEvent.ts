import type { Fields } from '../model/Fields.js';
import { parseInvoice, type Invoice } from '../model/Invoice.js';

/**
 * A verified webhook. Types: invoice.paid, invoice.overpaid, invoice.underpaid, invoice.expired, invoice.paid_late,
 * invoice.on_hold, invoice.cancelled, invoice.payment_flagged, store.payout_attention, api_key.leaked, webhook_secret.leaked
 * and webhook.test. invoice.payment_flagged: a payment of a settled invoice was flagged by screening; the invoice keeps its
 * status and `data.payment` holds the payment. store.payout_attention: the EVM payout wallet this store uses (its own or the
 * account's) became unconfirmed or is fine again; `invoice` is null and `data.payout` holds status, source ('store' or
 * 'account'), blockedNetworks and dashboardUrl. Read stores.current() again for the current state. api_key.leaked: GitHub
 * found an API key of the store in public code and it was revoked; webhook_secret.leaked: the same for the webhook signing
 * secret, which the merchant rotates in the dashboard; `invoice` is null for both.
 * Deliveries can repeat: use `id` to process each event once.
 */
export interface WebhookEvent {
  readonly id: string;
  readonly type: string;
  readonly createdAt: Date;
  /** The invoice of an invoice.* event, null for other types. */
  readonly invoice: Invoice | null;
  /** The event data as sent. */
  readonly data: Readonly<Record<string, unknown>>;
}

export function parseWebhookEvent(f: Fields): WebhookEvent {
  const type = f.string('type');
  const data = f.object('data');
  return { id: f.string('id'), type, createdAt: f.date('createdAt'), invoice: type.startsWith('invoice.') ? parseInvoice(data.object('invoice')) : null, data: data.raw() };
}
