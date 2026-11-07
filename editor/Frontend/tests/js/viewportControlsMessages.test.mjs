import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createWebMessages } from '../../src/api/webMessages.js';

const url = new URL('../../src/services/viewportControlsService.js', import.meta.url);
const service = existsSync(url) ? await import(url) : {};
function setup(t) {
  assert.equal(typeof service.createViewportControlsService, 'function');
  const scope = crypto.randomUUID();
  const mainMessages = createWebMessages({ scope, role: 'main', documentId: 'main' });
  const dockMessages = createWebMessages({ scope, documentId: 'settings' });
  const main = service.createViewportControlsService(mainMessages);
  const dock = service.createViewportControlsService(dockMessages);
  t.after(() => { mainMessages.dispose(); dockMessages.dispose(); });
  return { main, dock };
}

test('Dock reads and changes main viewport controls using typed Web requests only', async t => {
  const { main, dock } = setup(t);
  const state = { available: true, sceneId: 'scene', cameraId: 'camera', cameraHandle: '18446744073709551615', cameraSpeed: 1 };
  const updates = [];
  const unsubscribe = dock.subscribe(value => updates.push(value));
  t.after(unsubscribe);
  const stop = main.provide({ snapshot: () => state, isCurrent: () => true,
    actions: { setCameraSpeed: payload => { state.cameraSpeed = payload.value; } } });
  t.after(stop);
  const snapshot = await dock.request({ action: 'getState' });
  assert.deepEqual(snapshot, state);
  assert.equal((await dock.request({ ...snapshot, action: 'setCameraSpeed', value: 2 })).cameraSpeed, 2);
  for (let i = 0; i < 30 && !updates.length; i++) await delay(5);
  assert.equal(updates.at(-1).cameraSpeed, 2);
});

test('queued viewport writes recheck camera identity and never touch the replacement camera', async t => {
  const { main, dock } = setup(t);
  const state = { available: true, sceneId: 'scene', cameraId: 'first', cameraHandle: 'first', cameraSpeed: 1 };
  let release;
  const calls = [];
  t.after(main.provide({ snapshot: () => state, isCurrent: () => true, actions: {
    setCameraSpeed: async payload => { calls.push(payload.value); if (payload.value === 2) await new Promise(resolve => { release = resolve; }); },
  } }));
  const first = dock.request({ ...state, action: 'setCameraSpeed', value: 2 });
  for (let i = 0; i < 30 && !release; i++) await delay(5);
  const next = dock.request({ ...state, action: 'setCameraSpeed', value: 3 });
  const rejected = assert.rejects(next, { code: 'STALE_CAMERA' });
  state.cameraId = 'replacement'; state.cameraHandle = 'replacement';
  release();
  await first; await rejected;
  assert.deepEqual(calls, [2]);
});

test('unmounted viewport owner rejects further mutations and reports unknown actions', async t => {
  const { main, dock } = setup(t);
  const state = { available: true, sceneId: 's', cameraId: 'c', cameraHandle: '1' };
  const stop = main.provide({ snapshot: () => state, isCurrent: () => true, actions: {} });
  await assert.rejects(dock.request({ ...state, action: 'notAllowed' }), { code: 'METHOD_NOT_FOUND' });
  stop();
  await assert.rejects(dock.request({ action: 'getState' }), { code: 'METHOD_NOT_FOUND' });
});
