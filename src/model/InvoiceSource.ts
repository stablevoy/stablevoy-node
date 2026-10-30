import type { Fields } from './Fields.js';

/** Where an invoice came from (`source` on an Invoice). */
export interface InvoiceSource {
  /** One of InvoiceSourceKind; a kind added by a newer API version is kept as it is. */
  readonly kind: string;
  /** The plugin, for kind 'plugin': 'woocommerce', 'edd' or 'whmcs'. */
  readonly platform: string | null;
  /** The key that made the invoice, for kinds 'plugin' and 'api_key'. */
  readonly apiKeyId: string | null;
  /** The key's name, for kind 'api_key'. */
  readonly apiKeyName: string | null;
}

export const InvoiceSourceKind = {
  /** Made in the dashboard as a payment link. */
  PaymentLink: 'payment_link',
  /** Made by a plugin connected in one click. */
  Plugin: 'plugin',
  /** Made with an API key created by hand, such as your own code. */
  ApiKey: 'api_key',
  /** Made before sources were recorded (31 October 2026). */
  NotRecorded: 'not_recorded',
} as const;

/** The values of the `source` list filter. */
export const InvoiceSourceFilter = {
  PaymentLink: 'payment_link',
  WooCommerce: 'woocommerce',
  EasyDigitalDownloads: 'edd',
  Whmcs: 'whmcs',
  ApiKey: 'api_key',
  NotRecorded: 'not_recorded',
} as const;

/** The API sends null for an invoice made before sources were recorded. */
export function parseInvoiceSource(f: Fields | null): InvoiceSource {
  if (f === null) return { kind: InvoiceSourceKind.NotRecorded, platform: null, apiKeyId: null, apiKeyName: null };
  const kind = f.string('kind');
  return {
    kind,
    platform: kind === InvoiceSourceKind.Plugin ? f.string('platform') : null,
    apiKeyId: kind === InvoiceSourceKind.Plugin || kind === InvoiceSourceKind.ApiKey ? f.string('apiKeyId') : null,
    apiKeyName: kind === InvoiceSourceKind.ApiKey ? f.string('apiKeyName') : null,
  };
}
