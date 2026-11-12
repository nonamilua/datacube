import assert from 'node:assert/strict';
import {test} from 'node:test';
import {importPayload, saveImport} from '../src/import/client.ts';
import {parseCstimer} from '../src/import/cstimer.ts';

const sessions = () => parseCstimer(JSON.stringify({session1:[[[2000,12345],'scramble','comment',1700000000]],session2:[[[0,1000],'','',1700000000]]}));

test('payload contains only selected sessions with immutable raw times and explicit assignments',()=> {
  const draft=sessions(); draft[0].event='3x3'; draft[0].cube='my cube';draft[0].cubeModelId='model';draft[0].custom='pll';draft[1].selected=false;
  assert.deepEqual(importPayload(draft),{sessions:[{event:'3x3',cube_name:'my cube',cube_model_id:'model',custom:'pll',solves:[{duration_ms:12345,penalty:'+2',started_at:'2023-11-14T22:13:20.000Z'}]}]});
  assert.equal(JSON.stringify(importPayload(draft)).includes('comment'),false);
  assert.equal(JSON.stringify(importPayload(draft)).includes('session1'),false);
  assert.equal(importPayload(sessions()).sessions[0].custom,null);
});

test('retry sends the same normalized records with account guards and reports skipped duplicates',async()=> {
  const original=globalThis.fetch;const calls:RequestInit[]=[];
  globalThis.fetch=async(_url,init)=>{calls.push(init!);return calls.length===1?new Response('{"detail":"import unavailable try again"}',{status:503}):new Response('{"imported":0,"skipped":2}',{status:200});};
  try {
    await assert.rejects(saveImport(7,sessions(),new AbortController().signal),/import unavailable/);
    assert.deepEqual(await saveImport(7,sessions(),new AbortController().signal),{imported:0,skipped:2});
    assert.equal(calls[0].body,calls[1].body);
    assert.equal((calls[0].headers as Record<string,string>)['X-Namicubes-Account'],'7');
    assert.equal((calls[0].headers as Record<string,string>)['X-Namicubes-Request'],'1');
    assert.equal(calls[0].method,'POST');
  } finally {globalThis.fetch=original;}
});

test('account resets can abort an import without swallowing the cancellation',async()=> {
  const original=globalThis.fetch;const controller=new AbortController();controller.abort();
  globalThis.fetch=async(_url,init)=>{init!.signal!.throwIfAborted();throw new Error('unreachable');};
  try {await assert.rejects(saveImport(8,sessions(),controller.signal),{name:'AbortError'});}finally{globalThis.fetch=original;}
});

test('unsupported timestamps and invalid success responses fail clearly',async()=> {
  assert.throws(()=>parseCstimer(JSON.stringify({session1:[[[0,1000],'','',253402300800]]})),/invalid solve/);
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"imported":-1}',{status:200});
  try {await assert.rejects(saveImport(1,sessions(),new AbortController().signal),/invalid import response/);}finally{globalThis.fetch=original;}
});
