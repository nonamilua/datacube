import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, updateSolve } from '../src/api/api.ts';

test('penalty edits send only the selected penalty with the account guard', async () => {
  const originalFetch = globalThis.fetch;
  const solve = { id: 'owned-solve', duration_ms: 12345, started_at: '2026-10-05T12:00:00Z', penalty: '+2' };
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, '/api/solves/owned-solve');
      assert.equal(options?.method, 'PATCH');
      assert.equal((options?.headers as Record<string, string>)['X-Namicubes-Account'], '7');
      assert.equal((options?.headers as Record<string, string>)['X-Namicubes-Request'], '1');
      assert.deepEqual(JSON.parse(options?.body as string), { penalty: '+2' });
      return Response.json(solve);
    };
    assert.deepEqual(await updateSolve('owned-solve', 7, '+2'), solve);
    globalThis.fetch = async () => new Response('', { status: 404 });
    await assert.rejects(updateSolve('owned-solve', 7, 'DNF'), error => error instanceof ApiError && error.status === 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('custom edits send the literal value and can clear it', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const custom of ["';drop--", null]) {
      globalThis.fetch = async (_url, options) => {
        assert.deepEqual(JSON.parse(options?.body as string), {penalty:'OK', custom});
        return Response.json({custom});
      };
      assert.deepEqual(await updateSolve('owned-solve',7,'OK',custom), {custom});
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('edit failures distinguish rejected edits missing solves and connection failures', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status,message] of [[422,'edit rejected refresh and try again'],[404,'solve no longer exists'],[500,'could not save try again'],[401,'sign in again']] as const) {
      globalThis.fetch = async () => new Response('', {status});
      await assert.rejects(updateSolve('solve',1,'OK',null), error => error instanceof ApiError && error.status === status && error.message === message);
    }
  } finally { globalThis.fetch = originalFetch; }
});
