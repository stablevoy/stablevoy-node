export interface Clock {
  /** Seconds since the Unix epoch. */
  now(): number;
}

export const systemClock: Clock = { now: () => Math.floor(Date.now() / 1000) };
