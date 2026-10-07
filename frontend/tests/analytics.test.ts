import assert from 'node:assert/strict';
import { test } from 'node:test';
import { average, bestProgression, effectiveTime, histogram, statistics } from '../src/analytics/statistics.ts';
import { filterSolves, localDate, presetDates } from '../src/analytics/filters.ts';
import { solveCountTicks } from '../src/analytics/axes.ts';
import { comparisonLabels } from '../src/analytics/comparisons.ts';

test('solve count ticks favor round intervals as the count grows', () => {
  assert.deepEqual(solveCountTicks(0), []);
  assert.deepEqual(solveCountTicks(3), [1, 2, 3]);
  assert.deepEqual(solveCountTicks(25), [5, 10, 15, 20, 25]);
  assert.deepEqual(solveCountTicks(50), [10, 20, 30, 40, 50]);
  assert.deepEqual(solveCountTicks(49), [10, 20, 30, 40]);
  assert.deepEqual(solveCountTicks(500), [100, 200, 300, 400, 500]);
  assert.deepEqual(solveCountTicks(1000), [200, 400, 600, 800, 1000]);
});

test('averages trim extremes and handle one or multiple dnfs', () => {
  assert.equal(average([10000, 11000, 12000, 13000, 30000]), 12000);
  assert.equal(average([10000, 11000, 12000, 13000, Infinity]), 12000);
  assert.equal(average([10000, 11000, 12000, Infinity, Infinity]), Infinity);
  assert.equal(effectiveTime({ duration_ms: 10000, penalty: '+2' }), 12000);
});

test('statistics use all solves and exclude dnf from basic measurements', () => {
  const solves = Array.from({length: 12}, (_, index) => ({ duration_ms: (index + 1) * 1000 }));
  const result = statistics(solves);
  assert.equal(result.count, 12);
  assert.equal(result.mean, 6500);
  assert.equal(result.median, 6500);
  assert.equal(result.best, 1000);
  assert.equal(result.ao5, 10000);
  assert.equal(result.ao12, 6500);
  assert.equal(result.bestAo5, 3000);
  assert.equal(result.bestAo12, 6500);
  assert.ok(Math.abs(result.deviation! - Math.sqrt(143 / 12) * 1000) < 0.001);
  const failed = statistics([{duration_ms: 1, penalty: 'DNF'}, {duration_ms: 10000, penalty: '+2'}]);
  assert.equal(failed.count, 2);
  assert.equal(failed.mean, 12000);
  assert.equal(failed.ao5, null);
  assert.equal(statistics([]).mean, null);
  assert.equal(statistics([{duration_ms:1, penalty:'DNF'}]).best, null);
});

test('histograms include every finite time even on bin boundaries', () => {
  const result = histogram([1000, 2000, 3000, Infinity]);
  assert.equal(result.counts.reduce((sum, count) => sum + count, 0), 3);
  assert.deepEqual(histogram([1000, 1000]).counts, [2]);
  assert.deepEqual(histogram([Infinity]).counts, []);
});

test('best progression keeps only new finite records in chronological order', () => {
  assert.deepEqual(bestProgression([Infinity, 12000, 13000, 10000, 10000, 9000, Infinity]), [null, 12000, null, 10000, null, 9000, null]);
  assert.deepEqual(statistics([{duration_ms:10000,penalty:'+2'}, {duration_ms:11000}]).bestProgression, [12000,11000]);
});

test('histograms cap bars at seven and report excluded extreme times', () => {
  const times = [...Array(20).fill(10000), 100000, Infinity];
  const result = histogram(times);
  assert.equal(result.omitted, 1);
  assert.equal(result.counts.reduce((sum, count) => sum + count, 0), 20);
  assert.equal(statistics(times.map(duration_ms => ({duration_ms}))).count, 22);
  const varied = histogram(Array.from({length:100}, (_, index) => 1000 + index * 100));
  assert.ok(varied.counts.length <= 7);
  assert.equal(varied.counts.reduce((sum, count) => sum + count, 0) + varied.omitted, 100);
  assert.ok(varied.labels.every(label => label.includes('–')));
  const intervals = varied.labels.map(label => label.split('–').map(Number));
  for (let index = 1; index < intervals.length; index++) assert.equal(intervals[index][0], intervals[index-1][1]);
  assert.ok(intervals[0][0] <= 1);
  assert.ok(intervals.at(-1)![1] > 10.9);
});

test('histogram granularity adapts to sample size and variation', () => {
  for (const size of [1, 2, 4, 9, 20, 49, 50, 100, 1000]) {
    const times = Array.from({length:size}, (_, index) => 10000 + index * 100);
    const result = histogram(times);
    const cap = size >= 50 ? 7 : Math.min(6, Math.ceil(Math.sqrt(size)));
    assert.ok(result.counts.length <= cap);
    assert.equal(result.counts.reduce((sum, count) => sum + count, 0), size);
  }
  assert.equal(histogram(Array(100).fill(10000)).counts.length, 1);
  assert.ok(histogram(Array.from({length:1000}, (_, index) => 10000 + index * 100)).counts.length > histogram([10000, 10100, 10200]).counts.length);
});

test('histogram intervals stay nonnegative and use distinct one decimal boundaries', () => {
  for (const times of [[10, 10000], [0, 1, 20, 90], [1], [1999, 2000, 2001]]) {
    const result = histogram(times);
    assert.equal(result.counts.reduce((sum, count) => sum + count, 0), times.length);
    assert.equal(result.boundaries.length, result.counts.length + 1);
    assert.deepEqual(result.labels, result.counts.map((_, index) => `${result.boundaries[index].toFixed(1)}–${result.boundaries[index + 1].toFixed(1)}`));
    const intervals = result.labels.map(label => {
      assert.match(label, /^\d+\.\d–\d+\.\d$/);
      return label.split('–').map(Number);
    });
    assert.ok(intervals[0][0] >= 0);
    assert.ok(intervals[0][0] <= Math.min(...times) / 1000);
    assert.ok(intervals.at(-1)![1] > Math.max(...times) / 1000);
    for (let index = 0; index < intervals.length; index++) {
      assert.ok(intervals[index][0] < intervals[index][1]);
      if (index) assert.equal(intervals[index][0], intervals[index - 1][1]);
    }
  }
});

test('date filtering uses inclusive local calendar dates plus event cube and custom', () => {
  const midnight = new Date(2026, 9, 5);
  const time = midnight.getTime();
  const records = [-1, 0, 1000, 86400000].map((offset, index) => ({
    id: String(index), duration_ms: 10000, started_at: new Date(time + offset).toISOString(),
    penalty: 'OK' as const, category_id: 2, cube_id: 3, custom: 'cross',
  }));
  const filters = {start: localDate(midnight), end: localDate(midnight), event:'2', cube:'3', custom:'cross'};
  assert.deepEqual(filterSolves(records, filters).map(record => record.id), ['1', '2']);
  assert.equal(filterSolves(records, {...filters, cube:'4'}).length, 0);
  assert.equal(filterSolves(records, {...filters, custom:'pll'}).length, 0);
  assert.deepEqual(presetDates(7, midnight), {start:'2026-09-29', end:'2026-10-05'});
  assert.deepEqual(presetDates(null, midnight), {start:'', end:''});
});

test('ao50 and ao100 trim five percent and count penalties without altering raw times', () => {
  const solves = Array.from({length:100}, (_, index) => ({duration_ms:(index + 1) * 1000}));
  const result = statistics(solves);
  assert.equal(result.ao50, 75500);
  assert.equal(result.ao100, 50500);
  assert.equal(result.bestAo50, 25500);
  assert.equal(result.bestAo100, 50500);
  assert.equal(result.worst, 100000);
  assert.equal(statistics(solves.slice(0, 49)).ao50, null);
  assert.equal(average([...Array(47).fill(10000), ...Array(3).fill(Infinity)]), 10000);
  assert.equal(average([...Array(46).fill(10000), ...Array(4).fill(Infinity)]), Infinity);
  const penalties = statistics([{duration_ms:10000,penalty:'+2'}, {duration_ms:99999,penalty:'DNF'}]);
  assert.equal(penalties.plusTwoCount, 1);
  assert.equal(penalties.dnfCount, 1);
  assert.equal(penalties.worst, 12000);
});

test('favorite event and best labels compare medians within the appropriate event', () => {
  const organization = {categories:[{id:1,name:'3x3'}, {id:2,name:'4x4'}], cubes:[{id:1,name:'cube a'}, {id:2,name:'cube b'}]};
  const rows = [
    {category_id:1,cube_id:1,custom:'cross',duration_ms:1000},
    {category_id:1,cube_id:1,custom:'cross',duration_ms:29000},
    {category_id:1,cube_id:2,custom:'pll',duration_ms:10000},
    {category_id:1,cube_id:2,custom:'pll',duration_ms:8000,penalty:'+2' as const},
    {category_id:1,cube_id:1,custom:'cross',duration_ms:1,penalty:'DNF' as const},
    {category_id:2,cube_id:1,custom:'other',duration_ms:2000},
  ].map((solve,index) => ({...solve,id:String(index),started_at:'2026-10-06T12:00:00Z',penalty:solve.penalty ?? 'OK' as const}));
  const filters = {start:'',end:'',event:'',cube:'',custom:''};
  assert.deepEqual(comparisonLabels(rows,organization,filters), {favoriteEvent:'3x3',bestCube:'cube b',bestCustom:'pll'});
  assert.deepEqual(comparisonLabels(rows,organization,{...filters,event:'2'}), {favoriteEvent:'3x3',bestCube:'cube a',bestCustom:'other'});
  assert.equal(comparisonLabels(rows,organization,{...filters,cube:'1'}).bestCube, 'cube b');
  assert.equal(comparisonLabels(rows,organization,{...filters,event:'1',cube:'1'}).bestCube, 'cube b');
  assert.deepEqual(comparisonLabels([],organization,filters), {favoriteEvent:null,bestCube:null,bestCustom:null});
});

test('best cube fallback event stays independent of cube selection', () => {
  const organization = {categories:[{id:1,name:'3x3'}, {id:2,name:'4x4'}],cubes:[{id:1,name:'cube a'}, {id:2,name:'cube b'}]};
  const rows = [
    {category_id:1,cube_id:2,duration_ms:10000},
    {category_id:1,cube_id:2,duration_ms:11000},
    {category_id:2,cube_id:1,duration_ms:30000},
  ].map((solve,index)=>({...solve,id:String(index),started_at:'2026-10-06T12:00:00Z',penalty:'OK' as const}));
  const result = comparisonLabels(rows,organization,{start:'',end:'',event:'',cube:'1',custom:''});
  assert.equal(result.bestCube,'cube b');
  assert.equal(result.favoriteEvent,'4x4');
  assert.equal(comparisonLabels(rows,organization,{start:'2026-10-07',end:'',event:'',cube:'',custom:''}).bestCube,null);
});
