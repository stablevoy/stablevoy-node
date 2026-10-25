import { ErrorFactory } from './http/ErrorFactory.js';
import { FetchTransport } from './http/FetchTransport.js';
import { RetryPolicy } from './http/RetryPolicy.js';
import { realSleep, type Sleep } from './http/Sleep.js';
import type { Transport } from './http/Transport.js';
import { ConfigurationError } from './errors/ConfigurationError.js';
import { Invoices } from './resources/Invoices.js';
import { Platform } from './resources/Platform.js';
import { Stores } from './resources/Stores.js';
import { VERSION } from './version.js';

export interface StablevoyOptions {
  /** The store's API key (sk_live_... or sk_test_...). */
  readonly apiKey: string;
  /** https://api.stablevoy.com by default. */
  readonly baseUrl?: string;
  readonly retries?: RetryPolicy;
  /** The global fetch by default. */
  readonly fetch?: typeof fetch;
  readonly sleep?: Sleep;
  /** Added to the User-Agent, e.g. "my-shop/2.1". */
  readonly userAgentSuffix?: string;
  /** Seconds before an attempt is given up, at most 600; 30 by default. */
  readonly timeoutSeconds?: number;
}

/** The Stablevoy API: `const stablevoy = Stablevoy.create({ apiKey: process.env.STABLEVOY_API_KEY })`. */
export class Stablevoy {
  constructor(
    readonly invoices: Invoices,
    readonly stores: Stores,
    readonly platform: Platform,
  ) {}

  static create(options: StablevoyOptions): Stablevoy {
    const fetchFn = options.fetch ?? globalThis.fetch;
    if (typeof fetchFn !== 'function') throw new ConfigurationError('No fetch is available. Use Node 22 or newer, or pass one as options.fetch.');
    // Node 21+, Bun, Deno and edge runtimes all name themselves here, e.g. "Node.js/26".
    const runtime = typeof navigator === 'undefined' ? 'unknown-runtime' : navigator.userAgent;
    return Stablevoy.fromTransport(
      new FetchTransport({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl ?? 'https://api.stablevoy.com',
        userAgent: `stablevoy-node/${VERSION} ${runtime}${options.userAgentSuffix === undefined ? '' : ` ${options.userAgentSuffix}`}`,
        retries: options.retries ?? new RetryPolicy(),
        fetch: fetchFn,
        sleep: options.sleep ?? realSleep,
        errors: new ErrorFactory(),
        timeoutSeconds: options.timeoutSeconds ?? 30,
      }),
    );
  }

  static fromTransport(transport: Transport): Stablevoy {
    return new Stablevoy(new Invoices(transport), new Stores(transport), new Platform(transport));
  }
}
