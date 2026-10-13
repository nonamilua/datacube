import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcileSelection } from '../src/analytics/compare-selection.ts';
import { comparisonData } from '../src/analytics/boxplots.ts';

test('all includes future options while clearing all stays empty through updates',() => {
  assert.equal(reconcileSelection(null,['a','b']),null);
  assert.equal(reconcileSelection(null,[]),null);
  assert.equal(reconcileSelection(null,['new']),null);
  assert.deepEqual(reconcileSelection([],['a','b']),[]);
  assert.deepEqual(reconcileSelection([],[]),[]);
  assert.deepEqual(reconcileSelection([],['new']),[]);
});
test('few selections and exclusions retain matches without adding new options',() => {
  assert.deepEqual(reconcileSelection(['a'],['a','b','c']),['a']);
  assert.deepEqual(reconcileSelection(['a','b'],['a','b','c','new']),['a','b']);
  assert.deepEqual(reconcileSelection(['a','removed'],['a','b']),['a']);
  assert.deepEqual(reconcileSelection(['removed'],['a','b']),[]);
  assert.equal(reconcileSelection(['a','b'],['a','b']),null);
});
test('empty cube and tag selections show empty groups independently with all options retained',() => {
  const organization = {categories:[{id:1,name:'3x3'}],cubes:[{id:1,name:'a'},{id:2,name:'b'}]};
  const rows = [1,2].map(id => ({id:String(id),cube_id:id,category_id:1,custom:`tag ${id}`,duration_ms:10000,started_at:'2026-10-10T12:00:00Z',penalty:'OK' as const}));
  const filters = {event:'1',cube:'',custom:'',start:'',end:''};
  const all = comparisonData(rows,organization,filters,null,null);
  assert.equal(all.cubeGroups.length,2); assert.equal(all.customGroups.length,2);
  for (const [cubes,tags] of [[[],null],[null,[]],[[],[]]] as const) {
    const data = comparisonData(rows,organization,filters,cubes===null?null:[...cubes],tags===null?null:[...tags]);
    assert.equal(data.cubeGroups.length,cubes===null?2:0);
    assert.equal(data.customGroups.length,tags===null?2:0);
    assert.equal(data.cubes.length,2); assert.equal(data.custom.length,2);
  }
});
