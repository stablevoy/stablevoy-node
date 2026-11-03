# Changelog

## Unreleased

- `Store.connectedPlatform`: the plugin connected to the store in one click, or null. `Network` carries `forwarderImplementation`, `explorerAddressUrl` and `rpcUrl`. `ApiError.limitUsdCents` gives the limit an amount was refused for. All three were sent by the API and dropped.
- `WebhookVerifier.verify()` refuses a body of bytes that is not UTF-8 with `SignatureError`, like every other bad webhook. Before, it threw a plain `TypeError`, which a `catch (SignatureError)` did not cover. A leading byte order mark is kept, so the checked text is exactly what arrived.
- `invoices.create()` checks the idempotency key before sending: 1 to 255 printable ASCII characters without spaces, as the API requires. Before, a key with a non-Latin-1 letter made fetch throw, and the call was retried and reported as "Cannot reach the Stablevoy API".
- Webhook events now carry `source` on their invoice, as the API answers do. Events recorded before 3 November 2026 have none, and still verify.
- One-click connect: `StablevoyConnect.create().exchange({ code, codeVerifier, site })` redeems a connect code for the shop's API key and webhook secret (`ConnectedStore`). It needs no API key and is never retried, since the code works once.
- `stores.revokeCurrentKey()` revokes the key of the client, for a shop that disconnects. It is retried like a read.
- `Transport` has `delete()`. Your own implementation of `Transport` needs it too. The connection options shared by both clients are exported as `ConnectionOptions`.
- Reads, and creates that carry an idempotency key, are also retried on the gateway errors 502, 504 and 520 to 524. nginx and Cloudflare answer with them for the few seconds the API restarts, so a call made then no longer fails at once. A 500 is still not retried.

## 1.2.0

- `Store` carries `networksWithoutPayout`: the enabled networks with no payout wallet for their family (EVM or Tron) on the account. Buyers are not offered them.
- `canAcceptPayments(store)` is false when no enabled network has a payout wallet, so every invoice would be refused. Check it before offering the payment method.
- `ApiError.PAYOUT_ADDRESS_NOT_SET` names the error code an invoice gets in that case.

## 1.1.0

- `invoices.list()` and `all()` take more filters: `source` (payment link, WooCommerce, Easy Digital Downloads, WHMCS, an API key made by hand, or not recorded; see `InvoiceSourceFilter`), `createdFrom` and `createdTo` (UTC days as YYYY-MM-DD, both ends included) and `search` (an invoice id or the start of the external reference).
- Invoices carry `source`: how the invoice was made and, for a key, which one, on `list()`, `all()`, `get()` and `create()`.

## 1.0.1

- Every attempt now times out, after 30 seconds by default (`timeoutSeconds` option, more than 0 and at most 600). Before, a server that never answered could keep a request waiting forever. The timeout also covers reading the body, so a server that sends headers and then stalls is cut off too. A timed-out or broken attempt is retried where a repeat is safe, and otherwise reported as a `TransportError`.
- Security review of the change: no key in timeout messages, out-of-range timeouts refused at construction (a huge value would overflow the timer and abort at once), a broken body is a `TransportError`, not a raw runtime error.

## 1.0.0

First release: invoices (create with an idempotency key, read, list and walk all pages), the store of the API key, limits, pricing and networks, typed errors with retries where a repeat is safe, and webhook signature verification with Web Crypto. No runtime dependencies; Node 22.12 or newer, Bun, Deno and edge runtimes.

Security: the base URL must be https (http only for localhost) and only a host, invoice ids must be UUIDs, and redirects are never followed, so the API key cannot leak or reach another path.
