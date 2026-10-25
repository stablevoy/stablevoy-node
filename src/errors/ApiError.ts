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
}

/**
 * The API answered with an error: an RFC 7807 problem document with a stable code, a readable detail and a link to the
 * code's entry in the error catalog (https://stablevoy.com/docs/api/errors/).
 */
export class ApiError extends StablevoyError {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly type: string | null;
  /** The fields a validation error names. */
  readonly issues: readonly ProblemIssue[];
  /** From the Retry-After header of a 429 or 503, else null. */
  readonly retryAfterSeconds: number | null;

  constructor(details: ApiErrorDetails) {
    super(`${details.detail} (HTTP ${details.status}, ${details.code})`);
    this.status = details.status;
    this.code = details.code;
    this.detail = details.detail;
    this.type = details.type;
    this.issues = details.issues;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}
