import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeferredAnalyticsUpdates } from '../src/analytics/deferred-updates.ts';
import { availableFilters, filterSolves, presetDates } from '../src/analytics/filters.ts';
import { statistics } from '../src/analytics/statistics.ts';
import { comparisonData } from '../src/analytics/boxplots.ts';
import type { StoredSolve } from '../src/api/api.ts';

const org = {categories:[{id:1,name:'3x3'},{id:2,name:'4x4'}],cubes:[{id:1,name:'one'},{id:2,name:'two'},{id:3,name:'three'}]};
const solve = (id: number, cube_id = 1, custom = 'pll', category_id = 2): StoredSolve => ({id:String(id),duration_ms:id*1000,started_at:'2026-10-16T12:00:00Z',penalty:'OK',cube_id,custom,category_id});

test('hidden mutations coalesce without calculating or reconciling retained filters',() => {
  let rows = [solve(1),solve(2)];
  let filters = {event:'2',cube:'1',custom:'pll',start:'',end:''};
  let calls=0, count=0;
  const updates = new DeferredAnalyticsUpdates(() => {
    calls++;
    const options=availableFilters(rows,filters);
    filters={...filters,cube:options.cube,custom:options.custom};
    count=statistics(filterSolves(rows,filters)).count;
  });
  updates.show(); assert.equal(calls,1); assert.equal(count,2);
  updates.hide();
  rows=[...rows,solve(3),solve(4)]; updates.invalidate();
  rows=rows.filter(row=>row.id!=='1'); updates.invalidate(); updates.invalidate();
  assert.equal(calls,1); assert.equal(count,2);
  assert.deepEqual(filters,{event:'2',cube:'1',custom:'pll',start:'',end:''});
  updates.show(); assert.equal(calls,2); assert.equal(count,3);
  updates.show(); assert.equal(calls,2);
  rows=[]; updates.invalidate();
  assert.equal(calls,3); assert.equal(count,0); assert.equal(filters.event,'2');
  assert.equal(filters.cube,''); assert.equal(filters.custom,'');
});

test('inactive views reconcile only when selected and select all includes new options',() => {
  let rows=[solve(1),solve(2,2,'oll')];
  const filters={event:'2',cube:'1',custom:'pll',start:'',end:''};
  let cubes: string[]|null=null, tags:string[]|null=['pll'];
  const calls={overview:0,compare:0};
  let groups:string[]=[];
  const updates=new DeferredAnalyticsUpdates(view=>{
    calls[view]++;
    if(view==='compare') {
      const data=comparisonData(rows,org,filters,cubes,tags);
      cubes=data.cubeSelection;tags=data.customSelection;groups=data.cubeGroups.map(group=>group.value);
    }
  });
  updates.show(); assert.deepEqual(calls,{overview:1,compare:0});
  updates.select('compare'); assert.deepEqual(groups,['1','2']);
  updates.hide(); rows=[solve(2,2,'oll'),solve(3,3,'new')];updates.invalidate();updates.invalidate();
  assert.deepEqual(tags,['pll']); assert.deepEqual(calls,{overview:1,compare:1});
  updates.show(); assert.equal(cubes,null);assert.deepEqual(tags,[]);assert.deepEqual(groups,['2','3']);
  assert.deepEqual(calls,{overview:1,compare:2});
  updates.select('overview'); assert.deepEqual(calls,{overview:2,compare:2});
  updates.invalidate('overview'); assert.deepEqual(calls,{overview:3,compare:2});
  updates.select('compare'); assert.deepEqual(calls,{overview:3,compare:2});
  cubes=[];updates.invalidate('compare');assert.deepEqual(groups,[]);
});

test('view and shared date choices persist through leaving and returning',() => {
  const filters={event:'2',cube:'1',custom:'pll',start:'2026-10-01',end:'2026-10-16'};
  let active='';
  const updates=new DeferredAnalyticsUpdates(view=>{active=view;});
  updates.show(); updates.select('compare');updates.hide();updates.invalidate();updates.show();
  assert.equal(active,'compare'); assert.equal(updates.isActive('compare'),true);
  assert.deepEqual(filters,{event:'2',cube:'1',custom:'pll',start:'2026-10-01',end:'2026-10-16'});
});

test('rolling hours recalculate on return and visible ticks without data changes',() => {
  let now=new Date('2026-10-16T13:00:00Z'),count=-1,calls=0;
  const rows=[solve(1)];
  const filters={event:'2',cube:'',custom:'',start:'',end:'',hours:2};
  const updates=new DeferredAnalyticsUpdates(()=>{calls++;count=filterSolves(rows,filters,now).length;});
  updates.show(true);assert.equal(count,1);
  updates.hide();now=new Date('2026-10-16T14:01:00Z');
  assert.equal(count,1);updates.show(true);assert.equal(count,0);assert.equal(calls,2);
  now=new Date('2026-10-16T14:02:00Z');updates.invalidate();assert.equal(calls,3);
  updates.hide();updates.invalidate();assert.equal(calls,3);
  assert.notDeepEqual(presetDates(1,new Date(2026,9,16)),presetDates(1,new Date(2026,9,17)));
});

test('opening during a pending save displays confirmed data then updates without changing selection',() => {
  let confirmed=[solve(1)], count=0;
  const filters={event:'2',cube:'1',custom:'pll',start:'',end:''};
  const updates=new DeferredAnalyticsUpdates(()=>{count=filterSolves(confirmed,filters).length;});
  updates.show();assert.equal(count,1);updates.hide();
  const pending=solve(2);
  updates.show();assert.equal(count,1);
  confirmed=[...confirmed,pending];updates.invalidate();assert.equal(count,2);
  assert.equal(filters.event,'2');assert.equal(filters.cube,'1');assert.equal(filters.custom,'pll');
});

test('account reset discards pending invalidations and cached view without adding subscriptions',() => {
  let accountRows=[solve(1)],count=0;
  const views:string[]=[];
  const updates=new DeferredAnalyticsUpdates(view=>{views.push(view);count=accountRows.length;});
  updates.show();updates.select('compare');updates.hide();updates.invalidate();
  accountRows=[];count=0;updates.reset();
  assert.equal(updates.isActive('compare'),false);assert.equal(count,0);
  accountRows=[solve(2),solve(3)];updates.invalidate();
  assert.equal(count,0);updates.show();assert.equal(count,2);
  assert.deepEqual(views,['overview','compare','overview']);
  for(let i=0;i<10;i++){updates.hide();updates.show();}
  assert.equal(views.length,3);
});
