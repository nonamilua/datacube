import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCstimer, validateImportFile, IMPORT_LIMITS, CSTIMER_EVENTS} from '../src/import/cstimer.ts';

const solve = (penalty=0,duration=21900,timestamp=1700000000) => [[penalty,duration],"R U R'",'private comment',timestamp,{cached:'ignored'}];
test('discovers every nonempty session numerically and supports string encoded legacy metadata',()=> {
  const data = {session1:[],session2:[solve()],session31:JSON.stringify([solve()]),session200:[solve()],
    properties:{sessionN:15,sessionData:JSON.stringify({'2':{name:'practice',opt:{scrType:'333'}},'31':{name:'bld',scr:'333ni'}})}};
  const parsed = parseCstimer(JSON.stringify(data));
  assert.deepEqual(parsed.map(session=>session.id),['session2','session31','session200']);
  assert.equal(parsed[0].event,'3x3'); assert.equal(parsed[1].event,'3bld'); assert.equal(parsed[2].event,'');
  assert.equal(parsed[0].name,'practice'); assert.equal(parsed[2].name,'session200');
  assert.ok(parsed.every(session=>session.selected && !session.cube && !session.custom && session.cubeModelId===null));
});
test('raw milliseconds penalties and UTC timestamps are preserved without comments or scrambles',()=> {
  const parsed = parseCstimer(JSON.stringify({session1:[solve(),solve(2000,12345),solve(-1,99876)]}));
  assert.deepEqual(parsed[0].solves,[
    {duration_ms:21900,penalty:'OK',started_at:'2023-11-14T22:13:20.000Z'},
    {duration_ms:12345,penalty:'+2',started_at:'2023-11-14T22:13:20.000Z'},
    {duration_ms:99876,penalty:'DNF',started_at:'2023-11-14T22:13:20.000Z'},
  ]);
  assert.equal(JSON.stringify(parsed).includes('private comment'),false);
  assert.equal(JSON.stringify(parsed).includes("R U R'"),false);
});
test('missing or unknown metadata requires explicit event choice and never infers notation',()=> {
  const parsed = parseCstimer(JSON.stringify({session1:[solve()],session2:[solve()],
    properties:{scrType:'333',sessionData:{'2':{name:'<img onerror=alert(1)>',opt:{scrType:'input'},stat:[999999]}}}}));
  assert.equal(parsed[0].event,''); assert.equal(parsed[1].event,'');
  assert.equal(parsed[1].name,'<img onerror=alert(1)>');
  assert.equal(parsed[1].solves.length,1);
  assert.equal(CSTIMER_EVENTS.ftoso,'fto'); assert.equal(CSTIMER_EVENTS.sqrs,'square 1');
  for (const setting of ['constructor','toString','__proto__']) {
    assert.equal(parseCstimer(JSON.stringify({session1:[solve()],properties:{sessionData:{'1':{opt:{scrType:setting}}}}}))[0].event,'');
  }
});
test('BOM object encoded properties and multiphase total are supported',()=> {
  const data={session4:[[[2000,12000,8000,4000],'scramble','comment',0]],properties:JSON.stringify({sessionData:{'4':{opt:{scrType:'444wca'}}}})};
  assert.equal(parseCstimer('\uFEFF'+JSON.stringify(data))[0].solves[0].duration_ms,12000);
  assert.equal(parseCstimer(JSON.stringify(data))[0].event,'4x4');
});
test('unsupported roots malformed sessions records and penalties fail without partial drafts',()=> {
  for (const text of ['not json','[]','null','{}','{"session1":42}','{"session1":[]}','{"session1":[[[]]]}']) assert.throws(()=>parseCstimer(text));
  for (const row of [solve(1),solve(0,-1),solve(0,1.5),solve(0,100,-1),solve(0,100,NaN),[[0,100],'','']]) {
    assert.throws(()=>parseCstimer(JSON.stringify({session1:[solve(),row]})));
  }
});
test('file extension byte limits and cumulative record limits are enforced',()=> {
  validateImportFile('backup.TXT',IMPORT_LIMITS.fileBytes);
  validateImportFile('backup.json',1);
  assert.throws(()=>validateImportFile('backup.csv',1));
  assert.throws(()=>validateImportFile('backup.txt',IMPORT_LIMITS.fileBytes+1));
  assert.throws(()=>parseCstimer(' '.repeat(IMPORT_LIMITS.fileBytes+1)),/file exceeds/);
  assert.throws(()=>parseCstimer(JSON.stringify({session1:Array(25000).fill(solve()),session27:Array(25001).fill(solve())})),/too many solves/);
});
