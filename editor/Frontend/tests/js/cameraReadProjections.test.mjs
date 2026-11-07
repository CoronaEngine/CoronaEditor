import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { babelParse, parse } from 'vue/compiler-sfc';
import { editorApi } from '../../src/api/editorApi.js';
import { deferred } from './windowSessionFixtures.mjs';
import { normalizeVisionRenderMode, visionAccumulationFromCamera, visionDenoiseFromCamera,
  visionDenoiserFromCamera, visionStablePlanesFromCamera } from '../../src/utils/visionRenderModes.js';

function handler(file, name, deps) {
  const script = parse(readFileSync(new URL(`../../src/${file}.vue`, import.meta.url), 'utf8')).descriptor.scriptSetup.content;
  const node = babelParse(script, { sourceType: 'module' }).program.body.flatMap(node =>
    node.type === 'FunctionDeclaration' ? [node] : (node.declarations || []).map(item => ({ ...item.init, name: item.id.name })))
    .find(node => node.id?.name === name || node.name === name);
  assert.ok(node, name);
  return new Function('deps', `with(deps){return (${script.slice(node.start, node.end)});}`)(deps);
}

test('one camera V8 facade replaces both legacy Web snapshot and camera list readers', async t => {
  const previous = globalThis.window, parse = JSON.parse, stringify = JSON.stringify;
  t.after(() => { globalThis.window = previous; JSON.parse = parse; JSON.stringify = stringify; });
  const calls = [], result = { archive_session: 'archive', scene: 'scene.ini', cameras: [] };
  globalThis.window = { corona: { scene: { readCameras: async (...args) => { calls.push(args); return result; } } } };
  JSON.parse = JSON.stringify = () => { throw new Error('JSON camera transport'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.readCameras('scene.ini', scope), result);
  assert.deepEqual(calls, [['scene.ini', scope]]);
  assert.equal(editorApi.scene.getSnapshot, undefined);
  assert.equal(editorApi.sceneTools.listCameraViews, undefined);
});

test('camera editing uses scoped scene V8 methods and retires sceneTools manifest routes', async t => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  const calls = [], renamed = { camera_id: 'camera', name: 'New name' }, deleted = { camera_id: 'camera' };
  globalThis.window = { corona: { scene: {
    renameCamera: async (...args) => { calls.push(['rename', ...args]); return renamed; },
    deleteCamera: async (...args) => { calls.push(['delete', ...args]); return deleted; },
  } } };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.renameCamera('scene.ini', 'camera', 'New name', scope), renamed);
  assert.equal(await editorApi.scene.deleteCamera('scene.ini', 'camera', scope), deleted);
  assert.deepEqual(calls, [['rename', 'scene.ini', 'camera', 'New name', scope],
    ['delete', 'scene.ini', 'camera', scope]]);
  assert.equal(editorApi.sceneTools.renameCameraView, undefined);
  assert.equal(editorApi.sceneTools.deleteCamera, undefined);
  const cameraView = readFileSync(new URL('../../src/views/tools/CameraView.vue', import.meta.url), 'utf8');
  const sceneBar = readFileSync(new URL('../../src/views/sidebar/SceneBar.vue', import.meta.url), 'utf8');
  assert.match(cameraView, /scene\.renameCamera\(sceneId, cameraId, cameraName\.value\.trim\(\), \{\s*archive_session: cameraArchiveSession/);
  assert.match(sceneBar, /const scope = \{ archive_session: archiveSession\.value \};[\s\S]*?scene\.deleteCamera\(currentSceneName\.value, cameraId, scope\)/);
});

function mainDeps() {
  const calls = [], applied = [], errors = [];
  const identity = { archive_session: 'archive', scene: 'scene.ini' };
  const deps = { viewCurrent: () => true, environmentArchiveSession: { value: 'archive' },
    sceneCameraBindingRequestRevision: 0, applySceneSnapshot: (...args) => applied.push(args),
    broadcastViewportControlsState() {}, logError: (...args) => errors.push(args),
    editorApi: { scene: {
      readCameras: async (...args) => { calls.push(['cameras', ...args]); return { ...identity,
        active_camera_id: 'main', cameras: [{ camera_id: 'main', opaque_handle: '18446744073709551615',
          vision_accumulation: true, vision_denoise: false, vision_denoiser: 'relax', vision_stable_planes: false }] }; },
      getEnvironment: async (...args) => { calls.push(['environment', ...args]); return { ...identity,
        sun: { enabled: false, direction: [3, 2, 1] }, grid: { enabled: false } }; },
      readActorIndex: async (...args) => { calls.push(['actors', ...args]); return { ...identity, actors: [{ actor_guid: 'actor', name: 'Probe' }] }; },
    } },
  };
  return { deps, calls, applied, errors };
}

function cameraDeps(read) {
  const deps = { sceneId: 'scene.ini', cameraId: 'camera', cameraArchiveSession: 'archive',
    viewLifetime: { current: () => true }, unwrap: value => value?.data ?? value,
    pendingDenoiserSelection: null, pendingStablePlanesSelection: null,
    normalizeVisionRenderMode, visionAccumulationFromCamera, visionDenoiseFromCamera,
    visionDenoiserFromCamera, visionStablePlanesFromCamera,
    editorApi: { scene: { readCameras: read, isVisionAvailable: async () => ({ available: true }) } },
  };
  for (const key of ['camera', 'cameraName', 'backend', 'visionAvailable', 'visionAccumulation', 'visionDenoise',
    'visionDenoiser', 'visionStablePlanes', 'visionRenderMode', 'outputMode', 'moveSpeed', 'renderWidth', 'renderHeight'])
    deps[key] = { value: null };
  return deps;
}

test('CameraView reads rendering and pose under its original window archive', async () => {
  const calls = [], deps = cameraDeps(async (...args) => { calls.push(args); return {
    scene: 'scene.ini', archive_session: 'archive', cameras: [{ archive_session: 'archive', camera_id: 'camera',
      name: 'Camera', opaque_handle: '18446744073709551615', render_backend: 'vision', vision_render_mode: 'restir',
      vision_denoise: false, vision_denoiser: 'relax', vision_accumulation: true, vision_stable_planes: false }] }; });
  await handler('views/tools/CameraView', 'loadCamera', deps)();
  assert.deepEqual(calls, [['scene.ini', { archive_session: 'archive' }]]);
  assert.equal(deps.camera.value.opaque_handle, '18446744073709551615');
  assert.equal(deps.backend.value, 'vision'); assert.equal(deps.visionRenderMode.value, 'restir');
  assert.equal(deps.visionDenoiser.value, 'relax'); assert.equal(deps.visionDenoise.value, false);
  assert.equal(deps.visionStablePlanes.value, false); assert.equal(deps.visionAccumulation.value, true);
});

test('CameraView never applies initialization after its document has retired', async () => {
  const pending = deferred(), deps = cameraDeps(() => pending.promise);
  const work = handler('views/tools/CameraView', 'loadCamera', deps)();
  deps.viewLifetime.current = () => false;
  pending.resolve({ archive_session: 'archive', scene: 'scene.ini', cameras: [{ camera_id: 'camera', name: 'Late' }] });
  await work; assert.equal(deps.camera.value, null); assert.equal(deps.cameraName.value, null);
});

test('main viewport composes complete camera, environment and pick projections under one observed scope', async () => {
  const { deps, calls, applied } = mainDeps();
  assert.equal(await handler('views/layout/MainPage', 'syncSceneCameraBinding', deps)('scene.ini', { preservePose: true }), true);
  assert.deepEqual(calls, ['cameras', 'environment', 'actors'].map(kind => [kind, 'scene.ini', { archive_session: 'archive' }]));
  const [scene, payload, options] = applied[0];
  assert.equal(scene, 'scene.ini'); assert.equal(payload.active_camera_id, 'main');
  assert.equal(payload.cameras[0].vision_denoiser, 'relax');
  assert.deepEqual(payload.sun, { enabled: false, direction: [3, 2, 1] });
  assert.deepEqual(payload.grid, { enabled: false });
  assert.equal(payload.actors[0].actor_guid, 'actor');
  assert.equal(options.preservePose, true);
});

for (const change of ['archive', 'unmount', 'newer request', 'wrong response scope']) {
  test(`main viewport rejects composed projections after ${change}`, async () => {
    const { deps, applied } = mainDeps(), pending = deferred();
    deps.editorApi.scene.readCameras = () => pending.promise;
    const work = handler('views/layout/MainPage', 'syncSceneCameraBinding', deps)('scene.ini');
    if (change === 'archive') deps.environmentArchiveSession.value = 'next';
    if (change === 'unmount') deps.viewCurrent = () => false;
    if (change === 'newer request') deps.sceneCameraBindingRequestRevision++;
    pending.resolve({ archive_session: change === 'wrong response scope' ? 'other' : 'archive', scene: 'scene.ini', cameras: [] });
    assert.equal(await work, false); assert.deepEqual(applied, []);
  });
}

test('main viewport cannot start scoped projections without an observed archive', async () => {
  const { deps, calls } = mainDeps(); deps.environmentArchiveSession.value = '';
  assert.equal(await handler('views/layout/MainPage', 'syncSceneCameraBinding', deps)('scene.ini'), false);
  assert.deepEqual(calls, []);
});

test('camera restoration never opens a camera after its archive has retired during render initialization', async () => {
  const pending = deferred(), opened = [];
  const deps = { viewCurrent: () => true, environmentArchiveSession: { value: 'archive' },
    editorApi: { scene: { readCameras: async () => ({ archive_session: 'archive', scene: 'scene.ini',
      cameras: [{ archive_session: 'archive', camera_id: 'camera', view_open: true }] }) } },
    initializeWorldRenderBackend: () => pending.promise,
    appService: { createCameraView: value => opened.push(value) }, logError() {},
  };
  const work = handler('views/layout/MainPage', 'restoreCameraViews', deps)('scene.ini');
  await Promise.resolve(); deps.environmentArchiveSession.value = 'next'; pending.resolve(true);
  await work; assert.deepEqual(opened, []);
});

test('SceneBar camera-only hover reads do not build a rich Actor tree', async () => {
  const calls = [], applied = [];
  const deps = { viewLifetime: { current: () => true }, currentSceneName: { value: 'scene.ini' },
    archiveSession: { value: 'archive' }, cameraListRefreshInFlight: false,
    editorApi: { scene: { readCameras: async (...args) => { calls.push(args); return {
      archive_session: 'archive', scene: 'scene.ini', cameras: [{ camera_id: 'camera' }] }; } } },
    applyCameraList: value => applied.push(value), logError() {},
  };
  await handler('views/sidebar/SceneBar', 'RefreshCameraListOnly', deps)();
  assert.deepEqual(calls, [['scene.ini', { archive_session: 'archive' }]]);
  assert.deepEqual(applied, [[{ camera_id: 'camera' }]]);
});

for (const change of ['archive', 'scene', 'unmount']) {
  test(`SceneBar discards a camera-only response after ${change}`, async () => {
    const pending = deferred(), calls = [], applied = [];
    const deps = { viewLifetime: { current: () => true }, currentSceneName: { value: 'scene.ini' },
      archiveSession: { value: 'archive' }, cameraListRefreshInFlight: false,
      editorApi: { scene: { readCameras: (...args) => { calls.push(args); return pending.promise; } } },
      applyCameraList: value => applied.push(value), logError() {},
    };
    const work = handler('views/sidebar/SceneBar', 'RefreshCameraListOnly', deps)();
    assert.equal(calls.length, 1);
    if (change === 'archive') deps.archiveSession.value = 'next';
    if (change === 'scene') deps.currentSceneName.value = 'next.ini';
    if (change === 'unmount') deps.viewLifetime.current = () => false;
    pending.resolve({ archive_session: 'archive', scene: 'scene.ini', cameras: [{ camera_id: 'camera' }] });
    await work; assert.deepEqual(applied, []);
  });
}
