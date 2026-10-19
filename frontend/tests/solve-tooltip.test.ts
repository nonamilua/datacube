import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { solveDateTitle } from '../src/analytics/solve-tooltip.ts';

test('tooltip uses original solve position after chart sampling or omitted times', () => {
  const timestamps = Array.from({length: 1200}, (_, i) => new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString());
  for (const position of [1, 5, 601, 1200]) {
    const date = new Date(timestamps[position - 1]);
    const expected = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    assert.equal(solveDateTitle(position, timestamps), expected);
  }
});

test('tooltip uses yyyy-mm-dd in the device timezone including day and year boundaries', () => {
  const moduleUrl = new URL('../src/analytics/solve-tooltip.ts', import.meta.url).href;
  for (const [timezone, expected] of [
    ['America/Sao_Paulo', ['2026-10-15', '2025-12-31']],
    ['UTC', ['2026-10-16', '2026-01-01']],
    ['Asia/Tokyo', ['2026-10-16', '2026-01-01']],
  ] as const) {
    const script = `import {solveDateTitle} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(['2026-10-16T01:30:00Z','2026-01-01T01:00:00Z'].map(timestamp => solveDateTitle(1,[timestamp]))));`;
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', script], {
      env: {...process.env, TZ:timezone}, encoding:'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), expected);
  }
});

test('missing and invalid timestamps do not display a misleading solve number', () => {
  for (const position of [undefined, 0, 2, 1.5]) assert.equal(solveDateTitle(position, ['invalid']), '');
  assert.equal(solveDateTitle(1, ['invalid']), '');
});
