import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';

const policyUrl = new URL('../../src/blockly/utils/saveRetryPolicy.js', import.meta.url);

test('failed save remains dirty without scheduling an automatic retry', async () => {
  assert.equal(existsSync(policyUrl), true, 'save retry policy module must exist');
  const { nextSaveAction } = await import(policyUrl);
  assert.equal(nextSaveAction({ session: 'A1', currentSession: 'A1', succeeded: false, saveQueued: true, graphDirty: true }), 'idle');
});

test('successful save drains edits queued while the request was in flight', async () => {
  assert.equal(existsSync(policyUrl), true, 'save retry policy module must exist');
  const { nextSaveAction } = await import(policyUrl);
  assert.equal(nextSaveAction({ session: 'A1', currentSession: 'A1', succeeded: true, saveQueued: true, graphDirty: true }), 'resave');
  assert.equal(nextSaveAction({ session: 'A1', currentSession: 'A1', succeeded: true, saveQueued: false, graphDirty: false }), 'idle');
});

test('reopening the same directory cannot retry edits from the previous session', async () => {
  const { nextSaveAction } = await import(policyUrl);
  assert.equal(nextSaveAction({ session: 'A1', currentSession: 'A2', succeeded: true, saveQueued: true }), 'idle');
});
