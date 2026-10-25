import { StablevoyError } from './StablevoyError.js';

/** No answer from the API: the connection failed or timed out. */
export class TransportError extends StablevoyError {}
