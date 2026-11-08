import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { computed, ref } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';
import { deferred } from './windowSessionFixtures.mjs';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/sidebar/EditorSettings.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'editor-settings-lifetime' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');

function mount(t, overrides = {}) {
  const requests = [], timers = new Map(), warnings = [], keys = [];
  let mounted, unmounted, receive, sequence = 0, unsubscribed = 0;
  const viewport = { available: true, sceneId: 'scene', cameraId: 'camera', cameraSpeed: 0.3, gridEnabled: true };
  const component = new Function('ref', 'computed', 'onMounted', 'onBeforeUnmount', 'useI18n', 'setLocale',
    'appService', 'editorApi', 'aiSettings', 'viewportControlsService', 'createViewLifetime', 'window', 'console', compiled)(
    ref, computed, fn => { mounted = fn; }, fn => { unmounted = fn; },
    () => ({ t: key => key, locale: ref('en') }), () => {}, {}, {},
    { get: overrides.get || (async () => ({ configured: true, masked_key: 'masked' })),
      saveApiKey: key => { keys.push(key); return overrides.save ? overrides.save(key)
        : Promise.resolve({ configured: true, masked_key: 'new-mask' }); } },
    { request: (payload, options) => { requests.push(payload); return overrides.request
      ? overrides.request(payload, options) : Promise.resolve(viewport); },
    subscribe: callback => { receive = callback; return () => { unsubscribed++; }; } },
    createViewLifetime, { setTimeout: fn => { timers.set(++sequence, fn); return sequence; },
      clearTimeout: id => timers.delete(id) }, { warn: (...args) => warnings.push(args) });
  const state = component.setup({}, { expose() {} });
  t.after(() => unmounted());
  return { state, requests, timers, warnings, keys, viewport, dispose: () => unmounted(),
    start: () => mounted(), receive: value => receive(value), unsubscribed: () => unsubscribed };
}

test('EditorSettings ignores an AI status delivered after retirement', async t => {
  const pending = deferred();
  const page = mount(t, { get: () => pending.promise });
  const reading = page.state.loadAiKeyStatus();
  pending.resolve({ configured: true, masked_key: 'late-mask' });
  page.dispose();
  await reading;
  assert.deepEqual(page.state.aiKeyStatus.value, { configured: false, masked_key: '' });
  assert.equal(page.state.aiKeyInput.value, '');
});

for (const outcome of ['success', 'failure']) {
  test(`EditorSettings ignores an AI save ${outcome} after retirement`, async t => {
    const pending = deferred();
    const page = mount(t, { save: () => pending.promise });
    page.state.aiKeyEditing.value = true;
    page.state.aiKeyInput.value = 'test-only-key';
    const saving = page.state.saveAiKey();
    page.dispose();
    if (outcome === 'success') pending.resolve({ configured: true, masked_key: 'late-mask' });
    else pending.reject(new Error('retired save'));
    await saving;
    assert.equal(page.state.aiKeyBusy.value, true);
    assert.equal(page.state.aiKeyEditing.value, true);
    assert.equal(page.state.aiKeyInput.value, 'test-only-key');
    assert.equal(page.state.aiKeyMessage.value, '');
  });
}

test('EditorSettings ignores an already settled viewport reply after retirement', async t => {
  const pending = deferred();
  const page = mount(t, { request: () => pending.promise });
  const updating = page.state.updateViewportControls({ action: 'setCameraSpeed', value: 1 });
  pending.resolve({ ...page.viewport, cameraSpeed: 1 });
  page.dispose();
  await updating;
  assert.equal(page.state.viewportControlState.value.cameraSpeed, 0.2);
});

test('EditorSettings aborted render cannot refresh or change retired error and busy state', async t => {
  const pending = deferred();
  const page = mount(t, { request: () => pending.promise });
  const applying = page.state.setRenderMode();
  page.dispose();
  pending.reject(new Error('aborted'));
  await applying;
  assert.equal(page.requests.length, 1);
  assert.equal(page.state.renderError.value, false);
  assert.equal(page.state.renderApplying.value, true);
});

test('EditorSettings clears speed debounce and ignores its queued callback after retirement', async t => {
  const page = mount(t);
  page.state.handleCameraSpeedInput();
  const callback = [...page.timers.values()][0];
  page.dispose();
  assert.equal(page.timers.size, 0);
  callback();
  await Promise.resolve();
  assert.equal(page.requests.length, 0);
});

test('EditorSettings retired grid failure cannot refresh or clear busy state', async t => {
  const pending = deferred();
  const page = mount(t, { request: () => pending.promise });
  page.state.syncViewportControls(page.viewport);
  const applying = page.state.setGridEnabled();
  page.dispose();
  pending.reject(new Error('aborted grid'));
  await applying;
  assert.equal(page.requests.length, 1);
  assert.equal(page.state.gridApplying.value, true);
  assert.deepEqual(page.warnings, []);
});

test('EditorSettings ignores a queued subscription update and cannot restart retired actions', async t => {
  let reads = 0;
  const page = mount(t, { get: async () => { reads++; return {}; } });
  page.start();
  await Promise.resolve();
  page.dispose();
  page.receive({ ...page.viewport, cameraSpeed: 1 });
  await page.state.loadAiKeyStatus();
  await page.state.updateViewportControls({ action: 'setCameraSpeed', value: 1 });
  page.state.requestViewportControlsState();
  page.state.handleCameraSpeedInput();
  assert.equal(reads, 1);
  assert.equal(page.requests.length, 1);
  assert.equal(page.state.viewportControlState.value.cameraSpeed, 0.3);
  assert.equal(page.timers.size, 0);
});

test('EditorSettings live render failure still refreshes current viewport state', async t => {
  const page = mount(t, { request: payload => payload.action === 'selectRenderMode'
    ? Promise.reject(new Error('render unavailable')) : Promise.resolve({ cameraSpeed: 0.8 }) });
  await page.state.setRenderMode();
  assert.deepEqual(page.requests.map(value => value.action), ['selectRenderMode', 'getState']);
  assert.equal(page.state.renderError.value, true);
  assert.equal(page.state.renderApplying.value, false);
  assert.equal(page.state.viewportControlState.value.cameraSpeed, 0.8);
});

test('EditorSettings live speed debounce applies the latest value once', async t => {
  const page = mount(t);
  page.state.viewportControlState.value.cameraSpeed = 0.5;
  page.state.handleCameraSpeedInput();
  page.state.viewportControlState.value.cameraSpeed = 0.7;
  page.state.handleCameraSpeedInput();
  assert.equal(page.timers.size, 1);
  const callback = [...page.timers.values()][0];
  page.timers.clear(); callback();
  await Promise.resolve();
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].action, 'setCameraSpeed');
  assert.equal(page.requests[0].value, 0.7);
});

test('EditorSettings live settings still apply and release their subscription', async t => {
  const page = mount(t);
  page.start();
  await Promise.resolve();
  assert.equal(page.state.viewportControlState.value.cameraSpeed, 0.3);
  assert.equal(page.state.aiKeyInput.value, 'masked');
  page.state.beginAiKeyEdit();
  page.state.aiKeyInput.value = 'test-only-key';
  await page.state.saveAiKey();
  assert.equal(page.state.aiKeyBusy.value, false);
  assert.equal(page.state.aiKeyInput.value, 'new-mask');
  assert.equal(page.state.aiKeyMessage.value, 'editorSettings.ai.saved');
  page.dispose();
  assert.equal(page.unsubscribed(), 1);
});
