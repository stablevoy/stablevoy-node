import { RetryPolicy } from '../../src/http/RetryPolicy.js';
import { Stablevoy } from '../../src/Stablevoy.js';
import { FakeFetch } from './FakeFetch.js';

export interface TestClient {
  readonly client: Stablevoy;
  readonly http: FakeFetch;
  readonly slept: number[];
}

export function testClient(answers: (Response | Error)[], retries: RetryPolicy = new RetryPolicy()): TestClient {
  const http = new FakeFetch(...answers);
  const slept: number[] = [];
  const client = Stablevoy.create({
    apiKey: 'sk_test_key',
    fetch: http.fetch,
    retries,
    sleep: (seconds) => {
      slept.push(seconds);
      return Promise.resolve();
    },
  });
  return { client, http, slept };
}
