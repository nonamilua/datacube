import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FixedTags } from '../src/fixed-tags.ts';

test('fixed tags reuse confirmed custom edits only for the active event and clear on removal', () => {
  const tags = new FixedTags();
  tags.configure(1, 3, false);
  tags.remember(3, 't perm', tags.version);
  assert.equal(tags.value, null);
  tags.configure(1, 3, true);
  tags.remember(3, 't perm', tags.version);
  assert.equal(tags.value, 't perm');
  tags.configure(1, 3, true); // Ordinary settings updates preserve the active tag.
  tags.remember(4, 'other', tags.version);
  assert.equal(tags.value, 't perm');
  tags.remember(3, 'j perm', tags.version);
  assert.equal(tags.value, 'j perm');
  tags.remember(3, null, tags.version);
  assert.equal(tags.value, null);
});

test('event changes disabling and logout clear tags and reject stale edit confirmations', () => {
  const tags = new FixedTags();
  tags.configure(1, 3, true);
  tags.remember(3, 'cross', tags.version);
  const previousEvent = tags.version;
  tags.configure(1, 4, true);
  assert.equal(tags.value, null);
  tags.configure(1, 3, true);
  tags.remember(3, 'stale', previousEvent);
  assert.equal(tags.value, null);
  tags.remember(3, 'pll', tags.version);
  const previousSwitch = tags.version;
  tags.configure(1, 3, false);
  tags.configure(1, 3, true);
  tags.remember(3, 'stale', previousSwitch);
  assert.equal(tags.value, null);
  tags.remember(3, 'oll', tags.version);
  const previousAccount = tags.version;
  tags.configure(null, null, false);
  tags.configure(2, 3, true);
  tags.remember(3, 'stale', previousAccount);
  assert.equal(tags.value, null);
  tags.configure(1, 3, true);
  assert.equal(tags.value, null);
});
