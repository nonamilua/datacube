import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editorAnchor } from '../src/solve-editor.ts';

test('timer and history pencils retain their own anchor for the same solve', () => {
  const timer = {isConnected:true, dataset:{solveId:'solve'}} as unknown as HTMLButtonElement;
  const history = {isConnected:true, dataset:{solveId:'solve'}} as unknown as HTMLButtonElement;
  // Reproduce both DOM orderings that previously closed the timer popup.
  assert.equal(editorAnchor(timer, [history,timer], 'solve'), timer);
  assert.equal(editorAnchor(history, [timer,history], 'solve'), history);
  const removed = {isConnected:false} as HTMLButtonElement;
  assert.equal(editorAnchor(removed, [timer], 'solve'), timer);
});
