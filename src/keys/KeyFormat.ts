import { crc32 } from './Crc32.js';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CHECKSUMMED_BODY = /^[0-9A-Za-z]{36}$/;
const API_KEY_PREFIXES = ['svk_live_', 'svk_test_'] as const;
const WEBHOOK_SECRET_PREFIX = 'svwhsec_';
/** The older formats are recognised by prefix only, as before the checksummed ones existed. */
const OLDER_API_KEY = /^sk_(live|test)_/;
const OLDER_WEBHOOK_SECRET = /^whsec_/;

/** How a pasted or received key or secret looks: right, wrong in a way that means a typo or a cut copy, or not one at all. */
export type KeyCheck = 'ok' | 'mistyped' | 'not_a_key';

/**
 * Stablevoy store API keys are svk_live_ / svk_test_ followed by 30 random and 6 checksum characters; keys made before the
 * new format are sk_live_ / sk_test_ and keep working. A checksummed key with a broken checksum was mistyped or cut.
 */
export function checkApiKey(value: string): KeyCheck {
  const prefix = API_KEY_PREFIXES.find((p) => value.startsWith(p));
  if (prefix !== undefined) return hasValidChecksum(prefix, value) ? 'ok' : 'mistyped';
  return OLDER_API_KEY.test(value) ? 'ok' : 'not_a_key';
}

/** Webhook signing secrets: svwhsec_ with a checksum, or the older whsec_. */
export function checkWebhookSecret(value: string): KeyCheck {
  if (value.startsWith(WEBHOOK_SECRET_PREFIX)) return hasValidChecksum(WEBHOOK_SECRET_PREFIX, value) ? 'ok' : 'mistyped';
  return OLDER_WEBHOOK_SECRET.test(value) ? 'ok' : 'not_a_key';
}

function hasValidChecksum(prefix: string, value: string): boolean {
  const body = value.slice(prefix.length);
  if (!CHECKSUMMED_BODY.test(body)) return false;
  let n = crc32(prefix + body.slice(0, 30));
  let checksum = '';
  for (let i = 0; i < 6; i++) {
    checksum = BASE62.charAt(n % 62) + checksum;
    n = Math.floor(n / 62);
  }
  return body.slice(30) === checksum;
}
