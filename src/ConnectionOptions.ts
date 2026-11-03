import type { RetryPolicy } from './http/RetryPolicy.js';
import type { Sleep } from './http/Sleep.js';

/** How a client talks to the API. The defaults are what production needs. */
export interface ConnectionOptions {
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
