import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pendingSolves, queueSolve, renameQueuedCubes, savePendingSolves } from '../src/api/api.ts';

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
    const labels = { category_id: 2, cube_name: 'gan 12', scramble:"R U' F2" };
    queueSolve({ duration_ms: 12345, started_at: '2026-10-04T15:00:00Z' }, 1, labels);
    const queued = pendingSolves(1)[0];
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(savePendingSolves(1));
    assert.deepEqual(pendingSolves(1), [queued]);
    assert.deepEqual(pendingSolves(2), []);
    renameQueuedCubes(1, {'gan 12':'gan12'});
    assert.deepEqual(pendingSolves(1), [{...queued,cube_name:'gan12'}]);
    renameQueuedCubes(1, {'gan12':'gan 12'});
    globalThis.fetch = async (_url, options) => {
      assert.deepEqual(JSON.parse(options?.body as string), queued);
      assert.equal((options?.headers as Record<string, string>)['X-Namicubes-Account'], '1');
      // A new solve arrives while the first save is in progress.
      queueSolve({ duration_ms: 20000, started_at: '2026-10-04T15:01:00Z' }, 1, labels);
      return new Response('{}', { status: 201 });
    };
    await savePendingSolves(1);
    assert.equal(pendingSolves(1).length, 1);
    assert.equal(pendingSolves(1)[0].duration_ms, 20000);
    globalThis.fetch = async () => new Response('{}', { status: 201 });
    await savePendingSolves(1);
    assert.deepEqual(pendingSolves(1), []);
    // Pre-feature queues lack the optional field and must be sent unchanged.
    const legacy = {...queued};
    delete legacy.scramble;
    storage.set('namicubes pending solves 1', JSON.stringify([legacy]));
    globalThis.fetch = async (_url, options) => {
      assert.deepEqual(JSON.parse(options?.body as string),legacy);
      return new Response('{}',{status:201});
    };
    await savePendingSolves(1);
    assert.deepEqual(pendingSolves(1),[]);
    const disabled = queueSolve({duration_ms:1000, started_at:'2026-10-06T15:00:00Z'}, 1, {...labels, scramble:null});
    assert.equal(disabled.scramble,null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
