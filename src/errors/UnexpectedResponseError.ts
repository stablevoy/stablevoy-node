import { StablevoyError } from './StablevoyError.js';

/** The API answered something this library cannot read: not JSON, or a field missing or of the wrong type. */
export class UnexpectedResponseError extends StablevoyError {}
