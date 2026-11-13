import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import type { StoredSolve } from '../src/api/api.ts';
import { activityBand, activityDays, activityLayout, countActivity } from '../src/analytics/activity.ts';
import { filterSolves } from '../src/analytics/filters.ts';

test('activity groups recorded solves on local calendar days around midnight', () => {
  const moduleUrl = new URL('../src/analytics/activity.ts', import.meta.url).href;
  const script = `import {countActivity} from ${JSON.stringify(moduleUrl)};
    const rows = [
      {started_at:'2026-11-11T02:59:59.999Z',penalty:'DNF'},
      {started_at:'2026-11-11T03:00:00.000Z',penalty:'OK'},
      {started_at:'2026-11-12T02:59:59.999Z',penalty:'DNF'},
      {started_at:'invalid',penalty:'OK'},
    ];
    console.log(JSON.stringify([...countActivity(rows)]));`;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', script], {
    env: {...process.env, TZ:'America/Sao_Paulo'}, encoding:'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [['2026-11-10',1],['2026-11-11',2]]);
});

test('overall activity includes events, cubes, tags and dates excluded by Overview filters', () => {
  const sample: StoredSolve = {id:'a', started_at:new Date(2026,10,10,12).toISOString(), duration_ms:1234, penalty:'OK', category_id:1, cube_id:2, custom:'pll'};
  const solves: StoredSolve[] = [sample,
    {...sample, id:'b', category_id:2, penalty:'DNF'},
    {...sample, id:'c', cube_id:3},
    {...sample, id:'d', custom:'oll'},
    {...sample, id:'e', started_at:new Date(2026,10,9,12).toISOString()},
  ];
  const filtered = filterSolves(solves,{event:'1',cube:'2',custom:'pll',start:'2026-11-10',end:'2026-11-10'});
  assert.deepEqual(filtered.map(solve => solve.id), ['a']);
  assert.deepEqual([...countActivity(solves)], [['2026-11-10',4],['2026-11-09',1]]);
});

test('activity rows run Monday through Sunday with future dates blank in the newest week', () => {
  const days = activityDays(new Map([['2026-11-09',4],['2026-11-10',5]]),2,new Date(2026,10,11,18));
  assert.equal(days.length,7);
  assert.deepEqual(days.map(row => row[0]?.date), ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']);
  assert.deepEqual(days.map(row => row[1]), [{date:'2026-11-09',count:4},{date:'2026-11-10',count:5},{date:'2026-11-11',count:0},null,null,null,null]);
  const narrow = activityDays(new Map(),1,new Date(2026,10,11,18));
  assert.deepEqual(narrow.map(row => row[0]?.date),days.map(row => row[1]?.date));
});

test('activity uses fixed intensity bands and fits only complete week columns', () => {
  assert.deepEqual([0,1,4,5,19,20,49,50,500].map(activityBand), [0,1,1,2,2,3,3,4,4]);
  assert.deepEqual(activityLayout(116,88,3),{cell:10,weeks:9});
  assert.deepEqual(activityLayout(113,88,3),{cell:10,weeks:8});
  assert.deepEqual(activityLayout(113,0,3),{cell:0,weeks:0});
});
