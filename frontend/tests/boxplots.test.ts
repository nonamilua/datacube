import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boxSummary, comparisonData, comparisonPercentage } from '../src/analytics/boxplots.ts';
import { comparisonColors } from '../src/analytics/compare-colors.ts';
import type { StoredSolve, Organization } from '../src/api/api';
import type { Filters } from '../src/analytics/filters';

const organization: Organization = {categories:[{id:1,name:'3x3'},{id:2,name:'4x4'}],
  cubes:[{id:1,name:'z cube'},{id:2,name:'a cube'},{id:3,name:'old longer cube name'}]};
const filters: Filters = {start:'',end:'',event:'1',cube:'99',custom:'ignored'};
const solve = (id:number, cube_id:number|null, custom:string|null, other:Partial<StoredSolve> = {}):StoredSolve =>
  ({id:String(id),duration_ms:10000,started_at:'2026-10-10T12:00:00Z',category_id:1,cube_id,custom,penalty:'OK',...other});
const rows = [solve(1,1,'a'),solve(2,2,'b',{penalty:'+2'}),solve(3,3,'dnf',{penalty:'DNF'}),solve(4,null,'a'),solve(5,1,null)];

test('tooltip denominators exclude DNF and missing labels independently and include +2', () => {
  const data = comparisonData([...rows,solve(6,null,'  '),solve(7,null,null,{cube_id:undefined,custom:undefined})],organization,filters,null,null);
  assert.equal(data.cubeTotal,3);
  assert.equal(data.customTotal,3);
  assert.equal(data.cubeGroups.find(group=>group.value==='2')!.box!.count,1);
  assert.equal(data.customGroups.find(group=>group.value==='b')!.box!.median,12000);
});

test('unlabeled solves cannot dilute a sole labeled group percentage', () => {
  const unlabeled = Array.from({length:100},(_,i)=>solve(100+i,null,null));
  const data = comparisonData([solve(1,1,'tag'),...unlabeled],organization,filters,null,null);
  assert.equal(comparisonPercentage(data.cubeGroups[0].box!.count,data.cubeTotal),'100%');
  assert.equal(comparisonPercentage(data.customGroups[0].box!.count,data.customTotal),'100%');
});

test('tooltip denominators use only the supplied account and selected event date or hour scope', () => {
  const scopedRows = [solve(1,1,'a'),solve(2,2,'b',{category_id:2}),
    solve(3,1,'old',{started_at:'2026-10-09T12:00:00Z'}),
    solve(4,1,'early',{started_at:'2026-10-10T08:00:00Z'}),
    solve(5,1,'future',{started_at:'2026-10-11T12:00:00Z'})];
  const dated = comparisonData(scopedRows,organization,{...filters,start:'2026-10-10',end:'2026-10-10'},null,null);
  assert.equal(dated.cubeTotal,2); assert.equal(dated.customTotal,2);
  const hourly = comparisonData(scopedRows,organization,{...filters,hours:2},null,null,new Date('2026-10-10T13:00:00Z'));
  assert.equal(hourly.cubeTotal,1); assert.equal(hourly.customTotal,1);
  const otherEvent = comparisonData(scopedRows,organization,{...filters,event:'2'},null,null);
  assert.equal(otherEvent.cubeTotal,1); assert.equal(otherEvent.customTotal,1);
  const otherAccount = comparisonData([solve(99,9,'other')],{categories:organization.categories,cubes:[{id:9,name:'other'}]},filters,null,null);
  assert.equal(otherAccount.cubeTotal,1); assert.equal(otherAccount.customTotal,1);
  assert.equal(comparisonData(scopedRows,organization,{...filters,event:''},null,null).cubeTotal,0);
});

test('checkbox selections never change either denominator or remaining group percentages', () => {
  const all = comparisonData(rows,organization,filters,null,null);
  for (const [cubes,tags] of [[['1'],['b']],[[],[]],[['2'],['a']]] as const) {
    const selected = comparisonData(rows,organization,filters,[...cubes],[...tags]);
    assert.equal(selected.cubeTotal,all.cubeTotal); assert.equal(selected.customTotal,all.customTotal);
    for (const [groups,total,allGroups] of [[selected.cubeGroups,selected.cubeTotal,all.cubeGroups],[selected.customGroups,selected.customTotal,all.customGroups]] as const) {
      for (const group of groups.filter(group=>group.box)) {
        assert.equal(comparisonPercentage(group.box!.count,total),comparisonPercentage(allGroups.find(other=>other.value===group.value)!.box!.count,total));
      }
    }
  }
  assert.equal(comparisonPercentage(2,all.cubeTotal),'66.7%');
  assert.equal(comparisonPercentage(1,all.customTotal),'33.3%');
  assert.equal(comparisonPercentage(1,4),'25%');
  assert.equal(comparisonPercentage(0,0),'0%');
});

test('type 7 quartiles interpolate even and odd samples without changing inputs',() => {
  const values = [4,1,3,2];
  assert.deepEqual(boxSummary(values),{count:4,q1:1.75,median:2.5,q3:3.25,low:1,high:4,outliers:[]});
  assert.deepEqual(values,[4,1,3,2]);
  assert.deepEqual(boxSummary([1,2,3,4,5]),{count:5,q1:2,median:3,q3:4,low:1,high:5,outliers:[]});
});
test('whiskers include fence observations and retain both tails as outliers',() => {
  const box = boxSummary([-100,0,1,2,3,4,5,6,7,100])!;
  assert.equal(box.q1,1.25); assert.equal(box.q3,5.75);
  assert.equal(box.low,0); assert.equal(box.high,7);
  assert.deepEqual(box.outliers,[-100,100]);
  assert.deepEqual(boxSummary([0,2,4,6,12])!.outliers,[]); // 12 equals the upper fence
});
test('empty single paired identical and dnf-only samples are explicit',() => {
  assert.equal(boxSummary([Infinity,NaN]),null);
  assert.deepEqual(boxSummary([8]),{count:1,q1:8,median:8,q3:8,low:8,high:8,outliers:[]});
  assert.equal(boxSummary([2,4])!.median,3);
  assert.deepEqual(boxSummary([5,5,5,5,50])!.outliers,[50]);
});
test('cube and custom selections use independent OR filters and ignore overview selections',() => {
  const data = comparisonData(rows,organization,filters,['1','2'],['b']);
  assert.deepEqual(data.cubeGroups.map(group=>group.value),['1','2']);
  assert.deepEqual(data.customGroups.map(group=>group.value),['b']);
  assert.equal(data.cubeGroups.find(group=>group.value==='1')!.box!.count,2);
  assert.equal(data.customGroups[0].box!.median,12000);
  assert.deepEqual(data.cubes.map(group=>group.value),['2','3','1']);
  assert.deepEqual(data.custom.map(group=>group.value),['a','b','dnf']);
});
test('all includes every labeled group DNF stays selectable and blanks are chart-specific',() => {
  const data = comparisonData(rows,organization,filters,null,null);
  assert.equal(data.cubeGroups.length,3); assert.equal(data.customGroups.length,3);
  assert.equal(data.cubeGroups.find(group=>group.value==='3')!.box,null);
  assert.equal(data.customGroups.find(group=>group.value==='a')!.box!.count,2);
  assert.equal(rows[1].duration_ms,10000);
});
test('event date and hour dependencies prune each selection independently',() => {
  const other = solve(6,2,'b',{category_id:2});
  const data = comparisonData([...rows,other],organization,{...filters,event:'2'},['1','2'],['a']);
  assert.equal(data.cubeSelection,null); assert.deepEqual(data.customSelection,[]);
  assert.deepEqual(data.customGroups,[]);
  const empty = comparisonData(rows,organization,{...filters,start:'2026-10-11'},['1'],['a']);
  assert.deepEqual(empty.cubes,[]); assert.deepEqual(empty.custom,[]);
  assert.deepEqual(empty.cubeSelection,[]); assert.deepEqual(empty.customSelection,[]);
  const hourly = comparisonData(rows,organization,{...filters,hours:2},null,null,new Date('2026-10-10T15:00:00Z'));
  assert.deepEqual(hourly.cubeGroups,[]);
});
test('updates retain valid selections and never carry options between account datasets',() => {
  const edited = rows.map(row => row.id==='2' ? {...row,custom:'edited'} : row);
  const data = comparisonData(edited,organization,filters,['2'],['b','a']);
  assert.deepEqual(data.cubeSelection,['2']); assert.deepEqual(data.customSelection,['a']);
  const deleted = comparisonData(rows.filter(row=>row.cube_id!==2),organization,filters,['2'],['b']);
  assert.deepEqual(deleted.cubeSelection,[]); assert.deepEqual(deleted.customSelection,[]);
  const account = comparisonData([solve(10,9,'other')],{categories:organization.categories,cubes:[{id:9,name:'other'}]},filters,['1'],['a']);
  assert.deepEqual(account.cubes.map(group=>group.value),['9']); assert.deepEqual(account.customSelection,[]);
});
test('all groups and all observations are retained for large comparisons',() => {
  const cubes = Array.from({length:20},(_,i)=>({id:i+1,name:`cube ${String(i).padStart(2,'0')}`}));
  const all = cubes.flatMap(cube=>Array.from({length:200},(_,i)=>solve(cube.id*1000+i,cube.id,'tag',{duration_ms:1000+i})));
  const data = comparisonData(all,{...organization,cubes},filters,null,null);
  assert.equal(data.cubeGroups.length,20); assert.ok(data.cubeGroups.every(group=>group.box!.count===200));
  assert.equal(data.customGroups[0].box!.count,4000);
});

test('boxplots sort by effective medians break ties alphabetically and put DNF last',() => {
  const cubes = [{id:1,name:'z cube'},{id:2,name:'a cube'},{id:3,name:'dnf cube'},{id:4,name:'fast cube'},{id:5,name:'other dnf'}];
  const times = [solve(1,1,'z',{duration_ms:10000,penalty:'+2'}),solve(2,2,'a',{duration_ms:12000}),
    solve(3,3,'dnf',{penalty:'DNF'}),solve(4,4,'fast',{duration_ms:11000}),solve(5,5,'other',{penalty:'DNF'})];
  const data = comparisonData(times,{...organization,cubes},filters,null,null);
  assert.deepEqual(data.cubeGroups.map(group=>group.value),['4','2','1','3','5']);
  assert.deepEqual(data.customGroups.map(group=>group.value),['fast','a','z','dnf','other']);
  assert.equal(times[0].duration_ms,10000);
  const edited = comparisonData(times.map(row => row.id==='1' ? {...row,duration_ms:7000} : row),{...organization,cubes},filters,null,null);
  assert.equal(edited.cubeGroups[0].value,'1');
  const dated = comparisonData([...times,solve(6,4,'fast',{duration_ms:20000,started_at:'2026-10-11T12:00:00Z'})],
    {...organization,cubes},{...filters,start:'2026-10-11'},null,null);
  assert.deepEqual(dated.cubeGroups.map(group=>group.value),['4']);
});

test('solid row colors progress from site cyan through violet to pink',() => {
  const palette = ['#71DBDB','#A59BFA','#E58DBD'] as const;
  assert.deepEqual(comparisonColors(0,...palette),[]);
  assert.deepEqual(comparisonColors(1,...palette),['rgb(113, 219, 219)']);
  assert.deepEqual(comparisonColors(2,...palette),['rgb(113, 219, 219)','rgb(229, 141, 189)']);
  assert.deepEqual(comparisonColors(3,...palette),['rgb(113, 219, 219)','rgb(165, 155, 250)','rgb(229, 141, 189)']);
  assert.deepEqual(comparisonColors(5,...palette),['rgb(113, 219, 219)','rgb(139, 187, 235)','rgb(165, 155, 250)','rgb(197, 148, 220)','rgb(229, 141, 189)']);
  assert.equal(comparisonColors(6,...palette).length,6);
});
