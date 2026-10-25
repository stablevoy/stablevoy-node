import { ApiError } from './ApiError.js';

/** The request was refused because of its content (HTTP 400 or 422); issues names the fields. */
export class ValidationError extends ApiError {}
