import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ref } from 'vue';
import { babelParse, parse } from 'vue/compiler-sfc';
import { initializeWorldRenderBackend } from '../../src/services/worldRenderPolicy.js';
import { drainWorldSession } from '../../src/services/worldSessionLifecycle.js';

const source = parse(fs.readFileSync(new URL('../../src/views/layout/MainPage.vue', import.meta.url), 'utf8'))
  .descriptor.scriptSetup.content;
const names = new Set(['initializeCreativeRenderMode', 'creativeRenderDefaultsBusy',
  'creativeRenderDefaultsError', 'mainRenderBackend', 'mainVisionRenderMode', 'pendingMainRenderSelection']);
const declarations = babelParse(source, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'VariableDeclaration' && node.declarations.some(item => names.has(item.id.name)))
  .map(node => source.slice(node.start, node.end)).join('\n');

function creative({ newProject = false, cameraId = 'camera-2', reply } = {}) {
  const calls = [];
  const state = { status: 'ready', mode: 'creative', newProject };
  const api = { sceneTools: { setRenderBackend: async (...args) => {
    calls.push(args);
    return reply ? reply() : { data: { mode: args[0] } };
  } } };
  const host = new Function('ref', 'initializeWorldRenderBackend', 'editorApi', 'worldModeState', 'cameraId', `
    const cameraBindingState = ref({ cameraHandle: cameraId ? 12 : null });
    const currentMainSceneId = () => 'scene.ini', currentMainCameraId = () => cameraId;
    const viewCurrent = () => true, logError = () => {};
    let bindings = 0;
    const syncSceneCameraBinding = async () => { bindings++; };
    ${declarations}
    mainRenderBackend.value = 'vision';
    mainVisionRenderMode.value = 'restir';
    return { initializeCreativeRenderMode, mainRenderBackend, mainVisionRenderMode,
      creativeRenderDefaultsBusy, creativeRenderDefaultsError,
      get bindings() { return bindings; } };
  `)(ref, initializeWorldRenderBackend, api, state, cameraId);
  return { host, calls, state };
}

for (const newProject of [false, true]) {
  test(`${newProject ? 'new' : 'continued'} creative worlds select Vision and retain the saved tracing algorithm`, async () => {
    const { host, calls } = creative({ newProject });
    assert.equal(await host.initializeCreativeRenderMode(), true);
    assert.deepEqual(calls, [['vision', 'scene.ini', 'camera-2']]);
    assert.equal(host.mainRenderBackend.value, 'vision');
    assert.equal(host.mainVisionRenderMode.value, 'restir', 'saved tracing preferences are retained');
    assert.equal(host.bindings, 1);
    assert.equal(host.creativeRenderDefaultsBusy.value, false);
  });
}

test('first creative entry selects the active camera before a snapshot is bound', async () => {
  const { host, calls } = creative({ cameraId: null });
  assert.equal(await host.initializeCreativeRenderMode(), true);
  assert.deepEqual(calls, [['vision', 'scene.ini', null]]);
});

test('a rejected Vision selection does not bind a Native viewport as successful ray tracing', async () => {
  const { host } = creative({ reply: () => ({ mode: 'native' }) });
  assert.equal(await host.initializeCreativeRenderMode(), false);
  assert.equal(host.bindings, 0);
  assert.match(host.creativeRenderDefaultsError.value, /Vision/);
});

test('stale world selection cannot start or finish rendering initialization', async () => {
  let current = false, calls = 0, resolve;
  const api = { sceneTools: { setRenderBackend: () => {
    calls++;
    return new Promise(done => { resolve = done; });
  } } };
  const initialize = () => initializeWorldRenderBackend({ api, sceneId: 'scene.ini', isCurrent: () => current });
  assert.equal(await initialize(), false);
  assert.equal(calls, 0);
  current = true;
  const pending = initialize();
  let drained = false;
  const draining = drainWorldSession().then(() => { drained = true; });
  await Promise.resolve();
  assert.equal(drained, false, 'a world switch must wait for the outstanding backend command');
  current = false;
  resolve({ mode: 'vision' });
  assert.equal(await pending, false);
  await draining;
});

test('Vision backend errors propagate instead of silently continuing with Native', async () => {
  const api = { sceneTools: { setRenderBackend: async () => { throw new Error('bridge unavailable'); } } };
  await assert.rejects(initializeWorldRenderBackend({ api, sceneId: 'scene.ini', isCurrent: () => true }), /bridge unavailable/);
});

test('restored Native camera windows select Vision before they become visible', async () => {
  const node = babelParse(source, { sourceType: 'module' }).program.body.find(node =>
    node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === 'restoreCameraViews'));
  const cameras = [{ camera_id: 'saved-camera', render_backend: 'native', view_open: true },
    { camera_id: 'closed-camera', render_backend: 'native', view_open: false }];
  const calls = [];
  const restore = new Function('initializeWorldRenderBackend', 'editorApi', 'appService', `
    const viewCurrent = () => true, logError = error => { throw error; };
    ${source.slice(node.start, node.end)}
    return restoreCameraViews;
  `)(initializeWorldRenderBackend, { sceneTools: {
    listCameraViews: async () => ({ data: { cameras } }),
    setRenderBackend: async (...args) => { calls.push(['backend', ...args]); return { mode: args[0] }; },
  } }, { createCameraView: async camera => calls.push(['open', camera.camera_id]) });
  await restore('scene.ini');
  assert.deepEqual(calls, [['backend', 'vision', 'scene.ini', 'saved-camera'], ['open', 'saved-camera']]);
});
