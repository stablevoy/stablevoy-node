import type { Fields } from '../model/Fields.js';
import { parseInvoice, type Invoice } from '../model/Invoice.js';

/**
 * A verified webhook. Types: invoice.paid, invoice.overpaid, invoice.underpaid, invoice.expired, invoice.paid_late,
 * invoice.on_hold and webhook.test. Deliveries can repeat: use `id` to process each event once.
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
