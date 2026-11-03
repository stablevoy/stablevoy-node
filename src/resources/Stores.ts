import type { Transport } from '../http/Transport.js';
import { Fields } from '../model/Fields.js';
import { parseStore, type Store } from '../model/Platform.js';

export class Stores {
  constructor(private readonly transport: Transport) {}

  /** The store the API key belongs to: a cheap way to check that the key works. */
  async current(): Promise<Store> {
    return parseStore(Fields.of(await this.transport.get('/v1/store'), 'store'));
  }

  /**
   * Revokes the API key of this client; it stops working at once (use it when the shop disconnects). A key that is already
   * revoked answers with AuthenticationError, which for a disconnect means the same.
   */
  async revokeCurrentKey(): Promise<void> {
    await this.transport.delete('/v1/store/api-keys/current');
  }
}
