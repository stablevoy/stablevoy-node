import { ApiError } from './ApiError.js';

/** The API key is missing, invalid or revoked (HTTP 401). */
export class AuthenticationError extends ApiError {}
