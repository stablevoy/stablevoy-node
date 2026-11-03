import type { ConnectionOptions } from '../ConnectionOptions.js';
import { ConfigurationError } from '../errors/ConfigurationError.js';
import { VERSION } from '../version.js';
import { ErrorFactory } from './ErrorFactory.js';
import { FetchTransport } from './FetchTransport.js';
import { RetryPolicy } from './RetryPolicy.js';
import { realSleep } from './Sleep.js';

/** The transport Stablevoy and StablevoyConnect talk through, built the same way for both. */
export function createFetchTransport(apiKey: string | null, options: ConnectionOptions): FetchTransport {
  const fetchFn = options.fetch ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new ConfigurationError('No fetch is available. Use Node 22 or newer, or pass one as options.fetch.');
  // Node 21+, Bun, Deno and edge runtimes all name themselves here, e.g. "Node.js/26".
  const runtime = typeof navigator === 'undefined' ? 'unknown-runtime' : navigator.userAgent;
  return new FetchTransport({
    apiKey,
    baseUrl: options.baseUrl ?? 'https://api.stablevoy.com',
    userAgent: `stablevoy-node/${VERSION} ${runtime}${options.userAgentSuffix === undefined ? '' : ` ${options.userAgentSuffix}`}`,
    retries: options.retries ?? new RetryPolicy(),
    fetch: fetchFn,
    sleep: options.sleep ?? realSleep,
    errors: new ErrorFactory(),
    timeoutSeconds: options.timeoutSeconds ?? 30,
  });
}
