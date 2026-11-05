import type { ConnectionOptions } from './ConnectionOptions.js';
import { createFetchTransport } from './http/createFetchTransport.js';
import type { Transport } from './http/Transport.js';
import { parseConnectedStore, type ConnectedStore } from './model/ConnectedStore.js';
import { parseConnectedApp, type ConnectedApp } from './model/ConnectedApp.js';
import { Fields } from './model/Fields.js';

/** A connect code to redeem: the code from the callback, the PKCE verifier kept for it, and the shop's own URL. */
export interface ExchangeInput {
  readonly code: string;
  readonly codeVerifier: string;
  /** The same URL the shop sent when the connection was started. */
  readonly site: string;
}

/** An app connect code to redeem: the code from the loopback callback and the PKCE verifier kept for it. */
export interface ExchangeAppInput {
  readonly code: string;
  readonly codeVerifier: string;
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

  /**
   * Redeems the code an app on the merchant's own computer got on its loopback address (npx stablevoy-mcp login): one new
   * API key per approved store. It works once, so this call is never retried. A refusal is an ApiError invalid_connect_code.
   */
  async exchangeApp(input: ExchangeAppInput): Promise<ConnectedApp> {
    const body = { code: input.code, codeVerifier: input.codeVerifier };
    return parseConnectedApp(Fields.of(await this.transport.post('/v1/connect/app-exchange', body), 'connected'));
  }
}
