import { StablevoyError } from './StablevoyError.js';

/** A webhook did not pass the signature check; the message says why. Answer such a request with HTTP 400. */
export class SignatureError extends StablevoyError {}
