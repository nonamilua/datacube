import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hitsBox } from '../src/analytics/box-hit.ts';

test('only the filled interquartile rectangle is interactive',() => {
  const box = {left:30,right:60,top:17,bottom:33};
  for (const [x,y] of [[30,17],[60,33],[45,25]]) assert.equal(hitsBox(box,x,y),true);
  // Whiskers, outliers, labels and empty space in the same row stay inactive.
  for (const [x,y] of [[20,25],[70,25],[90,25],[45,11],[45,34]]) assert.equal(hitsBox(box,x,y),false);
});
test('zero and nearly zero widths get only eight pixels of horizontal tolerance',() => {
  for (const width of [0,1,3]) {
    const box = {left:50,right:50+width,top:17,bottom:33};
    const center = 50 + width/2;
    assert.equal(hitsBox(box,center-4,25),true);
    assert.equal(hitsBox(box,center+4,25),true);
    assert.equal(hitsBox(box,center-5,25),false);
    assert.equal(hitsBox(box,center+5,25),false);
    assert.equal(hitsBox(box,center,16),false);
  }
});
