import { ApiError } from './ApiError.js';

/** Stablevoy is under maintenance (HTTP 503, code maintenance). Nothing was changed; retry after retryAfterSeconds. */
export class MaintenanceError extends ApiError {}
