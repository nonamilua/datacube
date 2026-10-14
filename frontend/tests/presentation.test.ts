import test from 'node:test';
import assert from 'node:assert/strict';
import { presentationScale, symbolDimensions, chartPixelRatio } from '../src/analytics/presentation.ts';

test('missing or invalid presentation scale preserves ordinary chart sizes', () => {
  for (const value of ['', 'invalid', '0', '-1']) assert.equal(presentationScale(value), 1);
  assert.equal(presentationScale(' 1.3 '), 1.3);
});

test('legend backing resolution changes without enlarging its CSS dimensions', () => {
  assert.deepEqual(symbolDimensions(8, 1.3, 1), {logical:10.4,backing:11});
  assert.deepEqual(symbolDimensions(8, 1.3, 2), {logical:10.4,backing:21});
  assert.deepEqual(symbolDimensions(8, 1, 2), {logical:8,backing:16});
});

test('chart resolution has a 2x minimum and preserves higher device ratios', () => {
  assert.equal(chartPixelRatio(1), 2);
  assert.equal(chartPixelRatio(1.5), 2);
  assert.equal(chartPixelRatio(2), 2);
  assert.equal(chartPixelRatio(3), 3);
});
