import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HistoryStore, localDayInterval } from '../src/history/store.ts';
import type { StoredSolve, HistoryCursor } from '../src/api/api.ts';

const record = (id: number, started_at = '2026-10-04T15:00:00.000Z'): StoredSolve => ({id:String(id).padStart(8,'0'),started_at,duration_ms:id,penalty:'OK'});
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(count: number) {
  let records = Array.from({length:count},(_,i)=>record(count - i));
  let calls = 0;
  let fail = false;
  const store = new HistoryStore(async (cursor,interval) => {
    calls++;
    if (fail) throw new Error('offline');
    const matching = records.filter(solve => (!interval || Date.parse(solve.started_at) >= Date.parse(interval.start) && Date.parse(solve.started_at) < Date.parse(interval.end)) && (!cursor || Date.parse(solve.started_at) < Date.parse(cursor.started_at) || solve.started_at === cursor.started_at && solve.id < cursor.id));
    const items = matching.slice(0,50);
    return {items,next_cursor:matching.length > 50 ? {started_at:items.at(-1)!.started_at,id:items.at(-1)!.id} : null};
  },()=>{});
  store.setAccount(1);
  return {store,get calls(){return calls;},set fail(value: boolean){fail=value;},set records(value:StoredSolve[]){records=value;},get records(){return records;}};
}

test('latest cache is 50 and cursor paging appends equal timestamps without duplicates',async () => {
  const f = fixture(127);
  await f.store.refreshLatest();
  assert.equal(f.store.cache.length,50);
  f.store.open();
  assert.equal(f.calls,1); // Opening reads the warm cache synchronously.
  assert.equal(f.store.rows[0].id,record(127).id);
  await Promise.all([f.store.more(),f.store.more(),f.store.more()]);
  assert.equal(f.calls,2);
  assert.equal(f.store.rows.length,100);
  await f.store.more();
  assert.equal(f.store.rows.length,127);
  assert.equal(f.store.hasMore,false);
  await f.store.more();
  assert.equal(f.calls,3);
  assert.equal(new Set(f.store.rows.map(row=>row.id)).size,127);
});

test('additions deletions and edits preserve loaded older pages and do not skip boundary rows',async () => {
  const f = fixture(125);
  await f.store.refreshLatest(); f.store.open(); await f.store.more();
  f.store.remove(record(26).id); // Last loaded boundary is deleted.
  f.records = f.records.filter(row=>row.id!==record(26).id);
  const added = record(126);
  f.records = [added,...f.records]; f.store.upsert(added);
  f.store.upsert({...record(100),penalty:'+2',custom:'pll'});
  f.records = f.records.map(row=>row.id===record(100).id ? {...row,penalty:'+2',custom:'pll'} : row);
  await f.store.refreshLatest(); await f.store.more();
  assert.equal(f.store.rows.length,125);
  assert.equal(new Set(f.store.rows.map(row=>row.id)).size,125);
  assert.ok(f.store.rows.some(row=>row.id===record(25).id));
  assert.equal(f.store.rows.find(row=>row.id===record(100).id)?.penalty,'+2');
  assert.equal(f.store.cache.length,50);
});

test('failed page retains rows and retries exactly once without duplicates',async () => {
  const f = fixture(65); await f.store.refreshLatest(); f.store.open();
  f.fail = true; await f.store.more();
  assert.equal(f.store.error,true); assert.equal(f.store.rows.length,50);
  await f.store.more(); assert.equal(f.calls,2);
  f.fail=false; await f.store.retry();
  assert.equal(f.store.rows.length,65); assert.equal(f.store.error,false);
  assert.equal(new Set(f.store.rows.map(row=>row.id)).size,65);
});

test('day filter is independent and close discards its pages before reopening latest cache',async () => {
  const f = fixture(105); await f.store.refreshLatest(); f.store.open(); await f.store.more();
  f.store.filter('2028-10-04'); await flush();
  assert.equal(f.store.rows.length,0); assert.equal(f.store.hasMore,false);
  f.store.close(); assert.equal(f.store.day,''); assert.equal(f.store.rows.length,0);
  f.store.open(); assert.equal(f.store.rows.length,50); assert.equal(f.store.day,'');
  assert.equal(f.calls,3);
});

test('aborted responses cannot enter a new filter opening or account',async () => {
  const requests: {resolve:(value:any)=>void;signal:AbortSignal;cursor:HistoryCursor|null}[] = [];
  const store = new HistoryStore((cursor,_interval,signal)=>new Promise(resolve=>requests.push({resolve,signal,cursor})),()=>{});
  store.setAccount(1); const initial=store.refreshLatest(); store.open();
  store.filter('2026-10-04'); assert.equal(requests[0].signal.aborted,true);
  requests[0].resolve({items:[record(1)],next_cursor:null}); await initial;
  assert.equal(store.rows.length,0); assert.equal(store.cache.length,0);
  store.close(); store.open();
  requests[1].resolve({items:[record(2)],next_cursor:null}); await flush();
  assert.equal(store.rows.length,0); assert.equal(store.day,'');
  store.setAccount(2); const other=store.refreshLatest();
  requests[2].resolve({items:[record(3)],next_cursor:null}); await flush();
  assert.equal(store.cache.length,0);
  requests[3].resolve({items:[record(4)],next_cursor:null}); await other;
  store.open(); assert.deepEqual(store.rows.map(row=>row.id),[record(4).id]);
  store.setAccount(null); assert.equal(store.cache.length,0);
});

test('initial failure retries and pending saves stay visible without entering analytics data',async () => {
  const f=fixture(0); f.fail=true; await f.store.refreshLatest(); f.store.open(); await flush();
  assert.equal(f.store.error,true); assert.equal(f.store.cacheReady,false);
  f.fail=false; await f.store.retry(); assert.equal(f.store.cacheReady,true);
  f.store.upsert({...record(1),pending:true}); await f.store.refreshLatest();
  assert.equal(f.store.rows[0].pending,true);
  assert.deepEqual(f.records,[]);
  f.records=[record(1)]; await f.store.refreshLatest();
  assert.equal(f.store.rows.length,1); assert.equal(f.store.rows[0].pending,undefined);
});

test('local days use local midnights including 23 and 25 hour DST days',() => {
  const old=process.env.TZ;
  try {
    process.env.TZ='America/Sao_Paulo';
    assert.deepEqual(localDayInterval('2026-10-04'),{start:'2026-10-04T03:00:00.000Z',end:'2026-10-05T03:00:00.000Z'});
    process.env.TZ='America/New_York';
    const spring=localDayInterval('2026-03-08')!,autumn=localDayInterval('2026-11-01')!;
    assert.equal(Date.parse(spring.end)-Date.parse(spring.start),23*3600000);
    assert.equal(Date.parse(autumn.end)-Date.parse(autumn.start),25*3600000);
    assert.throws(()=>localDayInterval('2026-02-31'));
    assert.equal(localDayInterval(''),null);
  } finally { if(old===undefined)delete process.env.TZ;else process.env.TZ=old; }
});

test('filtered pages keep their own interval and edits during an initial read restart before the first cursor',async () => {
  const f=fixture(112);
  f.records=f.records.map((row,i)=>i<70?row:{...row,started_at:'2026-10-03T15:00:00.000Z'});
  await f.store.refreshLatest(); f.store.open(); f.store.filter('2026-10-04'); await flush();
  assert.equal(f.store.rows.length,50); await f.store.more();
  assert.equal(f.store.rows.length,70); assert.equal(f.store.hasMore,false);
  f.store.upsert({...record(60),custom:'pll'}); await f.store.refreshLatest();
  assert.equal(f.store.day,'2026-10-04'); assert.equal(f.store.rows.length,70);
  assert.equal(f.store.rows.find(row=>row.id===record(60).id)?.custom,'pll');

  const queries:(HistoryCursor|null)[]=[];
  let release:(value:any)=>void=()=>{};
  const store=new HistoryStore((cursor)=>{queries.push(cursor);return new Promise(resolve=>{release=resolve;});},()=>{});
  store.setAccount(1); store.open(); release({items:[record(3)],next_cursor:null}); await flush();
  store.filter('2026-10-04');
  store.upsert(record(1));
  const refreshed=store.refreshLatest(); release({items:[record(3)],next_cursor:null}); await flush();
  assert.equal(queries.at(-1),null); // The canceled filtered request never established a cursor.
  release({items:[record(3),record(1)],next_cursor:null}); await refreshed;
  assert.deepEqual(store.rows.map(row=>row.id),[record(3).id,record(1).id]);
});

test('merge preserves API sub-millisecond ordering before the solve ID tie-break',async () => {
  const records=[record(1,'2026-10-04T15:00:00.000009Z'),record(3,'2026-10-04T15:00:00.000008Z'),record(2,'2026-10-04T15:00:00.000008Z')];
  const store=new HistoryStore(async()=>({items:records,next_cursor:null}),()=>{});
  store.setAccount(1);await store.refreshLatest();store.open();store.upsert(records[1]);
  assert.deepEqual(store.rows.map(row=>row.id),[record(1).id,record(3).id,record(2).id]);
});
