import { crc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { checkApiKey, checkWebhookSecret } from '../src/index.js';

function withChecksum(prefix: string, random: string): string {
  // Independent of the SDK: zlib's CRC-32 written as 6 base62 characters, as the API builds them (spec SPEC-key-prefixes 4.1).
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let n = crc32(prefix + random);
  let out = '';
  for (let i = 0; i < 6; i++) {
    out = alphabet.charAt(n % 62) + out;
    n = Math.floor(n / 62);
  }
  return prefix + random + out;
}

describe('key formats (svk_ / svwhsec_ with a checksum, older sk_ / whsec_)', () => {
  const random = 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1';

  it('accepts checksummed keys and secrets and the older formats', () => {
    expect(checkApiKey(withChecksum('svk_live_', random))).toBe('ok');
    expect(checkApiKey(withChecksum('svk_test_', random))).toBe('ok');
    expect(checkWebhookSecret(withChecksum('svwhsec_', random))).toBe('ok');
    expect(checkApiKey('sk_live_Xy3-Zq')).toBe('ok');
    expect(checkApiKey('sk_test_Xy3-Zq')).toBe('ok');
    expect(checkWebhookSecret('whsec_abc')).toBe('ok');
  });

  it('says mistyped for a checksummed key with a changed, missing or extra character', () => {
    const key = withChecksum('svk_live_', random);
    expect(checkApiKey(key.slice(0, -1) + (key.endsWith('a') ? 'b' : 'a'))).toBe('mistyped');
    expect(checkApiKey(key.slice(0, -1))).toBe('mistyped');
    expect(checkApiKey(`${key}x`)).toBe('mistyped');
    expect(checkApiKey(`svk_live_${'-'.repeat(36)}`)).toBe('mistyped');
    expect(checkWebhookSecret(withChecksum('svwhsec_', random).slice(0, -2))).toBe('mistyped');
  });

  it('says not a key for anything else', () => {
    for (const value of ['', 'pk_live_abc', 'svk_prod_abc', 'Bearer sk_live_abc', 'eyJhbGciOi']) expect(checkApiKey(value)).toBe('not_a_key');
    expect(checkWebhookSecret('sk_live_abc')).toBe('not_a_key');
    expect(checkApiKey(withChecksum('svwhsec_', random))).toBe('not_a_key');
  });
});
