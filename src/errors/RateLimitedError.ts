import { ApiError } from './ApiError.js';

/** Too many requests (HTTP 429); retryAfterSeconds says when to try again. */
export class RateLimitedError extends ApiError {}
