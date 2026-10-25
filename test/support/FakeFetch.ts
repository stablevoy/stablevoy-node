export interface SentRequest {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string | null;
  readonly redirect: string | undefined;
}

type Answer = Response | Error;

/** A fetch that answers from a queue (a response or an error per call) and records every request. */
export class FakeFetch {
  readonly requests: SentRequest[] = [];
  private readonly answers: Answer[];

  constructor(...answers: Answer[]) {
    this.answers = answers;
  }

  readonly fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    this.requests.push({ url: input instanceof Request ? input.url : input.toString(), method: init?.method ?? 'GET', headers, body: typeof init?.body === 'string' ? init.body : null, redirect: init?.redirect });
    const answer = this.answers.shift();
    if (answer === undefined) return Promise.reject(new Error('FakeFetch got more requests than answers'));
    // Anything but a Response is what fetch rejects with, including values that are no Error.
    return answer instanceof Response ? Promise.resolve(answer) : Promise.reject(answer);
  };

  last(): SentRequest {
    const last = this.requests.at(-1);
    if (last === undefined) throw new Error('No request was sent');
    return last;
  }
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', ...headers },
  });
}

export function problem(status: number, code: string, detail: string): Record<string, unknown> {
  return { type: `https://stablevoy.com/docs/api/errors/#error-${code}`, title: code, status, code, detail };
}
