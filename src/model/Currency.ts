import type { Fields } from './Fields.js';

/** One currency an invoice can be priced in, with its rates (GET /v1/currencies, GET /v1/stores/{id}/currencies). */
export interface Currency {
  /** ISO 4217 code. */
  readonly code: string;
  /** Decimal places of the smallest unit: 2 for EUR (amount 1999 is 19.99), 0 for JPY. */
  readonly exponent: number;
  /** The market rate stored now; null for USD and before the first refresh. usable false: too old to price an invoice. */
  readonly market: { readonly usdPerUnit: string; readonly source: string; readonly rateAt: Date; readonly usable: boolean } | null;
  /** The store's own fixed rate (store list only), used for every invoice of the store in this currency; null otherwise. */
  readonly store: { readonly usdPerUnit: string; readonly setAt: Date; readonly divergesFromMarket: boolean } | null;
  /** The rate an invoice created now would use; null: an invoice in this currency is refused right now (ApiError.EXCHANGE_RATE_UNAVAILABLE). */
  readonly effective: { readonly usdPerUnit: string; readonly source: string } | null;
}

export function parseCurrency(f: Fields): Currency {
  const market = f.nullableObject('market');
  const store = f.nullableObject('store');
  const effective = f.nullableObject('effective');
  return {
    code: f.string('code'),
    exponent: f.int('exponent'),
    market: market === null ? null : { usdPerUnit: market.string('usdPerUnit'), source: market.string('source'), rateAt: market.date('rateAt'), usable: market.bool('usable') },
    store: store === null ? null : { usdPerUnit: store.string('usdPerUnit'), setAt: store.date('setAt'), divergesFromMarket: store.bool('divergesFromMarket') },
    effective: effective === null ? null : { usdPerUnit: effective.string('usdPerUnit'), source: effective.string('source') },
  };
}
