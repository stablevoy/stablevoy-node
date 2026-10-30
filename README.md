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

## Verify webhooks

Stablevoy posts an event to your webhook URL when an invoice is paid, overpaid, underpaid, expired, paid late or put on hold. Check the signature before you trust it, using the signing secret shown when you set the webhook in the dashboard. Pass the raw body, exactly as received: a body parsed to JSON and serialised again no longer matches the signature.

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

Reads, and creates that carry an idempotency key, are retried on rate limits, maintenance and failed connections, at most twice and only for waits of up to 10 seconds. Anything longer reaches you with `retryAfterSeconds`, so a request never hangs.

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
