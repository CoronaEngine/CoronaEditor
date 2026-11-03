import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setImmediate } from 'node:timers/promises';

// Exercise the owner independently of the per-document Vue/CEF adapter.
const source = fs.readFileSync(new URL('../../src/services/creativePanelState.js', import.meta.url), 'utf8');
const createOwner = new Function(`const clone = value => JSON.parse(JSON.stringify(value));
  ${source.slice(source.indexOf('export function createCreativePanelOwner'), source.indexOf('export function provideCreativePanelState')).replace('export ', '')}
  return createCreativePanelOwner;`)();
function fixture(actions = {}) {
  const state = { sceneId: 'scene', cameraId: 'main', cameraHandle: 12, available: true, speed: 1 };
  const published = [], errors = [];
  const owner = createOwner({ snapshot: () => state, actions, isCurrent: () => state.current !== false,
    publish: next => published.push(next), reportError: error => errors.push(error) });
  return { state, owner, published, errors,
    request: (action, ...args) => ({ ...state, action, args }) };
}
test('controls publish detached snapshots and edit the current main camera', async () => {
  const f = fixture({ speed: async value => { f.state.speed = value; } });
  let observed;
  const unsubscribe = f.owner.subscribe(value => { observed = value; });
  observed.speed = 99;
  assert.equal(f.state.speed, 1);
  assert.equal(await f.owner.act(f.request('speed', 0.5)), true);
  assert.equal(observed.speed, 0.5);
  assert.equal(f.published.at(-1).speed, 0.5);
  unsubscribe(); f.owner.dispose();
});
test('stale camera handles, unavailable scenes and unknown actions cannot write', async () => {
  let calls = 0;
  const f = fixture({ write: async () => { calls++; } });
  const stale = f.request('write');
  f.state.cameraHandle++;
  assert.equal(await f.owner.act(stale), false);
  f.state.available = false;
  assert.equal(await f.owner.act(f.request('write')), false);
  f.state.available = true;
  assert.equal(await f.owner.act(f.request('toString')), false);
  assert.equal(calls, 0);
});
test('queued writes execute in order and recheck the camera before each write', async () => {
  let release;
  const calls = [];
  const f = fixture({ write: async value => {
    calls.push(value);
    if (value === 1) await new Promise(resolve => { release = resolve; });
  } });
  const first = f.owner.act(f.request('write', 1));
  const second = f.owner.act(f.request('write', 2));
  await setImmediate();
  assert.deepEqual(calls, [1]);
  f.state.cameraId = 'replacement';
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.deepEqual(calls, [1]);
});
test('teardown drops queued commands and late completion broadcasts', async () => {
  let release;
  const calls = [];
  const f = fixture({ write: async value => {
    calls.push(value);
    await new Promise(resolve => { release = resolve; });
  } });
  const first = f.owner.act(f.request('write', 1));
  const second = f.owner.act(f.request('write', 2));
  await setImmediate();
  f.owner.dispose(); release();
  await Promise.all([first, second]);
  assert.deepEqual(calls, [1]);
  assert.deepEqual(f.published, []);
});
test('a failed write reports its error without poisoning subsequent commands', async () => {
  const f = fixture({ fail: async () => { throw new Error('write failed'); }, speed: async n => { f.state.speed = n; } });
  assert.equal(await f.owner.act(f.request('fail')), false);
  assert.deepEqual(f.errors, ['write failed']);
  assert.equal(await f.owner.act(f.request('speed', 0.7)), true);
  assert.equal(f.state.speed, 0.7);
  f.state.current = false;
  assert.equal(await f.owner.act(f.request('speed', 2)), false);
});
