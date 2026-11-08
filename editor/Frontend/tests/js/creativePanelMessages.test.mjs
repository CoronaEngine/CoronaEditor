import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';
globalThis.window = {};
const creative = await import('../../src/services/creativePanelState.js');

function fixture(t) {
  assert.equal(typeof creative.createCreativePanelProvider, 'function');
  assert.equal(typeof creative.createCreativePanelClient, 'function');
  const scope = crypto.randomUUID();
  const main = createWebMessages({ scope, role: 'main' });
  const dock = createWebMessages({ scope });
  const state = { sceneId: 'scene', cameraId: 'camera', cameraHandle: '18446744073709551615', available: true, speed: 1 };
  t.after(() => { main.dispose(); dock.dispose(); });
  return { main, dock, state };
}

test('creative controls use the same request path locally and across documents', async t => {
  const { main, dock, state } = fixture(t);
  let calls = 0;
  const provider = creative.createCreativePanelProvider(main, { snapshot: () => state, isCurrent: () => true,
    actions: { speed: value => { calls++; state.speed = value; } } });
  const local = creative.createCreativePanelClient(main), remote = creative.createCreativePanelClient(dock);
  t.after(() => { local.dispose(); remote.dispose(); provider.dispose(); });
  await Promise.all([local.ready, remote.ready]);
  assert.equal((await local.act('speed', 2)).speed, 2);
  assert.equal((await remote.act('speed', 3)).speed, 3);
  assert.equal(calls, 2);
});

test('queued actions recheck camera identity and propagate errors without replay', async t => {
  const { main, dock, state } = fixture(t);
  let release;
  const calls = [];
  const provider = creative.createCreativePanelProvider(main, { snapshot: () => state, isCurrent: () => true,
    actions: { speed: async value => { calls.push(value); await new Promise(resolve => { release = resolve; }); } } });
  t.after(() => provider.dispose());
  const payload = { ...state, action: 'speed', args: [1] };
  const first = dock.request('main', 'creative.controls', payload);
  const second = dock.request('main', 'creative.controls', { ...payload, args: [2] });
  const rejected = assert.rejects(second, { code: 'STALE_CAMERA' });
  for (let i = 0; i < 20 && !release; i++) await delay(5);
  assert.equal(typeof release, 'function');
  state.cameraHandle = 'new-camera';
  release();
  await first;
  await rejected;
  assert.deepEqual(calls, [1]);
});

test('a notification overtaking the initial snapshot cannot be overwritten by the older reply', async t => {
  const { main, dock, state } = fixture(t);
  let notifyDuringRead = true;
  const provider = creative.createCreativePanelProvider(main, {
    snapshot: () => {
      if (notifyDuringRead) {
        notifyDuringRead = false;
        queueMicrotask(() => { state.speed = 2; void provider.notify(); });
      }
      return state;
    },
    actions: {}, isCurrent: () => true,
  });
  const seen = [];
  const client = creative.createCreativePanelClient(dock, { receive: value => seen.push(value.speed) });
  t.after(() => { client.dispose(); provider.dispose(); });
  await client.ready;
  await delay(20);
  assert.equal(seen.at(-1), 2);
  assert.ok(!seen.includes(1));
});

test('missing creative owner fails explicitly and disposal cancels readiness', async t => {
  const { dock } = fixture(t);
  const client = creative.createCreativePanelClient(dock, { readyTimeoutMs: 80 });
  await assert.rejects(client.ready, { code: 'METHOD_NOT_FOUND' });
  client.dispose();
  const waiting = creative.createCreativePanelClient(dock);
  const rejected = assert.rejects(waiting.ready, { code: 'ABORTED' });
  waiting.dispose();
  await rejected;
});

test('a stale provider notification rejects asynchronously for lifecycle callers', async t => {
  const { main, state } = fixture(t);
  const provider = creative.createCreativePanelProvider(main, { snapshot: () => state, actions: {}, isCurrent: () => false });
  t.after(() => provider.dispose());
  let notification;
  assert.doesNotThrow(() => { notification = provider.notify(); });
  await assert.rejects(notification, { code: 'CONTEXT_CHANGED' });
});

test('typed snapshots are isolated and failed writes do not poison the following action', async t => {
  const { main, dock, state } = fixture(t);
  state.bytes = new Uint8Array([1, 2, 3]);
  const calls = [];
  const provider = creative.createCreativePanelProvider(main, { snapshot: () => state, isCurrent: () => true,
    actions: { speed: value => { calls.push(value); if (value < 0) throw new Error('invalid speed'); state.speed = value; } } });
  const client = creative.createCreativePanelClient(dock);
  t.after(() => { client.dispose(); provider.dispose(); });
  const snapshot = await client.ready;
  snapshot.bytes[0] = 99;
  assert.equal(state.bytes[0], 1);
  await assert.rejects(client.act('speed', -1), { code: 'REMOTE_ERROR', message: 'invalid speed' });
  assert.equal((await client.act('speed', 5)).speed, 5);
  assert.deepEqual(calls, [-1, 5]);
});

test('disposing a provider invalidates queued writes and suppresses late notifications', async t => {
  const { main, dock, state } = fixture(t);
  let release;
  const calls = [], notifications = [];
  dock.on('creative-controls-state', value => notifications.push(value));
  const provider = creative.createCreativePanelProvider(main, { snapshot: () => state, isCurrent: () => true,
    actions: { speed: async value => { calls.push(value); await new Promise(resolve => { release = resolve; }); } } });
  t.after(() => provider.dispose());
  const payload = { ...state, action: 'speed', args: [1] };
  const first = dock.request('main', 'creative.controls', payload);
  const second = dock.request('main', 'creative.controls', { ...payload, args: [2] });
  const rejected = Promise.all([assert.rejects(first, { code: 'CONTEXT_CHANGED' }),
    assert.rejects(second, { code: 'CONTEXT_CHANGED' })]);
  for (let i = 0; i < 20 && !release; i++) await delay(5);
  assert.equal(typeof release, 'function');
  await delay(20);
  provider.dispose();
  release();
  await rejected;
  assert.deepEqual(calls, [1]);
  assert.deepEqual(notifications, []);
});

for (const role of ['local', 'dock']) {
  test(`creative state versions survive provider remount in the same document for ${role}`, async t => {
    const { main, dock, state } = fixture(t);
    const options = { snapshot: () => state, isCurrent: () => true,
      actions: { speed: value => { state.speed = value; } } };
    const previous = creative.createCreativePanelProvider(main, options);
    const seen = [];
    const client = creative.createCreativePanelClient(role === 'local' ? main : dock,
      { receive: value => seen.push(value.speed) });
    t.after(() => { client.dispose(); previous.dispose(); });
    await client.ready;
    await client.act('speed', 2); await client.act('speed', 3); await client.act('speed', 4);
    previous.dispose();
    const replacement = creative.createCreativePanelProvider(main, options);
    t.after(() => replacement.dispose());
    assert.equal((await client.act('speed', 5)).speed, 5);
    assert.equal(seen.at(-1), 5);
  });
}
