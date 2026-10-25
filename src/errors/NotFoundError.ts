import { ApiError } from './ApiError.js';

/** The invoice or store does not exist for this API key (HTTP 404). */
export class NotFoundError extends ApiError {}
