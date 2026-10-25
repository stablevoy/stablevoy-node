# Changelog

## 1.0.0

First release: invoices (create with an idempotency key, read, list and walk all pages), the store of the API key, limits, pricing and networks, typed errors with retries where a repeat is safe, and webhook signature verification with Web Crypto. No runtime dependencies; Node 22.12 or newer, Bun, Deno and edge runtimes.

Security: the base URL must be https (http only for localhost) and only a host, invoice ids must be UUIDs, and redirects are never followed, so the API key cannot leak or reach another path.
