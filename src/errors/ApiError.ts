import { StablevoyError } from './StablevoyError.js';

export interface ProblemIssue {
  readonly path: string;
  readonly message: string;
}

export interface ApiErrorDetails {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly type: string | null;
  readonly issues: readonly ProblemIssue[];
  readonly retryAfterSeconds: number | null;
  readonly limitUsdCents: number | null;
}

/**
 * The API answered with an error: an RFC 7807 problem document with a stable code, a readable detail and a link to the
 * code's entry in the error catalog (https://stablevoy.com/docs/api/errors/).
 */
export class ApiError extends StablevoyError {
  /** No enabled network of the store has a payout wallet; canAcceptPayments(store) tells it in advance. */
  static readonly PAYOUT_ADDRESS_NOT_SET = 'payout_address_not_set';
  /**
   * The EVM payout wallet is not confirmed in the dashboard (or changed since) and the store has no other network to offer;
   * evmPayoutNeedsReview(store) and canAcceptPayments(store) tell it in advance.
   */
  static readonly PAYOUT_ADDRESS_UNACKNOWLEDGED = 'payout_address_unacknowledged';

  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly type: string | null;
  /** The fields a validation error names. */
  readonly issues: readonly ProblemIssue[];
  /** From the Retry-After header of a 429 or 503, else null. */
  readonly retryAfterSeconds: number | null;
  /** For an amount refused by a limit (amount_below_minimum, amount_above_store_limit, ...): that limit in US cents. */
  readonly limitUsdCents: number | null;

  constructor(details: ApiErrorDetails) {
    super(`${details.detail} (HTTP ${details.status}, ${details.code})`);
    this.status = details.status;
    this.code = details.code;
    this.detail = details.detail;
    this.type = details.type;
    this.issues = details.issues;
    this.retryAfterSeconds = details.retryAfterSeconds;
    this.limitUsdCents = details.limitUsdCents;
  }
}
