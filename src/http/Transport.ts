export type Query = Readonly<Record<string, string | number>>;

/** Sends one API call and returns the decoded JSON answer, or throws the matching error. The resources depend on this interface only. */
export interface Transport {
  get(path: string, query?: Query): Promise<unknown>;
  post(path: string, body: unknown, idempotencyKey?: string): Promise<unknown>;
  /** A call that answers 204 without a body. Deleting twice does no harm, so it is retried like a read. */
  delete(path: string): Promise<void>;
}
