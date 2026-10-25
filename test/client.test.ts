import { describe, expect, it } from 'vitest';
import { ConfigurationError } from '../src/errors/ConfigurationError.js';
import { TransportError } from '../src/errors/TransportError.js';
import { Stablevoy } from '../src/Stablevoy.js';
import { VERSION } from '../src/version.js';
import { realSleep } from '../src/http/Sleep.js';
import { readFileSync } from 'node:fs';
import { FakeFetch, json } from './support/FakeFetch.js';

const limits = { minInvoiceUsdCents: 500, maxInvoiceUsdCents: 100000 };

describe('Stablevoy client', () => {
  it('talks to the configured host and names the integration', async () => {
    const http = new FakeFetch(json(200, limits));
    await Stablevoy.create({ apiKey: 'sk_test_key', baseUrl: 'http://localhost:8080/', fetch: http.fetch, userAgentSuffix: 'my-shop/2.1' }).platform.limits();
    expect(http.last().url).toBe('http://localhost:8080/v1/limits');
    expect(http.last().headers['User-Agent']).toMatch(/ my-shop\/2\.1$/);
  });

  it.each([
    ['plain http to a real host would send the key unencrypted', 'http://api.stablevoy.com'],
    ['credentials in the URL', 'https://user:secret@api.stablevoy.com'],
    ['a path', 'https://api.stablevoy.com/v1'],
    ['a query', 'https://api.stablevoy.com?x=1'],
    ['a fragment', 'https://api.stablevoy.com#x'],
    ['no scheme', 'api.stablevoy.com'],
    ['another scheme', 'ftp://api.stablevoy.com'],
    ['a malformed URL', 'https://'],
  ])('refuses a base URL with %s', (_what, baseUrl) => {
    expect(() => Stablevoy.create({ apiKey: 'sk_test_key', baseUrl, fetch: new FakeFetch().fetch })).toThrow(ConfigurationError);
  });

  it('allows https with a port and plain http only for local development', async () => {
    for (const baseUrl of ['https://api.stablevoy.com:8443', 'http://localhost:8080', 'http://127.0.0.1:18700', 'http://[::1]:8080']) {
      const http = new FakeFetch(json(200, limits));
      await Stablevoy.create({ apiKey: 'sk_test_key', baseUrl, fetch: http.fetch }).platform.limits();
      expect(http.last().url).toBe(`${baseUrl}/v1/limits`);
    }
  });

  it('never follows a redirect with the key', async () => {
    const http = new FakeFetch(json(200, limits));
    await Stablevoy.create({ apiKey: 'sk_test_key', fetch: http.fetch }).platform.limits();
    expect(http.last().redirect).toBe('error');
  });

  it('gives every attempt a timeout, 30 seconds by default', async () => {
    const http = new FakeFetch(json(200, limits));
    await Stablevoy.create({ apiKey: 'sk_test_key', fetch: http.fetch }).platform.limits();
    expect(http.last().signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts an attempt the server never answers, retries where safe, then reports it', async () => {
    const hanging = (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => { reject(init.signal?.reason as Error); }));
    const slept: number[] = [];
    const client = Stablevoy.create({ apiKey: 'sk_test_key', fetch: hanging, timeoutSeconds: 0.02, sleep: (s) => { slept.push(s); return Promise.resolve(); } });
    await expect(client.platform.limits()).rejects.toThrow(/Cannot reach the Stablevoy API: .*(timed out|aborted|timeout)/i);
    expect(slept).toEqual([1, 2]);
  });

  it('aborts a body that stalls after the headers, retries where safe, then reports it', async () => {
    const stalling = (_input: string | URL | Request, init?: RequestInit): Promise<Response> =>
      Promise.resolve(new Response(new ReadableStream({ start: (controller) => { init?.signal?.addEventListener('abort', () => { controller.error(init.signal?.reason); }); } }), { status: 200 }));
    const slept: number[] = [];
    const client = Stablevoy.create({ apiKey: 'sk_test_key', fetch: stalling, timeoutSeconds: 0.02, sleep: (s) => { slept.push(s); return Promise.resolve(); } });
    await expect(client.platform.limits()).rejects.toThrow(TransportError);
    expect(slept).toEqual([1, 2]);
  });

  it.each([0, -1, Number.NaN, 601, Number.POSITIVE_INFINITY])('refuses the timeout %s', (timeoutSeconds) => {
    expect(() => Stablevoy.create({ apiKey: 'sk_test_key', fetch: new FakeFetch().fetch, timeoutSeconds })).toThrow(ConfigurationError);
  });

  it('refuses an empty key', () => {
    expect(() => Stablevoy.create({ apiKey: ' ', fetch: new FakeFetch().fetch })).toThrow('The API key is empty');
  });

  it('uses the global fetch by default and fails loudly without one', () => {
    expect(Stablevoy.create({ apiKey: 'sk_test_key' }).invoices).toBeDefined();
    const original = globalThis.fetch;
    try {
      Object.defineProperty(globalThis, 'fetch', { value: undefined, configurable: true, writable: true });
      expect(() => Stablevoy.create({ apiKey: 'sk_test_key' })).toThrow(ConfigurationError);
    } finally {
      Object.defineProperty(globalThis, 'fetch', { value: original, configurable: true, writable: true });
    }
  });

  it('names an unknown runtime when there is no navigator', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const http = new FakeFetch(json(200, limits));
    try {
      Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
      await Stablevoy.create({ apiKey: 'sk_test_key', fetch: http.fetch }).platform.limits();
    } finally {
      if (original !== undefined) Object.defineProperty(globalThis, 'navigator', original);
    }
    expect(http.last().headers['User-Agent']).toBe('stablevoy-node/1.0.1 unknown-runtime');
  });

  it('waits for real between retries by default', async () => {
    const started = Date.now();
    await realSleep(0.01);
    expect(Date.now() - started).toBeGreaterThanOrEqual(9);
  });

  it('states the version of package.json', () => {
    expect(VERSION).toBe((JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version);
  });
});
