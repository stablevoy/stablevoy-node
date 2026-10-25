/** Every error this library throws extends it, so one `instanceof StablevoyError` covers them all. */
export class StablevoyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
