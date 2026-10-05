import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, deleteSolve } from '../src/api/api.ts';

test('deletion sends the account guard and surfaces failed requests', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/solves/solve-id');
      assert.equal(options?.method, 'DELETE');
      const headers = options?.headers as Record<string, string>;
      assert.equal(headers['X-Namicubes-Request'], '1');
      assert.equal(headers['X-Namicubes-Account'], '3');
      return new Response(null, { status: 204 });
    };
    await deleteSolve('solve-id', 3);
    for (const status of [401, 403, 404, 409, 500]) {
      globalThis.fetch = async () => new Response(null, { status });
      await assert.rejects(deleteSolve('solve-id', 3), error => error instanceof ApiError && error.status === status);
    }
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(deleteSolve('solve-id', 3), /offline/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
