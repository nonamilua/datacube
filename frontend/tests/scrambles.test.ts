import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Scrambles, scrambleEvents, generateScramble } from '../src/scrambles.ts';
import { SolveTimer } from '../src/timer/timer.ts';

test('each app event maps to its own supported cubing event path', async () => {
  assert.deepEqual(Object.entries(scrambleEvents), [
    ['2x2','222'], ['3x3','333'], ['4x4','444'], ['5x5','555'], ['6x6','666'], ['7x7','777'],
    ['3bld','333bf'], ['4bld','444bf'], ['5bld','555bf'], ['3oh','333oh'], ['3mbld','333mbf'],
    ['fmc','333fm'], ['clock','clock'], ['megaminx','minx'], ['pyraminx','pyram'],
    ['skewb','skewb'], ['square 1','sq1'], ['fto','fto'],
  ]);
  // Exercise the installed library, including blindfolded/FMC/FTO paths.
  for (const eventID of Object.values(scrambleEvents)) {
    const text = await generateScramble(eventID);
    assert.ok(text.length > 0 && text.length <= 4096, eventID);
    if (eventID === '333fm') assert.ok(text.startsWith("R' U' F") && text.endsWith("R' U' F"));
  }
});

test('event account disabling and overlapping requests discard stale generation', async () => {
  const pending: ((text: string) => void)[] = [];
  const controller = new Scrambles(() => {}, () => new Promise(resolve => pending.push(resolve)));
  controller.configure(1,'3x3',false);
  assert.equal(pending.length,0);
  controller.configure(1,'3x3',true);
  assert.equal(controller.canStart,false);
  controller.configure(1,'fto',true);
  pending[0]('old 333');
  await Promise.resolve();
  assert.equal(controller.text,'');
  pending[1]('U BL');
  await Promise.resolve();
  assert.equal(controller.text,'U BL');
  const replacement = controller.replace();
  controller.configure(2,'3x3',true);
  pending[2]('old account');
  await replacement;
  assert.equal(controller.text,'');
  controller.configure(2,'3x3',false);
  pending[3]('disabled');
  await Promise.resolve();
  assert.equal(controller.status,'off');
  assert.equal(controller.capture(),null);
});

test('capture at timer start preserves event and text while generating the next scramble', async () => {
  let text = "R U' F2";
  const controller = new Scrambles(() => {}, async () => text);
  controller.configure(1,'3x3',true);
  await Promise.resolve();
  const timer = new SolveTimer();
  timer.prepare(0); timer.release(400);
  const snapshot = controller.capture()!;
  assert.equal(timer.state,'RUNNING');
  assert.ok(Object.isFrozen(snapshot));
  timer.stop(1200);
  text = 'B L2';
  await controller.replace();
  assert.deepEqual(snapshot,{event:'3x3',text:"R U' F2"});
  assert.equal(controller.text,'B L2');
  controller.configure(1,'3x3',false);
  assert.equal(controller.capture(),null);
});

test('generation failure prevents starting and permits an explicit retry', async () => {
  let fail = true;
  const controller = new Scrambles(() => {}, async () => { if (fail) throw new Error('worker failed'); return 'R U'; });
  controller.configure(1,'3x3',true);
  await Promise.resolve();
  assert.equal(controller.status,'failed');
  assert.equal(controller.canStart,false);
  assert.throws(() => controller.capture());
  fail = false;
  await controller.replace();
  assert.equal(controller.canStart,true);
});
