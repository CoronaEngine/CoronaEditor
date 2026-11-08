import assert from 'node:assert/strict';
import { test } from 'node:test';

// WNC-004: editorApi.window named wrapper + centralized capability probe.
// Every window binding from the frozen 86-entry contract (WNC-001 record)
// must be reachable through the facade with passthrough semantics.

const WINDOW_METHODS = [
  'getCurrent', 'setDragRegions', 'close', 'closeTab', 'focusTab', 'createPanel',
  'createCameraView', 'detachPanel', 'redockPanel', 'suspendCameraViews',
  'closeCameraView', 'toggleCameraMaximized', 'cycleCameraWindowMode',
  'toggleCameraBorderless', 'resizeCameraView', 'toggleMainBorderless',
];
const WINDOW_EVENTS = ['onClosed', 'onCloseRequested'];

function withNativeWindow(t, native) {
  const previous = globalThis.window;
  globalThis.window = { corona: { window: native } };
  t.after(() => { globalThis.window = previous; });
}

test('the facade exposes a window namespace with every named binding', async () => {
  const { editorApi } = await import(`../../src/api/editorApi.js?window-ns=${Date.now()}`);
  for (const name of [...WINDOW_METHODS, ...WINDOW_EVENTS]) {
    assert.equal(typeof editorApi.window?.[name], 'function', `editorApi.window.${name} missing`);
  }
});

test('window wrapper passes options and arguments through unchanged', async t => {
  const calls = [];
  const native = {
    createPanel: async options => { calls.push(['createPanel', options]); return { tab_id: 1 }; },
    resizeCameraView: async (...args) => { calls.push(['resizeCameraView', ...args]); return true; },
    setDragRegions: async regions => { calls.push(['setDragRegions', regions]); return {}; },
  };
  withNativeWindow(t, native);
  const { editorApi } = await import(`../../src/api/editorApi.js?window-passthrough=${Date.now()}`);
  const options = { panelId: 'inspector', routePath: '/Inspector' };
  assert.deepEqual(await editorApi.window.createPanel(options), { tab_id: 1 });
  assert.equal(calls[0][1], options);
  await editorApi.window.resizeCameraView(800, 600, 'scene', 'camera');
  assert.deepEqual(calls[1], ['resizeCameraView', 800, 600, 'scene', 'camera']);
  const regions = [{ x: 1, y: 2, w: 30, h: 10 }];
  await editorApi.window.setDragRegions(regions);
  assert.equal(calls[2][1], regions);
});

test('window wrapper propagates native errors unchanged', async t => {
  const failure = Object.assign(new Error('retired window'), { code: 'CONTEXT_CHANGED' });
  withNativeWindow(t, { close: () => Promise.reject(failure) });
  const { editorApi } = await import(`../../src/api/editorApi.js?window-errors=${Date.now()}`);
  await assert.rejects(editorApi.window.close(), error => error === failure);
});

test('window event subscriptions return the native unsubscribe function', async t => {
  const stop = () => {};
  const seen = [];
  const native = {
    onClosed: cb => { seen.push(cb); return stop; },
    onCloseRequested: cb => { seen.push(cb); return stop; },
  };
  withNativeWindow(t, native);
  const { editorApi } = await import(`../../src/api/editorApi.js?window-events=${Date.now()}`);
  const closed = () => {}, requested = () => {};
  assert.equal(editorApi.window.onClosed(closed), stop);
  assert.equal(editorApi.window.onCloseRequested(requested), stop);
  assert.deepEqual(seen, [closed, requested]);
});

test('the facade centralizes suspend-camera capability probing', async t => {
  withNativeWindow(t, {});
  const absent = await import(`../../src/api/editorApi.js?window-probe=${Date.now()}`);
  assert.equal(absent.editorApi.window.canSuspendCameraViews(), false);
  withNativeWindow(t, { suspendCameraViews: () => {} });
  const present = await import(`../../src/api/editorApi.js?window-probe2=${Date.now()}`);
  assert.equal(present.editorApi.window.canSuspendCameraViews(), true);
});

test('the facade exposes the native window presence probe', async t => {
  withNativeWindow(t, undefined);
  const absent = await import(`../../src/api/editorApi.js?window-presence=${Date.now()}`);
  assert.equal(absent.editorApi.window.hasWindowBindings(), false);
  withNativeWindow(t, { getCurrent: () => {} });
  const present = await import(`../../src/api/editorApi.js?window-presence2=${Date.now()}`);
  assert.equal(present.editorApi.window.hasWindowBindings(), true);
});
