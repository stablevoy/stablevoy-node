import type { ConnectionOptions } from './ConnectionOptions.js';
import { createFetchTransport } from './http/createFetchTransport.js';
import type { Transport } from './http/Transport.js';
import { parseConnectedStore, type ConnectedStore } from './model/ConnectedStore.js';
import { Fields } from './model/Fields.js';

/** A connect code to redeem: the code from the callback, the PKCE verifier kept for it, and the shop's own URL. */
export interface ExchangeInput {
  readonly code: string;
  readonly codeVerifier: string;
  /** The same URL the shop sent when the connection was started. */
  readonly site: string;
}

/**
 * One-click connect: the shop sends the merchant to the Stablevoy dashboard with a PKCE challenge, gets a code back on its
 * callback and redeems it here for its API key and webhook secret. Needs no API key, since the shop has none yet.
 */
export class StablevoyConnect {
  constructor(private readonly transport: Transport) {}

  static create(options: ConnectionOptions = {}): StablevoyConnect {
    return new StablevoyConnect(createFetchTransport(null, options));
  }

  /**
   * Redeems the code. It works once, so this call is never retried: after a lost answer the merchant clicks Connect again.
   * A refusal (invalid_connect_code, store_linked_to_other_site, store_connected_other_platform) is an ApiError with that code.
   */
  async exchange(input: ExchangeInput): Promise<ConnectedStore> {
    const body = { code: input.code, codeVerifier: input.codeVerifier, site: input.site };
    return parseConnectedStore(Fields.of(await this.transport.post('/v1/connect/exchange', body), 'connected'));
  }
}
