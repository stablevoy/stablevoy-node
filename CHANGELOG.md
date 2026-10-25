# Changelog

## 1.0.1

- Every attempt now times out, after 30 seconds by default (`timeoutSeconds` option, more than 0 and at most 600). Before, a server that never answered could keep a request waiting forever. The timeout also covers reading the body, so a server that sends headers and then stalls is cut off too. A timed-out or broken attempt is retried where a repeat is safe, and otherwise reported as a `TransportError`.
- Security review of the change: no key in timeout messages, out-of-range timeouts refused at construction (a huge value would overflow the timer and abort at once), a broken body is a `TransportError`, not a raw runtime error.

## 1.0.0

First release: invoices (create with an idempotency key, read, list and walk all pages), the store of the API key, limits, pricing and networks, typed errors with retries where a repeat is safe, and webhook signature verification with Web Crypto. No runtime dependencies; Node 22.12 or newer, Bun, Deno and edge runtimes.

Security: the base URL must be https (http only for localhost) and only a host, invoice ids must be UUIDs, and redirects are never followed, so the API key cannot leak or reach another path.
