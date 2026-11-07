import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createViewportUiPointerController } from '../../src/utils/viewportUiMode.js';

function fixture(t, overrides = {}) {
  const previous = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  const frames = new Map(), calls = [], errors = [];
  let sequence = 0;
  globalThis.requestAnimationFrame = fn => { frames.set(++sequence, fn); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  t.after(() => Object.assign(globalThis, previous));
  const binding = { sceneId: 'scene.ini', cameraId: '18446744073709551615', archiveSession: 'archive' };
  const controller = createViewportUiPointerController({
    api: { configure: async (...args) => { calls.push(args); return {}; } }, getBinding: () => binding,
    getHitRect: () => ({ left: 10, top: 20, width: 100, height: 50 }),
    getRenderRect: () => ({ left: 10, top: 20, width: 100, height: 50, renderWidth: 200, renderHeight: 100 }),
    getEnabled: () => true, getNativeCursorEnabled: () => true, onError: error => errors.push(error), ...overrides,
  });
  return { controller, calls, binding, errors, flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); } };
}

test('native pointer coalesces movement into the same scoped configuration without JSON or numeric handles', async t => {
  const h = fixture(t);
  const parse = JSON.parse, stringify = JSON.stringify;
  t.after(() => { JSON.parse = parse; JSON.stringify = stringify; });
  JSON.parse = JSON.stringify = () => { throw Error('JSON transport forbidden'); };
  assert.equal(h.controller.send({ clientX: 20, clientY: 30 }, 'pointermove'), true);
  assert.equal(h.controller.send({ clientX: 35, clientY: 35 }, 'pointermove', 'grabbing'), true);
  assert.deepEqual(h.calls, []);
  h.flush();
  assert.deepEqual(h.calls, [['scene.ini', '18446744073709551615', { archive_session: 'archive',
    pointer: { x: 50, y: 30, cursor: 'grabbing' } }]]);
  assert.equal(h.controller.hide(), true);
  assert.deepEqual(h.calls.at(-1)[2], { archive_session: 'archive', pointer: { cursor: 'hidden' } });
  await Promise.resolve();
  assert.deepEqual(h.errors, []);
});

test('pointer leave cancels pending movement and hides the last submitted camera rather than the replacement binding', t => {
  const h = fixture(t);
  h.controller.send({ clientX: 20, clientY: 30 }, 'pointerdown', 'hand');
  h.controller.send({ clientX: 40, clientY: 40 }, 'pointermove');
  h.binding.cameraId = 'replacement'; h.binding.archiveSession = 'replacement-archive';
  assert.equal(h.controller.hide(), true);
  h.flush();
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls[1], ['scene.ini', '18446744073709551615', { archive_session: 'archive', pointer: { cursor: 'hidden' } }]);
  assert.equal(h.controller.hide(), false);
});

test('rebind retires the old pointer before submitting a new identity and never reuses a numeric handle', t => {
  const h = fixture(t);
  h.controller.send({ clientX: 20, clientY: 30 }, 'pointerdown');
  h.binding.archiveSession = 'next';
  h.controller.send({ clientX: 30, clientY: 40 }, 'pointerdown');
  assert.deepEqual(h.calls.map(call => call[2]), [
    { archive_session: 'archive', pointer: { x: 20, y: 20, cursor: 'arrow' } },
    { archive_session: 'archive', pointer: { cursor: 'hidden' } },
    { archive_session: 'next', pointer: { x: 40, y: 40, cursor: 'arrow' } },
  ]);
});

test('disabled or unbound native pointer never hides the system cursor or calls an old bridge', t => {
  for (const overrides of [{ getNativeCursorEnabled: () => false }, { getEnabled: () => false },
    { getBinding: () => ({ sceneId: 'scene.ini', cameraId: 'camera' }) }]) {
    const h = fixture(t, overrides);
    assert.equal(h.controller.send({ clientX: 20, clientY: 30 }, 'pointerdown'), false);
    h.flush(); h.controller.dispose();
    assert.deepEqual(h.calls, []);
  }
});

test('native pointer errors are reported once without fallback or automatic replay', async t => {
  const failure = Object.assign(Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  let attempts = 0;
  const h = fixture(t, { api: { configure: async () => { attempts++; throw failure; } } });
  h.controller.send({ clientX: 20, clientY: 30 }, 'pointerdown');
  await setImmediate();
  assert.equal(attempts, 1);
  assert.deepEqual(h.errors, [failure]);
});

test('a queued pointer frame rechecks enablement and cannot revive a disposed controller', t => {
  let enabled = true;
  const h = fixture(t, { getEnabled: () => enabled });
  h.controller.send({ clientX: 20, clientY: 30 }, 'pointermove');
  enabled = false;
  h.flush();
  assert.deepEqual(h.calls, []);
  enabled = true;
  h.controller.dispose();
  assert.equal(h.controller.send({ clientX: 20, clientY: 30 }, 'pointerdown'), false);
  assert.deepEqual(h.calls, []);
});

test('movement keeps only the latest unsent state while a native update is in flight', async t => {
  const calls = [];
  let release;
  const h = fixture(t, { api: { configure: (...args) => {
    calls.push(args);
    return calls.length === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve({});
  } } });
  h.controller.send({ clientX: 20, clientY: 30 }, 'pointermove'); h.flush();
  for (const x of [25, 30, 35]) { h.controller.send({ clientX: x, clientY: 30 }, 'pointermove'); h.flush(); }
  assert.equal(calls.length, 1, 'slow native completion must not create an unbounded task/promise queue');
  release({}); await setImmediate(); h.flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1][2].pointer.x, 50, 'only the latest unsent coordinate is submitted once');
});
