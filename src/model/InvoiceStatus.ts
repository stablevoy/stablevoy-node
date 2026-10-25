/**
 * Invoice statuses. An invoice's status is a plain string, so a status added by a newer API version is kept, not lost;
 * compare it with these values.
 */
export const InvoiceStatus = {
  AWAITING_PAYMENT: 'awaiting_payment',
  CONFIRMING: 'confirming',
  PAID: 'paid',
  OVERPAID: 'overpaid',
  UNDERPAID: 'underpaid',
  EXPIRED: 'expired',
  PAID_LATE: 'paid_late',
  ON_HOLD: 'on_hold',
} as const;

/** The order can be fulfilled: the full amount, or more, has arrived and is confirmed. */
export function isPaidStatus(status: string): boolean {
  return status === InvoiceStatus.PAID || status === InvoiceStatus.OVERPAID || status === InvoiceStatus.PAID_LATE;
}
