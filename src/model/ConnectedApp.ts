import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import type { Fields } from './Fields.js';
import { checkApiKey } from '../keys/KeyFormat.js';

/** One store an app on the merchant's computer was approved for, with its new API key. */
export interface ConnectedAppStore {
  readonly storeId: string;
  readonly storeName: string;
  readonly apiKey: string;
}

/** What a redeemed app connect code gives: one API key per approved store, in the order they were approved. */
export interface ConnectedApp {
  readonly stores: readonly ConnectedAppStore[];
}

export function parseConnectedApp(f: Fields): ConnectedApp {
  const stores = f.objects('stores', (s) => {
    const apiKey = s.string('apiKey');
    if (checkApiKey(apiKey) !== 'ok') throw new UnexpectedResponseError(`${s.pathOf('apiKey')} is not an API key (svk_live_, svk_test_, or the older sk_live_, sk_test_)`);
    return { storeId: s.string('id'), storeName: s.string('name'), apiKey };
  });
  if (stores.length === 0) throw new UnexpectedResponseError(`${f.pathOf('stores')} is empty`);
  return { stores };
}
