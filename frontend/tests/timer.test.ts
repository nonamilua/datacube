import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { SolveTimer, formatTime } from '../src/timer/timer.ts';

test('early release cancels; threshold release starts without a rendered frame', () => {
  const timer = new SolveTimer();
  timer.prepare(100);
  timer.release(499);
  assert.equal(timer.state, 'IDLE');
  timer.prepare(500);
  timer.release(900);
  assert.equal(timer.state, 'RUNNING');
  const solve = timer.stop(2134.6)!;
  assert.equal(solve.duration_ms, 1235);
  assert.ok(solve.started_at.endsWith('Z'));
  assert.equal(timer.stop(2500), null);
});

test('cancelled preparation preserves previous result and stopped state', () => {
  const timer = new SolveTimer();
  timer.prepare(0);
  timer.release(400);
  timer.stop(1400);
  timer.prepare(2000);
  timer.update(2400);
  assert.equal(timer.state, 'READY');
  timer.cancelPreparation();
  assert.equal(timer.state, 'STOPPED');
  assert.equal(timer.elapsed(5000), 1000);
});

test('elapsed time follows clock even when animation frames do not run', () => {
  const timer = new SolveTimer();
  timer.prepare(0);
  timer.release(400);
  assert.equal(timer.elapsed(60400), 60000);
  assert.equal(timer.stop(60400)?.duration_ms, 60000);
});

test('formats seconds and minute boundaries without rounding up', () => {
  assert.equal(formatTime(0), '0.00');
  assert.equal(formatTime(59999), '59.99');
  assert.equal(formatTime(60000), '1:00.00');
  assert.equal(formatTime(123456), '2:03.45');
});

test('account reset clears the last solve and cancelled preparation cannot restore it', () => {
  const timer = new SolveTimer();
  timer.prepare(0);
  timer.release(400);
  const saved = timer.stop(1400)!;
  timer.prepare(2000);
  timer.reset();
  timer.cancelPreparation();
  assert.equal(timer.state, 'IDLE');
  assert.equal(formatTime(timer.elapsed(3000)), '0.00');
  assert.equal(saved.duration_ms, 1000);
  timer.prepare(3000);
  timer.release(3400);
  assert.equal(timer.stop(3900)?.duration_ms, 500);
});
