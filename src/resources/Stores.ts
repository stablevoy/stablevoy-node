import type { Transport } from '../http/Transport.js';
import { Fields } from '../model/Fields.js';
import { parseStore, type Store } from '../model/Platform.js';

export class Stores {
  constructor(private readonly transport: Transport) {}

  /** The store the API key belongs to: a cheap way to check that the key works. */
  async current(): Promise<Store> {
    return parseStore(Fields.of(await this.transport.get('/v1/store'), 'store'));
  }
}
