import type { Fields } from './Fields.js';

export interface CheckoutTrailStep {
  /** See CheckoutStep. */
  readonly step: string;
  /** When the step was first reached. */
  readonly at: Date;
  /** Where the page ran (see CheckoutSurface), only on opened; null otherwise. */
  readonly surface: string | null;
}

/** The steps one invoice went through, oldest first: created, what the payment page reported, the first payment seen and the outcome. */
export interface CheckoutTrail {
  readonly invoiceId: string;
  readonly steps: readonly CheckoutTrailStep[];
}

export function parseCheckoutTrail(f: Fields): CheckoutTrail {
  return {
    invoiceId: f.string('invoiceId'),
    steps: f.objects('steps', (s) => ({ step: s.string('step'), at: s.date('at'), surface: s.nullableString('surface') })),
  };
}
