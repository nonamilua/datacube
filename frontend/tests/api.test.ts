import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pendingSolves, queueSolve, savePendingSolves } from '../src/api/api.ts';

test('failed saves survive reload and retry with the same id', async () => {
  const storage = new Map<string, string>();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  try {
    queueSolve({ duration_ms: 12345, started_at: '2026-10-04T15:00:00Z' });
    const queued = pendingSolves()[0];
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(savePendingSolves());
    assert.deepEqual(pendingSolves(), [queued]);
    globalThis.fetch = async (_url, options) => {
      assert.deepEqual(JSON.parse(options?.body as string), queued);
      // A new solve arrives while the first save is in progress.
      queueSolve({ duration_ms: 20000, started_at: '2026-10-04T15:01:00Z' });
      return new Response('{}', { status: 201 });
    };
    await savePendingSolves();
    assert.equal(pendingSolves().length, 1);
    assert.equal(pendingSolves()[0].duration_ms, 20000);
    globalThis.fetch = async () => new Response('{}', { status: 201 });
    await savePendingSolves();
    assert.deepEqual(pendingSolves(), []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
