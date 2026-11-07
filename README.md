# Stablevoy Node.js SDK

[![CI](https://github.com/stablevoy/stablevoy-node/actions/workflows/ci.yml/badge.svg)](https://github.com/stablevoy/stablevoy-node/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/stablevoy)](https://www.npmjs.com/package/stablevoy)

Node.js and TypeScript client for [Stablevoy](https://stablevoy.com), the non-custodial gateway for USDT and USDC payments. Customers pay on chain and the money goes straight to your own wallet: USDC and USDT on Base, Arbitrum, Optimism, Avalanche, Polygon and BNB Chain, and USDT (TRC20) on Tron with no fee.

The library creates invoices, reads them, and verifies the signed webhooks that tell your shop an order is paid. It has no dependencies and runs on Node 22.12 or newer, Bun, Deno and edge runtimes (Vercel, Cloudflare Workers). Types are included.

## Install

```bash
npm install stablevoy
```

## Create an invoice and send the buyer to pay

Create an API key for your store in the [Stablevoy dashboard](https://stablevoy.com/app/).

```ts
import { Stablevoy } from 'stablevoy';

const stablevoy = Stablevoy.create({ apiKey: process.env.STABLEVOY_API_KEY ?? '' });

const created = await stablevoy.invoices.create(
  {
    amountUsdCents: 2599, // $25.99
    externalReference: 'order-1042', // your order id, sent back in webhooks
    returnUrl: 'https://shop.example/orders/1042',
  },
  { idempotencyKey: 'order-1042' }, // a retry returns the same invoice, never a second one
);

// Send the buyer to created.checkoutUrl
```

The buyer has the store's payment window to pay, or the platform default when the store sets none (`stablevoy.platform.limits()` gives it and the bounds). Pass `expiresInMinutes` (15 to 10080, that is 7 days) to set it for one invoice, for example a day or more for an invoice you send by email.

## Cancel an unpaid invoice

When the order is cancelled before the buyer pays, cancel its invoice. The payment page then tells the buyer not to pay, and the webhook `invoice.cancelled` is sent. Cancelling it again returns it unchanged.

```ts
import { ApiError, InvoiceStatus } from 'stablevoy';

try {
  const invoice = await stablevoy.invoices.cancel(invoiceId);
  console.log(invoice.status === InvoiceStatus.CANCELLED);
} catch (error) {
  // A payment has already been seen on chain: fulfil or refund the order instead.
  if (error instanceof ApiError && error.code === ApiError.INVOICE_NOT_CANCELLABLE) console.log(error.detail);
  else throw error;
}
```

Money that still arrives after a cancel reaches your payout wallet as always and makes the invoice `paid_late`.

Read an invoice with `stablevoy.invoices.get(id)`, or walk them all:

```ts
for await (const invoice of stablevoy.invoices.all({ status: 'paid' })) {
  console.log(invoice.externalReference, invoice.amountUsdCents);
}
```

Narrow the list by source, created days (UTC, both ends included) or a search by invoice id or the start of your order reference. Each invoice says where it came from:

```ts
import { InvoiceSourceFilter } from 'stablevoy';

for await (const invoice of stablevoy.invoices.all({ source: InvoiceSourceFilter.PaymentLink, createdFrom: '2026-11-01', createdTo: '2026-11-30' })) {
  console.log(invoice.id, invoice.source?.kind);
}
```

A store can have up to 1,000 invoices awaiting payment at once; over that `invoices.create()` fails with `ApiError.OPEN_INVOICE_LIMIT_REACHED`, so cancel the ones you no longer need. `stablevoy.platform.limits()` gives this and the other per-store limits.

## Totals for a period

Count the invoices of a period and add up what they brought, instead of walking the list. Pass a ready-made period or your own UTC days; one request covers at most 92 days, so ask for a year in four parts.

```ts
import { SummaryPeriod } from 'stablevoy';

const week = await stablevoy.invoices.summary({ period: SummaryPeriod.LAST_7_DAYS });
console.log(week.invoiceCount, week.invoicesByStatus.paid, week.invoicedUsdCents, week.receivedUsdMicros);
for (const total of week.byNetwork) console.log(total.network, total.token, total.receivedUsdMicros);

const october = await stablevoy.invoices.summary({ createdFrom: '2026-10-01', createdTo: '2026-10-31' });
```

`invoicedUsdCents` leaves out cancelled and expired invoices. `receivedUsdMicros` (millionths of a dollar, as a string) counts the confirmed payments that passed sanctions screening.

## Unmatched transfers

On Tron the buyer pays your own wallet and the last digits of the amount pick the invoice. A transfer whose amount matched no invoice, usually from an exchange that took its fee out of it, is listed here. Attach it to an invoice in the Stablevoy dashboard; an API key can only read the list.

```ts
for (const transfer of await stablevoy.unmatchedTransfers.list()) {
  console.log(transfer.amountUsdMicros, transfer.fromAddress, transfer.explorerTxUrl + transfer.txHash.replace(/^0x/, ''));
}
```

The payout wallet belongs to your account, not to one store, so each transfer has `sharedWithStores`: 1 means it is certainly this store's, more means it may belong to any of that many of your stores.

## Check the store before going live

Invoices need a payout wallet for at least one network the store accepts; without one every invoice is refused with `payout_address_not_set`. An EVM payout wallet that is a smart contract wallet or an EIP-7702 delegation must be confirmed in the dashboard, and confirmed again when it changes; until then new invoices leave out the EVM networks, and a store with nothing else is refused with `payout_address_unacknowledged`. Read the store of the key to find out in advance, and tell the merchant about networks buyers will not be offered:

```ts
import { canAcceptPayments, evmPayoutNeedsReview } from 'stablevoy';

const store = await stablevoy.stores.current();
if (!canAcceptPayments(store)) {
  // Hide the payment method: set the payout address in the Stablevoy dashboard first.
}
if (store.networksWithoutPayout.length > 0) {
  // These enabled networks have no payout wallet, so buyers do not see them.
}
console.log(store.payoutAddresses); // { evm: '0x...', tron: null }: where payouts go, read only
if (evmPayoutNeedsReview(store)) {
  // The EVM payout wallet is not confirmed: store.evmNetworksBlocked are not offered until the merchant reviews it in the dashboard.
}
```

## Connect a shop in one click

A shop integration can get its API key and webhook secret without the merchant copying them: it sends the merchant to the Stablevoy dashboard with a PKCE challenge, gets a code back on its callback URL and redeems it. This call needs no API key, since the shop has none yet. The code works once, so the call is never retried.

```ts
import { StablevoyConnect } from 'stablevoy';

const connected = await StablevoyConnect.create().exchange({ code, codeVerifier, site: 'https://shop.example.com' });
// Store connected.apiKey and connected.webhookSecret; connected.storeName is the store the merchant chose.
```

When the merchant disconnects the shop, give the key up so it stops working at once. A key that is already revoked answers with `AuthenticationError`, which for a disconnect means the same:

```ts
await stablevoy.stores.revokeCurrentKey();
```

## Verify webhooks

Stablevoy posts an event to your webhook URL when an invoice is paid, overpaid, underpaid, expired, paid late or put on hold. One more, `invoice.payment_flagged`, comes when a later transfer to an invoice that is already paid is flagged by sanctions screening: the invoice keeps its paid status, so this event is not a new payment; the flagged transfer is in `event.data.payment`. Another, `store.payout_attention`, comes when the EVM payout wallet of the account becomes unconfirmed and again when it is fine: it carries no invoice, `event.data.payout` has the new `status`, the `blockedNetworks` and a `dashboardUrl`; read `stablevoy.stores.current()` again for the current state. Check the signature before you trust it, using the signing secret shown when you set the webhook in the dashboard. Pass the raw body, exactly as received: a body parsed to JSON and serialised again no longer matches the signature.

Express:

```ts
import express from 'express';
import { SignatureError, WebhookVerifier, isPaidStatus } from 'stablevoy';

const verifier = new WebhookVerifier(process.env.STABLEVOY_WEBHOOK_SECRET ?? '');
const app = express();

app.post('/stablevoy/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = await verifier.verify(req.body, req.get('X-Stablevoy-Signature'));
    if (event.invoice !== null && isPaidStatus(event.invoice.status)) {
      // Mark the order event.invoice.externalReference as paid. Use event.id to handle each event once.
    }
    res.sendStatus(200);
  } catch (error) {
    if (error instanceof SignatureError) return res.sendStatus(400);
    throw error;
  }
});
```

Next.js route handler:

```ts
import { WebhookVerifier } from 'stablevoy';

const verifier = new WebhookVerifier(process.env.STABLEVOY_WEBHOOK_SECRET ?? '');

export async function POST(request: Request) {
  const event = await verifier.verify(await request.text(), request.headers.get('X-Stablevoy-Signature'));
  // ...
  return new Response(null, { status: 200 });
}
```

## Errors and retries

Every error extends `StablevoyError`. API errors are `ApiError` with the HTTP `status`, a stable `code`, a readable `detail` and a link to the [error catalog](https://stablevoy.com/docs/api/errors/); the ones you may want to handle on their own are `AuthenticationError`, `ValidationError` (with `issues`), `NotFoundError`, `RateLimitedError` and `MaintenanceError`. `TransportError` means no answer at all.

Reads, and creates that carry an idempotency key, are retried on rate limits, maintenance, gateway errors while the API restarts (502, 504, 520 to 524) and failed connections, at most twice and only for waits of up to 10 seconds. Anything longer reaches you with `retryAfterSeconds`, so a request never hangs.

```ts
import { RetryPolicy, Stablevoy } from 'stablevoy';

const stablevoy = Stablevoy.create({ apiKey, retries: new RetryPolicy(3, 30) });
```

## Links

- [API reference](https://stablevoy.com/docs/api/)
- [Docs](https://stablevoy.com/docs/)
- [PHP SDK](https://github.com/stablevoy/stablevoy-php)
- [WooCommerce plugin](https://wordpress.org/plugins/stablevoy-for-woocommerce/)

## License

MIT
