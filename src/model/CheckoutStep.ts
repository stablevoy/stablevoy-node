/**
 * The steps of the payment page funnel and trail. Responses carry them as plain strings, so a step added to the API later
 * reaches you as its name instead of breaking this library; compare with these constants.
 */
export const CheckoutStep = {
  /** The invoice was created (trail only). */
  CREATED: 'created',
  /** The buyer opened the payment page or the widget. */
  OPENED: 'opened',
  /** The buyer picked another network or token. */
  OPTION_CHANGED: 'option_changed',
  /** The buyer copied the amount or the address. */
  DETAILS_COPIED: 'details_copied',
  WALLET_STARTED: 'wallet_started',
  /** The buyer cancelled the payment in the wallet. */
  WALLET_REJECTED: 'wallet_rejected',
  WALLET_FAILED: 'wallet_failed',
  /** The wallet sent the transaction. */
  TX_SENT: 'tx_sent',
  /** The first payment was seen on chain (trail only). */
  DETECTED: 'detected',
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

/** Where the payment page ran when it was opened: the hosted page or the widget on the store's site. */
export const CheckoutSurface = {
  PAGE: 'page',
  WIDGET: 'widget',
} as const;
