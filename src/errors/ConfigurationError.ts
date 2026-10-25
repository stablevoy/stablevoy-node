import { StablevoyError } from './StablevoyError.js';

/** The client cannot be built as asked, for example without an API key or without fetch. */
export class ConfigurationError extends StablevoyError {}
