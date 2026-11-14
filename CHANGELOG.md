# Changelog

## 1.10.0

- `Store.webhookHealth`: the state of the store's webhook endpoint, null when the store has no webhook URL. `status` is `active`, `failing` (at least 10 failed attempts, `pausesAt` says when it will be paused if it keeps failing) or `paused` (failed for 24 hours; new events wait up to 30 days), values in `WEBHOOK_HEALTH_STATUS`; also `failingSince`, `failedAttempts`, `pausedAt` and `pauseReason`. The merchant resumes a paused endpoint in the dashboard. Needs the API with paused endpoints (November 2026); an older answer without the field is refused as an unexpected response.
- `UnmatchedTransfer.sharedWithStores` is documented as it is counted: the active stores that offer the network and pay out to the same wallet.

## 1.9.0

- A store can pay out to its own address instead of the account one (set in the dashboard). `Store.payoutAddresses` are now the addresses this store's new invoices use; `Store.payoutSources` says for each family whether it is the store's own (`store`) or the account's (`account`), values in `PAYOUT_SOURCE`; `Store.accountPayoutAddresses` lists the account addresses. `evmPayoutStatus` and `evmNetworksBlocked` follow the EVM address the store uses.
- `Store.archivedAt`: when the store was archived, null while it is not.
- The webhook types `api_key.leaked` and `webhook_secret.leaked` are documented, and `store.payout_attention` carries `data.payout.source`.
- These need the API with store payout addresses (November 2026); an older answer without the new store fields is refused as an unexpected response.

## 1.8.0

- Stablevoy is moving to its own key formats: API keys `svk_live_...` / `svk_test_...` and webhook signing secrets `svwhsec_...`, each ending in a checksum. The SDK accepts them and the older `sk_live_` / `sk_test_` / `whsec_` in connect answers; older keys keep working.
- `checkApiKey(value)` and `checkWebhookSecret(value)` tell a pasted key apart: `ok`, `mistyped` (a new-format key whose checksum does not match, so a character is wrong or missing) or `not_a_key`.

## 1.7.0

- `invoices.summary({ period })` or `invoices.summary({ createdFrom, createdTo })`: totals of the invoices created in a range of UTC days, with the count per status, the invoiced amount and the money received, also per network and token. Periods are in `SummaryPeriod`; one request covers at most 92 days, and a longer range is refused with `ApiError.INVALID_INVOICE_FILTER`.
- `unmatchedTransfers.list()`: transfers to the payout wallet that matched no invoice, on the networks of the key's store, each with `sharedWithStores`. Read only; they are attached to an invoice in the dashboard.
- `Limits` carries `apiKeysPerStore` (`plugin`, `mcp`, `api`), `openInvoicesPerStore` and `invoicesPerMinutePerStore`. New `ApiError.OPEN_INVOICE_LIMIT_REACHED`. These need the API of 7 November 2026; an older answer without them is refused as an unexpected response.
- `Stablevoy` takes `UnmatchedTransfers` as a fourth constructor argument; `Stablevoy.create()` and `Stablevoy.fromTransport()` are unchanged.

## 1.6.0

- `invoices.cancel(id)` cancels an invoice that is still waiting for its first payment: the payment page tells the buyer not to pay and the webhook `invoice.cancelled` is sent. Cancelling it again returns it unchanged. Once a payment has been seen the API refuses with `ApiError.INVOICE_NOT_CANCELLABLE`; money that still arrives after a cancel makes the invoice `paid_late`. New status `InvoiceStatus.CANCELLED` and webhook type `invoice.cancelled`.
- `invoices.create()` takes `expiresInMinutes`: how long the buyer has to pay this invoice, 15 to 10080 minutes (7 days). Outside the bounds the API answers `ApiError.INVALID_INVOICE_LIFETIME`.
- `Store.invoiceLifetimeMinutes`: the store's payment window, null for the platform default. `Limits` carries `defaultInvoiceLifetimeMinutes`, `minInvoiceLifetimeMinutes` and `maxInvoiceLifetimeMinutes`. Both need the API of 6 November 2026; an older answer without them is refused as an unexpected response.

## 1.5.0

- `Store.payoutAddresses`: the account's payout wallets per network family (`evm`, `tron`), null when not set. Read only; they are changed in the dashboard with a wallet signature. Needs the API that sends the field (November 2026); an older answer without it is refused as an unexpected response.
- `StablevoyConnect.exchangeApp()` redeems the code an app on the merchant's own computer got from the dashboard (the Stablevoy MCP server's login) for one API key per approved store. Never retried, since the code works once.

## 1.4.0

- `Store` carries `evmPayoutStatus` (`plain`, `acknowledged`, `unacknowledged`, `unchecked`, or null without an EVM payout wallet, values in `EVM_PAYOUT_STATUS`) and `evmNetworksBlocked`: the enabled EVM networks new invoices leave out while the EVM payout wallet is not confirmed in the dashboard. `evmPayoutNeedsReview(store)` tells it.
- `canAcceptPayments(store)` also counts the blocked EVM networks, so it is false for a store whose only networks are blocked.
- `ApiError.PAYOUT_ADDRESS_UNACKNOWLEDGED` names the error code an invoice gets when the EVM payout wallet is not confirmed and the store has no other network.
- New webhook type `store.payout_attention`: the EVM payout wallet of the account became unconfirmed, or is fine again. It carries no invoice; the data has `store` and `payout` (status, blocked networks, dashboard link).

## 1.3.0

- New webhook type `invoice.payment_flagged`: a payment of an invoice that is already paid, overpaid or paid late was flagged by sanctions screening. The invoice keeps its status; the flagged payment is in the event data under `payment`.
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
