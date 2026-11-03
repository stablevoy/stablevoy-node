import type { ConnectionOptions } from './ConnectionOptions.js';
import { createFetchTransport } from './http/createFetchTransport.js';
import type { Transport } from './http/Transport.js';
import { Invoices } from './resources/Invoices.js';
import { Platform } from './resources/Platform.js';
import { Stores } from './resources/Stores.js';

export interface StablevoyOptions extends ConnectionOptions {
  /** The store's API key (sk_live_... or sk_test_...). */
  readonly apiKey: string;
}

/** The Stablevoy API: `const stablevoy = Stablevoy.create({ apiKey: process.env.STABLEVOY_API_KEY })`. */
export class Stablevoy {
  constructor(
    readonly invoices: Invoices,
    readonly stores: Stores,
    readonly platform: Platform,
  ) {}

  static create(options: StablevoyOptions): Stablevoy {
    return Stablevoy.fromTransport(createFetchTransport(options.apiKey, options));
  }

  static fromTransport(transport: Transport): Stablevoy {
    return new Stablevoy(new Invoices(transport), new Stores(transport), new Platform(transport));
  }
}
