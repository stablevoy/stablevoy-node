import { SignatureError } from '../errors/SignatureError.js';
import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import { Fields } from '../model/Fields.js';
import { systemClock, type Clock } from '../time/Clock.js';
import { parseWebhookEvent, type WebhookEvent } from './WebhookEvent.js';

export interface WebhookVerifierOptions {
  /** How old a signature may be, against replays; 300 seconds by default. */
  readonly toleranceSeconds?: number;
  readonly clock?: Clock;
}

const encoder = new TextEncoder();

/** Compares two strings without leaking where they differ through timing. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Checks the X-Stablevoy-Signature header of a webhook (t=<unix>,v1=<hex hmac-sha256(secret, t + "." + raw body)>) and
 * returns the event. Pass the raw request body exactly as received, before any JSON parsing. Uses Web Crypto, so it runs
 * on Node, Bun, Deno and edge runtimes.
 */
export class WebhookVerifier {
  private readonly key: Promise<CryptoKey>;
  private readonly toleranceSeconds: number;
  private readonly clock: Clock;

  /** `secret` is the webhook signing secret of the store (whsec_...). */
  constructor(secret: string, options: WebhookVerifierOptions = {}) {
    if (secret === '') throw new RangeError('The webhook signing secret is empty. It is shown once when you set the webhook URL in the dashboard.');
    this.toleranceSeconds = options.toleranceSeconds ?? 300;
    if (!Number.isInteger(this.toleranceSeconds) || this.toleranceSeconds < 1) throw new RangeError('toleranceSeconds must be a whole number of at least 1');
    this.clock = options.clock ?? systemClock;
    this.key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }

  async verify(rawBody: string | Uint8Array, signatureHeader: string | null | undefined): Promise<WebhookEvent> {
    const body = typeof rawBody === 'string' ? rawBody : new TextDecoder('utf-8', { fatal: true }).decode(rawBody);
    const { timestamp, signatures } = WebhookVerifier.parse(signatureHeader ?? '');
    if (Math.abs(this.clock.now() - timestamp) > this.toleranceSeconds) throw new SignatureError('The webhook signature is too old or from the future; check the server clock');
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await this.key, encoder.encode(`${timestamp}.${body}`)));
    const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
    if (!signatures.some((signature) => constantTimeEqual(expected, signature))) throw new SignatureError('The webhook signature does not match: wrong secret, or the body was changed');
    let decoded: unknown;
    try {
      decoded = JSON.parse(body);
    } catch (error) {
      throw new SignatureError('The webhook is signed but its body is not JSON', { cause: error });
    }
    try {
      return parseWebhookEvent(Fields.of(decoded, 'event'));
    } catch (error) {
      throw new SignatureError(`The webhook is signed but its body is not a Stablevoy event: ${(error as UnexpectedResponseError).message}`, { cause: error });
    }
  }

  private static parse(header: string): { timestamp: number; signatures: string[] } {
    if (header.trim() === '') throw new SignatureError('The X-Stablevoy-Signature header is missing');
    let timestamp: number | null = null;
    const signatures: string[] = [];
    for (const part of header.split(',')) {
      const [key = '', value = ''] = part.trim().split('=', 2);
      if (key === 't' && /^\d{1,12}$/.test(value)) timestamp = Number(value);
      else if (key === 'v1' && value !== '') signatures.push(value);
    }
    if (timestamp === null || signatures.length === 0) throw new SignatureError('The X-Stablevoy-Signature header is malformed');
    return { timestamp, signatures };
  }
}
