import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindControls } from '../src/timer/controls.ts';
import { SolveTimer } from '../src/timer/timer.ts';
import { Scrambles } from '../src/scrambles.ts';

test('keyboard controls gate loading and capture only after a full hold then save the captured scramble', async context => {
  class Button extends EventTarget {
    disabled = false;
    closest() { return null; }
    setAttribute() {}
  }
  const windowTarget = new EventTarget();
  const documentTarget = new EventTarget();
  Object.assign(globalThis, {window:windowTarget, document:documentTarget, Element:Button, HTMLButtonElement:Button});
  let now = 0;
  context.mock.method(performance, 'now', () => now);
  const requests: ((text:string) => void)[] = [];
  const scrambles = new Scrambles(() => {}, () => new Promise(resolve => requests.push(resolve)));
  const timer = new SolveTimer();
  let snapshot: ReturnType<Scrambles['capture']> = null;
  let saved: {duration_ms:number; scramble:string | null} | undefined;
  const key = (type:string, code:string, key:string) => windowTarget.dispatchEvent(Object.assign(new Event(type, {cancelable:true}), {code,key}));
  bindControls(timer, new Button() as unknown as HTMLElement, solve => {
    saved = {duration_ms:solve.duration_ms, scramble:snapshot?.text ?? null};
    void scrambles.replace();
  }, {canPrepare:() => scrambles.canStart, onStart:() => {snapshot = scrambles.capture();}});
  scrambles.configure(1,'3x3',true);
  key('keydown','Space',' ');
  assert.equal(timer.state,'IDLE');
  requests[0]("R U' F2");
  await Promise.resolve();
  key('keydown','Space',' ');
  now = 399;
  key('keyup','Space',' ');
  assert.equal(timer.state,'IDLE');
  assert.equal(snapshot,null);
  now = 1000;
  key('keydown','Space',' ');
  now = 1400;
  key('keyup','Space',' ');
  assert.equal(timer.state,'RUNNING');
  assert.deepEqual(snapshot,{event:'3x3',text:"R U' F2"});
  now = 3000;
  key('keydown','KeyA','a');
  assert.deepEqual(saved,{duration_ms:1600,scramble:"R U' F2"});
  assert.equal(scrambles.status,'loading');
  requests[1]('B L2');
  await Promise.resolve();
  assert.equal(saved?.scramble,"R U' F2");
  assert.equal(scrambles.text,'B L2');
  scrambles.configure(1,'3x3',false);
  now = 4000;
  key('keydown','Space',' ');
  now = 4400;
  key('keyup','Space',' ');
  assert.equal(snapshot,null);
  now = 5400;
  key('keydown','Space',' ');
  assert.deepEqual(saved,{duration_ms:1000,scramble:null});
});
