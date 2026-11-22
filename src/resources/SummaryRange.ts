import { SummaryPeriod, type InvoiceSummaryInput } from '../model/InvoiceSummary.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The query of a range of UTC days, as invoices.summary() and stores.checkoutFunnel() take it: a period, or both days.
 * Read loosely: a JavaScript caller can pass any mix, and it is refused here rather than by the API.
 */
export function summaryRangeQuery(input: InvoiceSummaryInput): Record<string, string> {
  const given = input as { readonly period?: unknown; readonly createdFrom?: unknown; readonly createdTo?: unknown };
  const query: Record<string, string> = {};
  const hasDays = given.createdFrom !== undefined || given.createdTo !== undefined;
  if ((given.period !== undefined) === hasDays) throw new RangeError('Pass either period or both createdFrom and createdTo');
  if (hasDays) {
    for (const name of ['createdFrom', 'createdTo'] as const) {
      const day = given[name];
      if (typeof day !== 'string' || !DAY.test(day)) throw new RangeError(`${name} must be a date as YYYY-MM-DD`);
      query[name] = day;
    }
  } else {
    const period = given.period;
    if (typeof period !== 'string' || !(Object.values(SummaryPeriod) as string[]).includes(period)) throw new RangeError(`period must be one of ${Object.values(SummaryPeriod).join(', ')}`);
    query['period'] = period;
  }
  return query;
}
