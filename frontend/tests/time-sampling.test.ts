import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evenlySpacedIndexes } from '../src/analytics/time-sampling.ts';

test('large charts evenly sample original solve positions at either budget', () => {
  const count = 10_000;
  for (const target of [600, 1200]) {
    const sample = evenlySpacedIndexes(count, target);
    const step = (count - 1) / (target - 1);
    assert.equal(sample.length, target);
    assert.equal(sample[0], 0);
    assert.equal(sample.at(-1), count - 1);
    assert.ok(sample.every((index, position) => Math.abs(index - position * step) <= .5));
  }
});

test('sampling retains both endpoints and keeps every position below the budget', () => {
  assert.deepEqual(evenlySpacedIndexes(10, 6), [0, 2, 4, 5, 7, 9]);
  assert.deepEqual(evenlySpacedIndexes(3, 600), [0, 1, 2]);
  assert.deepEqual(evenlySpacedIndexes(1, 600), [0]);
  assert.deepEqual(evenlySpacedIndexes(0, 600), []);
});
