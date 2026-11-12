import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ref } from 'vue';
import { babelParse, parse } from 'vue/compiler-sfc';
import { editorApi } from '../../src/api/editorApi.js';
import { getWebMessages } from '../../src/api/webMessages.js';
import { memoryStorage } from './windowSessionFixtures.mjs';
import { worldModeState } from '../../src/services/worldModeService.js';

function handler(file, name, deps) {
  const { descriptor } = parse(readFileSync(new URL(`../../src/views/${file}.vue`, import.meta.url), 'utf8'));
  const source = descriptor.scriptSetup.content;
  const node = babelParse(source, { sourceType: 'module' }).program.body.find(node =>
    node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === name));
  assert.ok(node, `${file}.${name}`);
  const operation = file === 'sidebar/SceneBar' && ['OpenCameraView', 'ImportCamera'].includes(name)
    ? babelParse(source, { sourceType: 'module' }).program.body.find(node =>
      node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === 'sceneOperation')) : null;
  if (operation) deps.viewLifetime = { current: () => true };
  return new Function('deps', `const {${Object.keys(deps).join(',')}} = deps; ${operation ? source.slice(operation.start, operation.end) : ''}
    ${source.slice(node.start, node.end)}; return ${name};`)(deps);
}

test('SceneBar camera list preserves archive identity through the application window service', async t => {
  const previousWindow = globalThis.window;
  const previousWorld = { ...worldModeState };
  t.after(() => { getWebMessages(globalThis.window).dispose(); globalThis.window = previousWindow; Object.assign(worldModeState, previousWorld); });
  const calls = [], errors = [];
  globalThis.window = {
    localStorage: memoryStorage(), sessionStorage: memoryStorage(), location: { hash: '#/' },
    corona: { window: {
      close: async () => ({ closed: 0 }),
      createPanel: async options => {
        assert.equal(options.kind, 'camera');
        assert.equal(options.archiveSession, 'observed-archive');
        assert.equal(new URLSearchParams(options.routePath.split('?')[1]).get('archive'), 'observed-archive');
        assert.equal(options.sceneId, 'scene.ini');
        assert.equal(options.cameraId, 'focus-camera');
        assert.equal(options.x, 0); assert.equal(options.y, 0);
        assert.equal('handle' in options, false);
        calls.push(options);
        return { window_token: 7 };
      },
    } },
  };
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: 'observed-archive' }));
  const { appService } = await import('../../src/services/appService.js');
  await appService.setEditorUiEnabled(true);
  const sceneCameras = ref([]);
  const normalizeCameraPayload = handler('sidebar/SceneBar', 'normalizeCameraPayload', { normalizeHandle: value => value });
  const applyCameraList = handler('sidebar/SceneBar', 'applyCameraList', {
    sceneCameras, selectedCameraName: ref(null), normalizeCameraPayload,
  });
  const observed = Object.freeze({ archive_session: 'observed-archive', camera_id: 'focus-camera',
    name: 'Camera', view_x: 0, view_y: 0, view_width: 640, view_height: 480 });
  applyCameraList([observed]);
  const open = handler('sidebar/SceneBar', 'OpenCameraView', {
    currentSceneName: ref('scene.ini'), archiveSession: ref('observed-archive'), appService,
    OnInitObjTree: async () => calls.push('refresh'), logError: (...args) => errors.push(args),
  });
  await open(sceneCameras.value[0]);
  assert.deepEqual(errors, []);
  assert.equal(calls.length, 2);
  assert.equal(calls[1], 'refresh');
});

test('opening an existing camera sends only one window operation with the observed archive identity', async () => {
  const calls = [], errors = [];
  const camera = { camera_id: 'camera', archive_session: 'archive', name: 'Camera', view_width: 640 };
  const open = handler('sidebar/SceneBar', 'OpenCameraView', {
    currentSceneName: ref('scene'), archiveSession: ref('archive'),
    editorApi: { sceneTools: { openCameraView: async () => { throw new Error('retired state mutation'); } } },
    appService: { createCameraView: async value => { calls.push(value); return { window_token: 7 }; } },
    OnInitObjTree: async () => calls.push('refresh'), logError: (...args) => errors.push(args),
  });
  await open(camera);
  assert.deepEqual(errors, []);
  assert.deepEqual(calls, [{ ...camera, scene_id: 'scene' }, 'refresh']);
});

test('failed camera creation preserves the observed camera and reports failure without a successful refresh', async () => {
  const calls = [], camera = Object.freeze({ camera_id: 'camera', archive_session: 'archive', view_open: false });
  const failure = new Error('CREATE_FAILED');
  const open = handler('sidebar/SceneBar', 'OpenCameraView', {
    currentSceneName: ref('scene'), archiveSession: ref('archive'), editorApi: { sceneTools: {} },
    appService: { createCameraView: async () => { throw failure; } },
    OnInitObjTree: async () => calls.push('refresh'), logError: (_message, error) => calls.push(error),
  });
  await open(camera);
  assert.deepEqual(calls, [failure]);
  assert.equal(camera.view_open, false);
});

test('camera close goes through the session retirement barrier once and exposes failures', async () => {
  const calls = [], errorText = ref('');
  let fail = false;
  const close = handler('tools/CameraView', 'closeView', {
    sceneId: 'scene', cameraId: 'camera', errorText,
    editorApi: { sceneTools: { closeCameraView: async () => { throw new Error('retired state mutation'); } } },
    appService: { closeThisTab: async value => { calls.push(value); if (fail) throw new Error('SAVE_FAILED'); } },
  });
  await close();
  assert.equal(errorText.value, '');
  assert.deepEqual(calls, ['camera:camera']);
  fail = true;
  await close();
  assert.equal(errorText.value, 'SAVE_FAILED');
});

test('retired camera window state toggles are absent and camera object creation has its own typed binding', () => {
  assert.equal(editorApi.sceneTools?.openCameraView, undefined);
  assert.equal(editorApi.sceneTools?.closeCameraView, undefined);
  assert.equal(editorApi.sceneTools?.createCameraView, undefined);
  assert.equal(typeof editorApi.scene.createCamera, 'function');
});

test('new camera object creation is archive scoped and opens its surface only after native success', async () => {
  const calls = [], errors = [];
  const created = { archive_session: 'archive', scene: 'scene', camera_id: 'new-camera', name: 'Camera_1', view_open: false };
  const create = handler('sidebar/SceneBar', 'ImportCamera', {
    ShowModelDropdown: ref(true), sceneCameras: ref([{ name: 'Camera' }]), currentSceneName: ref('scene'),
    archiveSession: ref('archive'), selectedCameraName: ref(''),
    editorApi: { scene: { createCamera: async (...args) => { calls.push(['object', ...args]); return { camera: created }; } } },
    appService: { createCameraView: async value => calls.push(['window', value]) },
    OnInitObjTree: async () => calls.push(['refresh']), logError: (...args) => errors.push(args),
  });
  await create();
  assert.deepEqual(errors, []);
  assert.deepEqual(calls, [['object', 'scene', { archive_session: 'archive', name: 'Camera_1' }],
    ['window', { ...created, scene_id: 'scene' }], ['refresh']]);
});
