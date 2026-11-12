import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchBackup, restoreBackup } from '../src/import/backup.ts';
import { IMPORT_LIMITS } from '../src/import/cstimer.ts';

test('backup download keeps the account filename from the export response', async t => {
  const filename = 'datacube-backup-test_user.json';
  const body = '{"format":"datacube"}';
  t.mock.method(globalThis,'fetch',async () => new Response(body,{headers:{
    'Content-Type':'application/json', 'Content-Disposition':`attachment; filename="${filename}"`,
  }}));
  const backup = await fetchBackup(7,new AbortController().signal);
  assert.equal(backup.filename,filename);
  assert.equal(await backup.file.text(),body);
});

test('native preview and restore send the same original bytes above the csTimer limit', async t => {
  const content = '\uFEFF{"format":"datacube","solves":[{"duration_ms":9007199254740993,"started_at":"2026-10-04T15:00:00.123456Z"}]}';
  const file = new Blob([content,' '.repeat(IMPORT_LIMITS.fileBytes)]);
  const {signal} = new AbortController();
  const responses = [
    {url:'/api/solves/restore/preview',imported:1,skipped:1},
    {url:'/api/solves/restore',imported:0,skipped:2},
  ];
  const fetch = t.mock.method(globalThis,'fetch',async (url,init?:RequestInit) => {
    const {url:expected,...counts} = responses.shift()!;
    assert.equal(url,expected);
    assert.equal(init?.body,file);
    assert.equal(init?.signal,signal);
    assert.equal(init?.method,'POST');
    assert.equal(new Headers(init?.headers).get('X-Namicubes-Account'),'7');
    assert.equal(new Headers(init?.headers).get('X-Namicubes-Request'),'1');
    return Response.json(counts);
  });

  assert.deepEqual(await restoreBackup(7,file,signal,true),{imported:1,skipped:1});
  assert.deepEqual(await restoreBackup(7,file,signal),{imported:0,skipped:2});
  assert.equal(fetch.mock.callCount(),2);
});

test('native restore requires two nonnegative integer counts and preserves API errors', async t => {
  const responses = [
    Response.json({imported:1}),
    Response.json({imported:-1,skipped:2}),
    Response.json({imported:0,skipped:0.5}),
    Response.json({detail:'file exceeds 10 mib'},{status:413}),
  ];
  t.mock.method(globalThis,'fetch',async ()=>responses.shift()!);
  const restore = () => restoreBackup(7,new Blob(),new AbortController().signal,true);
  for (let index = 0; index < 3; index++) await assert.rejects(restore(),/invalid restore response/);
  await assert.rejects(restore(),{status:413,message:'file exceeds 10 mib'});
});
