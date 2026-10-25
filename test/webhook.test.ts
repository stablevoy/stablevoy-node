import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SignatureError } from '../src/errors/SignatureError.js';
import { WebhookVerifier } from '../src/webhook/WebhookVerifier.js';

interface Vectors {
  readonly secret: string;
  readonly cases: readonly { readonly name: string; readonly timestamp: number; readonly body: string; readonly header: string }[];
}

/** Signed by the API's own TypeScript signer (the same vectors the PHP SDK checks). */
const vectors = JSON.parse(readFileSync(new URL('./fixtures/webhook-vectors.json', import.meta.url), 'utf8')) as Vectors;
const [paid, test] = vectors.cases;
if (paid === undefined || test === undefined) throw new Error('fixture');
const at = (now: number) => ({ clock: { now: () => now } });

describe('WebhookVerifier', () => {
  it('accepts what the API signed, from a string or from bytes', async () => {
    for (const c of vectors.cases) {
      const verifier = new WebhookVerifier(vectors.secret, at(c.timestamp + 10));
      const body = JSON.parse(c.body) as { id: string; type: string };
      expect(await verifier.verify(c.body, c.header)).toMatchObject({ id: body.id, type: body.type });
      expect((await verifier.verify(new TextEncoder().encode(c.body), c.header)).id).toBe(body.id);
    }
  });

  it('gives the invoice of an invoice event and the data of others', async () => {
    const event = await new WebhookVerifier(vectors.secret, at(paid.timestamp)).verify(paid.body, paid.header);
    expect(event.invoice).not.toBeNull();
    expect(event.createdAt.toISOString()).toBe('2026-10-25T10:00:00.000Z');
    const other = await new WebhookVerifier(vectors.secret, at(test.timestamp)).verify(test.body, test.header);
    expect(other.invoice).toBeNull();
    expect(other.data['message']).toBe('Test event from Stablevoy, café');
  });

  it.each([
    ['a changed body', { body: paid.body.replace('paid', 'pa1d') }, 'does not match'],
    ['a wrong secret', { secret: 'whsec_other' }, 'does not match'],
    ['a missing header', { header: undefined }, 'header is missing'],
    ['an empty header', { header: '  ' }, 'header is missing'],
    ['no timestamp', { header: 'v1=abc' }, 'malformed'],
    ['no signature', { header: `t=${paid.timestamp}` }, 'malformed'],
    ['an absurd timestamp', { header: paid.header.replace(/t=\d+/, 't=99999999999999999999') }, 'malformed'],
    ['an old signature', { now: paid.timestamp + 301 }, 'too old'],
    ['a signature from the future', { now: paid.timestamp - 301 }, 'too old'],
  ] as const)('refuses %s', async (_what, change, reason) => {
    const c = { body: paid.body, header: paid.header as string | undefined, secret: vectors.secret, now: paid.timestamp, ...change };
    await expect(new WebhookVerifier(c.secret, at(c.now)).verify(c.body, c.header)).rejects.toThrow(reason);
  });

  it('accepts any of several signatures', async () => {
    const header = paid.header.replace(',v1=', `,v1=${'0'.repeat(64)},v1=`);
    expect((await new WebhookVerifier(vectors.secret, at(paid.timestamp)).verify(paid.body, header)).type).toBe('invoice.paid');
  });

  it('refuses a signature of another length without comparing it', async () => {
    const header = `t=${paid.timestamp},v1=abc`;
    await expect(new WebhookVerifier(vectors.secret, at(paid.timestamp)).verify(paid.body, header)).rejects.toThrow('does not match');
  });

  it.each([
    ['not JSON', 'hello', 'is not JSON'],
    ['JSON that is no event', '{"hello":"world"}', 'is not a Stablevoy event'],
  ])('refuses a signed body that is %s', async (_what, body, reason) => {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(vectors.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`1000.${body}`)));
    const header = `t=1000,v1=${Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    await expect(new WebhookVerifier(vectors.secret, at(1000)).verify(body, header)).rejects.toThrow(reason);
  });

  it('refuses bytes that are not UTF-8', async () => {
    await expect(new WebhookVerifier(vectors.secret, at(paid.timestamp)).verify(new Uint8Array([0xff, 0xfe]), paid.header)).rejects.toThrow(TypeError);
  });

  it('uses the system clock by default, so an old vector is refused', async () => {
    await expect(new WebhookVerifier(vectors.secret).verify(paid.body, paid.header)).rejects.toThrow(SignatureError);
  });

  it('needs a secret and a whole positive tolerance', () => {
    expect(() => new WebhookVerifier('')).toThrow(RangeError);
    expect(() => new WebhookVerifier('whsec_x', { toleranceSeconds: 0 })).toThrow(RangeError);
    expect(() => new WebhookVerifier('whsec_x', { toleranceSeconds: 1.5 })).toThrow(RangeError);
  });
});
