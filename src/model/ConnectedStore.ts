import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import type { Fields } from './Fields.js';
import { checkApiKey, checkWebhookSecret } from '../keys/KeyFormat.js';

/** What a redeemed connect code gives the shop: its API key, its webhook signing secret and the store they belong to. */
export interface ConnectedStore {
  readonly apiKey: string;
  readonly webhookSecret: string;
  readonly storeId: string;
  readonly storeName: string;
}

export function parseConnectedStore(f: Fields): ConnectedStore {
  const apiKey = f.string('apiKey');
  if (checkApiKey(apiKey) !== 'ok') throw new UnexpectedResponseError(`${f.pathOf('apiKey')} is not an API key (svk_live_, svk_test_, or the older sk_live_, sk_test_)`);
  const webhookSecret = f.string('webhookSecret');
  if (checkWebhookSecret(webhookSecret) !== 'ok') throw new UnexpectedResponseError(`${f.pathOf('webhookSecret')} is not a webhook secret (svwhsec_, or the older whsec_)`);
  const store = f.object('store');
  return { apiKey, webhookSecret, storeId: store.string('id'), storeName: store.string('name') };
}
