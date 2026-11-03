import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import type { Fields } from './Fields.js';

/** What a redeemed connect code gives the shop: its API key, its webhook signing secret and the store they belong to. */
export interface ConnectedStore {
  readonly apiKey: string;
  readonly webhookSecret: string;
  readonly storeId: string;
  readonly storeName: string;
}

export function parseConnectedStore(f: Fields): ConnectedStore {
  const apiKey = f.string('apiKey');
  if (!/^sk_(live|test)_/.test(apiKey)) throw new UnexpectedResponseError(`${f.pathOf('apiKey')} is not an API key (sk_live_ or sk_test_)`);
  const webhookSecret = f.string('webhookSecret');
  if (!webhookSecret.startsWith('whsec_')) throw new UnexpectedResponseError(`${f.pathOf('webhookSecret')} is not a webhook secret (whsec_)`);
  const store = f.object('store');
  return { apiKey, webhookSecret, storeId: store.string('id'), storeName: store.string('name') };
}
