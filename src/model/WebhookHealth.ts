import type { Fields } from './Fields.js';

/** Values of WebhookHealth.status. */
export const WEBHOOK_HEALTH_STATUS = {
  ACTIVE: 'active',
  FAILING: 'failing',
  PAUSED: 'paused',
} as const;

/**
 * State of the store's webhook endpoint. failing: at least 10 failed attempts and not paused yet, fix the endpoint before
 * pausesAt. paused: it failed for 24 hours with at least 10 failed attempts; new events wait (up to 30 days) until the
 * merchant resumes it in the dashboard. Faults of Stablevoy's own delivery service never count against it.
 */
export interface WebhookHealth {
  /** 'active', 'failing' or 'paused' (WEBHOOK_HEALTH_STATUS). */
  readonly status: string;
  /** First failed delivery since the last successful one; null while deliveries succeed. */
  readonly failingSince: Date | null;
  /** Failed deliveries since failingSince. */
  readonly failedAttempts: number;
  /** While it fails and is not paused: the earliest moment it is paused if it keeps failing; null otherwise. */
  readonly pausesAt: Date | null;
  readonly pausedAt: Date | null;
  /** The last error when it was paused. */
  readonly pauseReason: string | null;
}

export function parseWebhookHealth(f: Fields): WebhookHealth {
  return {
    status: f.string('status'),
    failingSince: f.nullableDate('failingSince'),
    failedAttempts: f.int('failedAttempts'),
    pausesAt: f.nullableDate('pausesAt'),
    pausedAt: f.nullableDate('pausedAt'),
    pauseReason: f.nullableString('pauseReason'),
  };
}
