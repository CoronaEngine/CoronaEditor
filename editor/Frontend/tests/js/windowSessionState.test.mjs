import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';
import { createWindowSessionState } from '../../src/services/windowSessionState.js';

function documents(t) {
  const owner = crypto.randomUUID();
  const messages = ['main', 'a', 'b'].map((id, index) => createWebMessages({
    scope: owner, documentId: id, role: index ? 'peer' : 'main', getGeneration: () => 'world',
  }));
  const states = messages.map((message, index) => createWindowSessionState(message, {
    owner, main: index === 0, generation: 'world',
  }));
  t.after(() => { states.forEach(state => state.dispose()); messages.forEach(message => message.dispose()); });
  states[0].write({ owner, revision: 1, generation: 'world', enabled: true, records: [] });
  const record = id => ({ owner, id, generation: 'world', status: 'pending', kind: 'panel' });
  return { states, messages, owner, record };
}

test('concurrent Dock record operations are merged by the main owner', async t => {
  const { states: [main, a, b], record } = documents(t);
  await Promise.all([a.hydrate(), b.hydrate()]);
  await Promise.all([a.saveRecord(record('a')), b.saveRecord(record('b'))]);
  await delay(30);
  for (const state of [main, a, b]) assert.deepEqual(state.read().records.map(item => item.id).sort(), ['a', 'b']);
  await Promise.all([a.removeRecord(record('a')), b.saveRecord({ ...record('b'), status: 'ready' })]);
  await delay(30);
  for (const state of [main, a, b]) assert.deepEqual(state.read().records, [{ ...record('b'), status: 'ready' }]);
});

test('only main can replace policy and peer snapshots cannot overwrite it', async t => {
  const { states: [main, a], messages: [, peer] } = documents(t);
  await a.hydrate();
  assert.throws(() => a.write({ ...a.read(), enabled: false }), /main|主窗口/);
  await peer.emit('windowSession.stateChanged', { ...a.read(), enabled: false, records: [] });
  await delay(30);
  assert.equal(main.read().enabled, true);
});

test('policy notifications ignore record-only changes and use the published policy topic', async t => {
  const { states: [main, a], messages: [, peer], record } = documents(t);
  await a.hydrate();
  const policies = [];
  peer.on('windowSession.policyChanged', value => policies.push(value));
  await a.saveRecord(record('a'));
  main.write({ ...main.read(), enabled: false });
  await delay(30);
  assert.equal(policies.length, 1);
  assert.equal(policies[0].enabled, false);
  assert.equal(a.read().enabled, false);
});

test('a retired child cannot insert records and late snapshots do not roll state back', async t => {
  const { states: [main, a], messages: [owner], record } = documents(t);
  await a.hydrate();
  const stale = a.read();
  main.write({ ...main.read(), enabled: false });
  await delay(30);
  await assert.rejects(a.saveRecord(record('late')), /CONTEXT_CHANGED/);
  await owner.emit('windowSession.stateChanged', stale);
  await delay(30);
  assert.equal(a.read().enabled, false);
  assert.deepEqual(main.read().records, []);
});
