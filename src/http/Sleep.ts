/** Waits between retries; tests pass a recording one. */
export type Sleep = (seconds: number) => Promise<void>;

export const realSleep: Sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));
