import { ApiError, type ApiErrorDetails, type ProblemIssue } from '../errors/ApiError.js';
import { AuthenticationError } from '../errors/AuthenticationError.js';
import { MaintenanceError } from '../errors/MaintenanceError.js';
import { NotFoundError } from '../errors/NotFoundError.js';
import { RateLimitedError } from '../errors/RateLimitedError.js';
import { ValidationError } from '../errors/ValidationError.js';

const stringOr = (value: unknown, fallback: string | null): string | null => (typeof value === 'string' ? value : fallback);

/** Turns an error answer of the API (an RFC 7807 problem document) into the matching error. */
export class ErrorFactory {
  fromProblem(status: number, body: string, retryAfterSeconds: number | null): ApiError {
    const problem = ErrorFactory.parse(body);
    const code = stringOr(problem['code'], null) ?? `http_${status}`;
    const details: ApiErrorDetails = {
      status,
      code,
      detail: stringOr(problem['detail'], null) ?? `The API answered HTTP ${status}`,
      type: stringOr(problem['type'], null),
      issues: ErrorFactory.issues(problem['issues']),
      retryAfterSeconds,
    };
    if (status === 401) return new AuthenticationError(details);
    if (status === 404) return new NotFoundError(details);
    if (status === 429) return new RateLimitedError(details);
    if (status === 503 && code === 'maintenance') return new MaintenanceError(details);
    if (status === 400 || status === 422) return new ValidationError(details);
    return new ApiError(details);
  }

  private static parse(body: string): Record<string, unknown> {
    try {
      const value: unknown = JSON.parse(body);
      return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private static issues(value: unknown): ProblemIssue[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((issue: unknown) => {
      if (typeof issue !== 'object' || issue === null) return [];
      const { path, message } = issue as Record<string, unknown>;
      return typeof path === 'string' && typeof message === 'string' ? [{ path, message }] : [];
    });
  }
}
