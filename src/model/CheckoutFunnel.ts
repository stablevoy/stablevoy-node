import type { Fields } from './Fields.js';

/** Where buyers stop on the payment page, for the store's invoices created in a range of UTC days. Counts of invoices, not of visits. */
export interface CheckoutFunnel {
  /** The first and last day counted, YYYY-MM-DD, also when a period was asked for. */
  readonly createdFrom: string;
  readonly createdTo: string;
  /** Invoices created in the range. */
  readonly invoices: number;
  /** How many of them reached each step of the payment page at least once, by step name (see CheckoutStep). */
  readonly steps: Readonly<Record<string, number>>;
  /** Opened invoices by where the page ran (see CheckoutSurface). */
  readonly openedOn: Readonly<Record<string, number>>;
  /** Invoices with at least one payment seen on chain. */
  readonly detected: number;
  /** Invoices paid in full, overpaid or paid late. */
  readonly paid: number;
}

export function parseCheckoutFunnel(f: Fields): CheckoutFunnel {
  const counts = (key: string): Record<string, number> => {
    const o = f.object(key);
    return Object.fromEntries(Object.keys(o.raw()).map((name) => [name, o.int(name)]));
  };
  return {
    createdFrom: f.string('createdFrom'),
    createdTo: f.string('createdTo'),
    invoices: f.int('invoices'),
    steps: counts('steps'),
    openedOn: counts('openedOn'),
    detected: f.int('detected'),
    paid: f.int('paid'),
  };
}
