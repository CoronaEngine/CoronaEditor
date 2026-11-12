import assert from 'node:assert/strict';
import { test } from 'node:test';

// editorApi.window named wrapper + centralized capability probe.
// Every native window binding must be reachable through the facade with
// passthrough semantics. Native merged its duplicated verbs (panel kind, window
// presentation, close identity) and leaves panel placement to ImGui, so that is
// the shape to pin.

const WINDOW_METHODS = [
  'close', 'focus', 'createPanel', 'setWindowPresentation',
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

test('window wrapper passes each identity through unchanged', async t => {
  const calls = [];
  const native = {
    createPanel: async options => { calls.push(['createPanel', options]); return { tab_id: 1 }; },
    close: async identity => { calls.push(['close', identity]); return { closed: 1 }; },
    focus: async identity => { calls.push(['focus', identity]); return true; },
  };
  withNativeWindow(t, native);
  const { editorApi } = await import(`../../src/api/editorApi.js?window-passthrough=${Date.now()}`);
  const options = { panelId: 'inspector', routePath: '/Inspector' };
  assert.deepEqual(await editorApi.window.createPanel(options), { tab_id: 1 });
  assert.equal(calls[0][1], options);
  await editorApi.window.close({ panelId: 'inspector' });
  assert.deepEqual(calls[1], ['close', { panelId: 'inspector' }]);
  await editorApi.window.focus({ panelId: 'inspector' });
  assert.deepEqual(calls[2], ['focus', { panelId: 'inspector' }]);
  // No argument is how the facade says "this window"; it must not send undefined.
  await editorApi.window.close();
  assert.deepEqual(calls[3], ['close', undefined]);
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

test('the facade exposes one native window presence probe', async t => {
  withNativeWindow(t, undefined);
  const absent = await import(`../../src/api/editorApi.js?window-presence=${Date.now()}`);
  assert.equal(absent.editorApi.window.hasWindowBindings(), false);
  // Both halves matter: retiring windows needs close, subscribing needs onCloseRequested.
  withNativeWindow(t, { close: () => {} });
  const half = await import(`../../src/api/editorApi.js?window-presence2=${Date.now()}`);
  assert.equal(half.editorApi.window.hasWindowBindings(), false);
  withNativeWindow(t, { close: () => {}, onCloseRequested: () => {} });
  const present = await import(`../../src/api/editorApi.js?window-presence3=${Date.now()}`);
  assert.equal(present.editorApi.window.hasWindowBindings(), true);
});
