import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleAverageIndexes, sampleTimeIndexes, timeSampleTarget } from '../src/analytics/time-sampling.ts';

test('Times sampling budget grows with the chart width', () => {
  assert.equal(timeSampleTarget(360), 600);
  assert.equal(timeSampleTarget(750), 900);
  assert.equal(timeSampleTarget(1000), 1200);
  assert.equal(timeSampleTarget(1600), 1200);
});

test('sampling preserves peaks, dips, bests and endpoints in original solve order', () => {
  const times = [null, 18, 40, 16, 19, 17, 39, 15, Infinity, 21];
  const best = [null, 18, null, 16, null, null, null, 15, null, null];
  assert.deepEqual(sampleTimeIndexes(times, best, 6), [0, 1, 2, 3, 6, 7, 9]);
  assert.deepEqual(sampleTimeIndexes(times, best, 600), times.map((_, index) => index));
});

test('large charts use their sample budget plus any additional best positions', () => {
  const times = Array.from({length:10_000}, (_, index) => 20 + index % 31);
  const best = times.map((time, index) => index === 0 || index === 4 ? time : null);
  for (const target of [600, 1200]) {
    const sample = sampleTimeIndexes(times, best, target);
    assert.equal(sample.length, target + 1);
    assert.equal(sample[0], 0);
    assert.ok(sample.includes(4));
    assert.equal(sample.at(-1), times.length - 1);
    assert.ok(sample.every((index, position) => !position || index > sample[position - 1]));
  }
});

test('rolling average samples are evenly spaced independently of raw-time peaks', () => {
  const times = [10, 24, 55, 11, 22, 23, 18, 17, 16, 15];
  const average = sampleAverageIndexes(times.length, 6);
  assert.deepEqual(average, [0, 2, 4, 5, 7, 9]);
  assert.notDeepEqual(average, sampleTimeIndexes(times, [], 6));
  assert.deepEqual(sampleAverageIndexes(3, 600), [0, 1, 2]);
  assert.deepEqual(sampleAverageIndexes(1, 600), [0]);
  assert.deepEqual(sampleAverageIndexes(0, 600), []);
});
