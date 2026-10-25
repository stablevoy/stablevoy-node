/**
 * When to retry: on 429, 503 and a failed connection, at most maxRetries times, waiting what Retry-After asks (or 1, 2,
 * 4 seconds without it). A wait longer than maxWaitSeconds is not slept through: the error goes to the caller with
 * retryAfterSeconds, so a request never hangs for minutes during maintenance.
 */
export class RetryPolicy {
  static readonly none = new RetryPolicy(0, 0);

  constructor(
    readonly maxRetries = 2,
    readonly maxWaitSeconds = 10,
  ) {
    if (!Number.isInteger(maxRetries) || !Number.isInteger(maxWaitSeconds) || maxRetries < 0 || maxWaitSeconds < 0) {
      throw new RangeError('maxRetries and maxWaitSeconds must be whole numbers, not negative');
    }
  }

  /** Seconds to wait before the next attempt, or null when the call must not be retried. `attempt` counts from 1. */
  waitBefore(attempt: number, retryAfterSeconds: number | null): number | null {
    if (attempt > this.maxRetries) return null;
    const wait = retryAfterSeconds ?? 2 ** (attempt - 1);
    return wait <= this.maxWaitSeconds ? wait : null;
  }
}
