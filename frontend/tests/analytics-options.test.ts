import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableFilters, filterSolves, localDate, EMPTY_CUSTOM, type Filters } from '../src/analytics/filters.ts';
import type { StoredSolve } from '../src/api/api.ts';

const today = new Date(2026, 9, 10, 12);
function solve(id: string, cube: number | null, custom: string | null, event = 1, day = 10, penalty: StoredSolve['penalty'] = 'OK'): StoredSolve {
  return { id, cube_id: cube, custom, category_id: event, started_at: new Date(2026,9,day,12).toISOString(), duration_ms:10000, penalty };
}
const rows = [
  solve('a',1,'cross'), solve('b',1,null), solve('c',2,'pll',1,10,'DNF'), solve('d',2,'cross'),
  solve('old',3,'old',1,9), solve('other',4,'other',2), solve('no cube',null,'pll'),
];
const filters: Filters = {start:localDate(today),end:localDate(today),event:'1',cube:'',custom:''};

test('available cube/custom choices use event and inclusive dates and include DNF', () => {
  const available = availableFilters(rows,filters,today);
  assert.deepEqual(available.cubeIds,['1','2']);
  assert.deepEqual(available.customValues,[EMPTY_CUSTOM,'cross','pll']);
  const onlyDnf = availableFilters([solve('dnf',9,'dnf tag',1,10,'DNF')],filters,today);
  assert.deepEqual(onlyDnf.cubeIds,['9']);
  assert.deepEqual(onlyDnf.customValues,['dnf tag']);
  assert.deepEqual(availableFilters(rows,{...filters,event:'2'},today).cubeIds,['4']);
  assert.deepEqual(availableFilters(rows,{...filters,event:'2'},today).customValues,['other']);
  assert.deepEqual(availableFilters(rows,{...filters,start:'',end:''},today).cubeIds,['3','1','2']);
  assert.deepEqual(availableFilters(rows,{...filters,hours:2},new Date(today.getTime()+7200000)).cubeIds,['1','2']);
  assert.deepEqual(availableFilters(rows,{...filters,hours:2},new Date(today.getTime()+7200001)).cubeIds,[]);
});

test('each option list applies the other filter but not its own selection', () => {
  const selected = availableFilters(rows,{...filters,cube:'1',custom:'cross'},today);
  assert.equal(selected.cube,'1');
  assert.equal(selected.custom,'cross');
  assert.deepEqual(selected.cubeIds,['1','2']);
  assert.deepEqual(selected.customValues,[EMPTY_CUSTOM,'cross']);
  const byCube = availableFilters(rows,{...filters,cube:'2'},today);
  assert.deepEqual(byCube.customValues,['cross','pll']);
  assert.deepEqual(byCube.cubeIds,['1','2']);
  const byCustom = availableFilters(rows,{...filters,custom:'pll'},today);
  assert.deepEqual(byCustom.cubeIds,['2']);
  assert.deepEqual(byCustom.customValues,[EMPTY_CUSTOM,'cross','pll']);
});

test('invalid selections reset independently and incompatible individually valid selections both reset', () => {
  const noCube = availableFilters(rows,{...filters,cube:'99',custom:'pll'},today);
  assert.equal(noCube.cube,'');
  assert.equal(noCube.custom,'pll');
  assert.deepEqual(noCube.cubeIds,['2']);
  const noCustom = availableFilters(rows,{...filters,cube:'1',custom:'missing'},today);
  assert.equal(noCustom.cube,'1');
  assert.equal(noCustom.custom,'');
  const incompatible = availableFilters(rows,{...filters,cube:'1',custom:'pll'},today);
  assert.equal(incompatible.cube,'');
  assert.equal(incompatible.custom,'');
  assert.deepEqual(incompatible.cubeIds,['1','2']);
  assert.deepEqual(incompatible.customValues,[EMPTY_CUSTOM,'cross','pll']);
  assert.equal(filterSolves(rows,{...filters,cube:'1',custom:'pll'},today).length,0);
});

test('event/date scope changes preserve matches and reset independently before cross-filtering', () => {
  const selected = {...filters,cube:'1',custom:'cross'};
  const nextEvent = [...rows,solve('e',2,'cross',3),solve('f',1,'other',3)];
  // Both choices exist in event 3, but not together.
  const conflict = availableFilters(nextEvent,{...selected,event:'3'},today);
  assert.equal(conflict.cube,'');
  assert.equal(conflict.custom,'');
  // Cube disappears on the next day; its tag still exists on another cube.
  const nextDay = [...rows,solve('g',2,'cross',1,11)];
  const changed = availableFilters(nextDay,{...selected,start:'2026-10-11',end:'2026-10-11'},today);
  assert.equal(changed.cube,'');
  assert.equal(changed.custom,'cross');
  const retained = availableFilters(nextDay,{...selected,start:'',end:''},today);
  assert.equal(retained.cube,'1');
  assert.equal(retained.custom,'cross');
});

test('none represents only blank tags and disappears when none match the other filter', () => {
  const blank = availableFilters(rows,{...filters,custom:EMPTY_CUSTOM},today);
  assert.equal(blank.custom,EMPTY_CUSTOM);
  assert.deepEqual(blank.cubeIds,['1']);
  const noBlanks = availableFilters(rows,{...filters,event:'2',custom:EMPTY_CUSTOM},today);
  assert.equal(noBlanks.custom,'');
  assert.deepEqual(noBlanks.customValues,['other']);
  assert.deepEqual(availableFilters([solve('blank',1,'  ')],filters,today).customValues,[EMPTY_CUSTOM]);
});

test('empty scope and account reset yield no choices beyond all without changing event scope', () => {
  for (const input of [[],rows]) {
    const available = availableFilters(input,{...filters,event:'99',cube:'1',custom:'cross'},today);
    assert.deepEqual(available,{cube:'',custom:'',cubeIds:[],customValues:[]});
  }
  assert.deepEqual(availableFilters(rows,{...filters,event:''},today).cubeIds,[]);
  const secondAccount = [solve('separate',8,'own')];
  assert.deepEqual(availableFilters(secondAccount,filters,today).cubeIds,['8']);
  assert.deepEqual(availableFilters(secondAccount,filters,today).customValues,['own']);
  assert.equal(filters.event,'1');
});

test('saving editing and deleting solve data refresh choices and selections without mutating source data', () => {
  const original = structuredClone(rows);
  const selected = {...filters,cube:'2',custom:'pll'};
  assert.equal(availableFilters(rows,selected,today).custom,'pll');
  const edited = rows.map(row => row.id === 'c' ? {...row,custom:'alg'} : row);
  const afterEdit = availableFilters(edited,selected,today);
  // pll still exists without a cube, but its selected cube combination no longer does.
  assert.equal(afterEdit.cube,'');
  assert.equal(afterEdit.custom,'');
  assert.ok(afterEdit.customValues.includes('alg'));
  const afterSave = availableFilters([...rows,solve('new',5,'new tag')],filters,today);
  assert.ok(afterSave.cubeIds.includes('5'));
  assert.ok(afterSave.customValues.includes('new tag'));
  const afterDelete = availableFilters(rows.filter(row => row.cube_id !== 2),selected,today);
  assert.equal(afterDelete.cube,'');
  assert.equal(afterDelete.custom,'pll');
  assert.deepEqual(afterDelete.cubeIds,[]); // A tag on a solve without a cube is still selectable.
  assert.deepEqual(rows,original);
});
