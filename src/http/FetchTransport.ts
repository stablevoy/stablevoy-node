import type { ApiError } from '../errors/ApiError.js';
import { ConfigurationError } from '../errors/ConfigurationError.js';
import { TransportError } from '../errors/TransportError.js';
import { UnexpectedResponseError } from '../errors/UnexpectedResponseError.js';
import type { ErrorFactory } from './ErrorFactory.js';
import type { RetryPolicy } from './RetryPolicy.js';
import type { Sleep } from './Sleep.js';
import type { Query, Transport } from './Transport.js';

export interface FetchTransportOptions {
  /** null only for the one call made before a shop has a key, the connect exchange: then no Authorization is sent. */
  readonly apiKey: string | null;
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly retries: RetryPolicy;
  readonly fetch: typeof fetch;
  readonly sleep: Sleep;
  readonly errors: ErrorFactory;
  /** Each attempt is aborted after this many seconds, so a server that never answers cannot hang the caller. */
  readonly timeoutSeconds: number;
}

/**
 * The API over fetch: Bearer API key, JSON in and out, errors as exceptions, and retries only where a repeat cannot do
 * harm (reads, deletes, and creates that carry an Idempotency-Key).
 */
export class FetchTransport implements Transport {
  private readonly options: FetchTransportOptions;
  private readonly baseUrl: string;

  constructor(options: FetchTransportOptions) {
    if (options.apiKey !== null && options.apiKey.trim() === '') throw new ConfigurationError('The API key is empty. Create one in the Stablevoy dashboard.');
    if (!(options.timeoutSeconds > 0 && options.timeoutSeconds <= 600)) throw new ConfigurationError(`timeoutSeconds must be more than 0 and at most 600; got ${String(options.timeoutSeconds)}`);
    this.options = options;
    this.baseUrl = FetchTransport.checkedBaseUrl(options.baseUrl);
  }

  get(path: string, query: Query = {}): Promise<unknown> {
    const search = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
    return this.send(`${this.baseUrl}${path}${search === '' ? '' : `?${search}`}`, { method: 'GET' }, true).then((text) => FetchTransport.decode(text));
  }
  async delete(path: string): Promise<void> {
    await this.send(`${this.baseUrl}${path}`, { method: 'DELETE' }, true);
  }

  post(path: string, body: unknown, idempotencyKey?: string): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;
    return this.send(`${this.baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }, idempotencyKey !== undefined).then((text) => FetchTransport.decode(text));
  }

  /** The body of the first successful answer, or the error of the last failed attempt. */
  private async send(url: string, init: { method: string; headers?: Record<string, string>; body?: string }, retryable: boolean): Promise<string> {
    const headers: Record<string, string> = { ...init.headers, Accept: 'application/json', 'User-Agent': this.options.userAgent };
    if (this.options.apiKey !== null) headers['Authorization'] = `Bearer ${this.options.apiKey}`;
    // The API never redirects; following one would carry the key wherever it points.
    const request: RequestInit = { ...init, redirect: 'error', headers };
    for (let attempt = 1; ; attempt++) {
      let response: Response;
      let text: string;
      try {
        // The signal also covers reading the body, so a server that sends headers and then stalls is cut off too.
        response = await this.options.fetch(url, { ...request, signal: AbortSignal.timeout(this.options.timeoutSeconds * 1000) });
        text = await response.text();
      } catch (error) {
        const wait = retryable ? this.options.retries.waitBefore(attempt, null) : null;
        if (wait === null) throw new TransportError(`Cannot reach the Stablevoy API: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        await this.options.sleep(wait);
        continue;
      }
      if (response.ok) return text;
      const apiError = this.options.errors.fromProblem(response.status, text, FetchTransport.retryAfter(response));
      const wait = retryable && FetchTransport.isRetryable(apiError) ? this.options.retries.waitBefore(attempt, apiError.retryAfterSeconds) : null;
      if (wait === null) throw apiError;
      await this.options.sleep(wait);
    }
  }

  /**
   * Only a scheme, a host and an optional port. The API key travels in every request, so plain http is refused except
   * for a local development server, and so are credentials, paths, queries and fragments in the URL.
   */
  private static checkedBaseUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/+$/, '');
    const refuse = (): never => {
      throw new ConfigurationError(`The base URL must be https and only a host, like https://api.stablevoy.com (http only for localhost); got ${baseUrl}`);
    };
    if (!URL.canParse(trimmed)) return refuse();
    const url = new URL(trimmed);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const extra = url.username !== '' || url.password !== '' || url.pathname !== '/' || url.search !== '' || url.hash !== '' || !trimmed.startsWith(`${url.protocol}//`);
    if (extra || !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) return refuse();
    return url.origin;
  }

  /**
   * 429 and 503, and the gateway errors nginx and Cloudflare answer while the API restarts (502, 504, 520 to 524). A 500 is
   * a fault of the API, not a moment: repeating it would not help.
   */
  private static isRetryable(error: ApiError): boolean {
    return [429, 502, 503, 504, 520, 521, 522, 523, 524].includes(error.status);
  }

  private static decode(text: string): unknown {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (error) {
      throw new UnexpectedResponseError('The API answered with a body that is not JSON', { cause: error });
    }
    if (typeof value !== 'object' || value === null) throw new UnexpectedResponseError('The API answered with JSON that is not an object or a list');
    return value;
  }

  private static retryAfter(response: Response): number | null {
    const value = response.headers.get('Retry-After')?.trim() ?? '';
    return /^\d+$/.test(value) ? Number(value) : null;
  }
}
