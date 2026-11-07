import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ref } from 'vue';
import { babelParse, parse } from 'vue/compiler-sfc';
import * as cameraController from '../../src/utils/viewportCameraController.js';

const source = readFileSync(new URL('../../src/views/sidebar/SceneBar.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const node = babelParse(descriptor.scriptSetup.content, { sourceType: 'module' }).program.body
  .find(node => node.type === 'VariableDeclaration' && node.declarations.some(d => d.id.name === 'focusActorFromList'));
const makeFocus = new Function('deps', `
  const { editorApi, appService, currentSceneName, archiveSession, getTargetCamera, getTargetCameraName,
    SelectActor, coronaEventBus, logWarn, logError } = deps;
  let actorFocusSeq = 0;
  ${descriptor.scriptSetup.content.slice(node.start, node.end)}
  return focusActorFromList;
`);
function fixture() {
  const calls = [], events = [], localEvents = [], errors = [], archiveSession = ref('archive');
  const result = { archive_session: 'archive', scene: 'scene.ini', camera: {
    camera_id: 'camera-guid', position: [1, 2, 3], forward: [0, 0, 1], world_up: [0, 1, 0], fov: 45,
  } };
  const api = { scene: { focusActor: async (...args) => { calls.push(args); return result; } } };
  const appService = { crossTabBroadcast: async (...args) => events.push(args) };
  const focus = makeFocus({ editorApi: api, appService, currentSceneName: ref('scene.ini'), archiveSession,
    getTargetCamera: () => ({ camera_id: 'camera-guid', name: 'Display camera' }),
    getTargetCameraName: () => 'Display camera', SelectActor: () => {},
    coronaEventBus: { emit: (...args) => localEvents.push(args) }, logWarn: (...args) => errors.push(args),
    logError: (...args) => errors.push(args) });
  return { focus, api, appService, calls, events, localEvents, errors, result, archiveSession };
}

test('a SceneBar double click selects once before the single native focus operation', async () => {
  const f = fixture();
  const doubleClick = babelParse(descriptor.scriptSetup.content, { sourceType: 'module' }).program.body
    .find(node => node.type === 'VariableDeclaration' && node.declarations.some(d => d.id.name === 'onActorRowDoubleClick'));
  let selections = 0;
  const build = new Function('focusActorFromList', 'SelectActor', `
    const clearActorSingleClickTimer = () => {}, isActorRowActionEvent = () => false;
    const handlePlayToggle = () => {};
    ${descriptor.scriptSetup.content.slice(doubleClick.start, doubleClick.end)}
    return onActorRowDoubleClick;
  `);
  // The production focus function shares this selection dependency with its caller.
  const original = makeFocus({ editorApi: f.api, appService: f.appService, currentSceneName: ref('scene.ini'), archiveSession: f.archiveSession,
    getTargetCamera: () => ({ camera_id: 'camera-guid' }), getTargetCameraName: () => 'camera',
    SelectActor: () => { selections++; }, coronaEventBus: { emit() {} }, logWarn() {}, logError() {} });
  build(original, () => { selections++; })({ name: 'Actor' }, {});
  await Promise.resolve();
  assert.equal(selections, 1);
  assert.equal(f.calls.length, 1);
});

test('SceneBar targets an exact camera ID and publishes an applied pose with native scope', async () => {
  const f = fixture();
  await f.focus({ name: 'Display actor', actor_guid: 'actor-guid' });
  assert.deepEqual(f.calls, [['scene.ini', 'actor-guid', 'camera-guid', { archive_session: 'archive' }]]);
  assert.deepEqual(f.events, [['camera-pose-applied', f.result]]);
  assert.deepEqual(f.localEvents, []);
  assert.deepEqual(f.errors, []);
});

test('camera pose snapshots require the exact scope and detach from incoming message arrays', () => {
  const read = cameraController.readAppliedCameraPose;
  assert.equal(typeof read, 'function');
  const result = fixture().result;
  const scope = { archiveSession: 'archive', sceneId: 'scene.ini', cameraId: 'camera-guid' };
  const value = read(result, scope);
  assert.deepEqual(value, { position: [1, 2, 3], forward: [0, 0, 1], up: [0, 1, 0], fov: 45 });
  value.position[0] = 99;
  assert.equal(result.camera.position[0], 1);
  for (const changed of [{ archiveSession: '' }, { archiveSession: 'old' }, { sceneId: 'other' }, { cameraId: 'other' }]) {
    assert.equal(read(result, { ...scope, ...changed }), null);
  }
  for (const changed of [{ position: [NaN, 2, 3] }, { world_up: [0, 1] }, { fov: '45' }]) {
    assert.equal(read({ ...result, camera: { ...result.camera, ...changed } }, scope), null);
  }
});

test('CameraView accepts an applied pose for its own camera without publishing it again', () => {
  const { descriptor: view } = parse(readFileSync(new URL('../../src/views/tools/CameraView.vue', import.meta.url), 'utf8'));
  const handler = babelParse(view.scriptSetup.content, { sourceType: 'module' }).program.body
    .find(node => node.type === 'VariableDeclaration' && node.declarations.some(d => d.id.name === 'onCameraPoseApplied'));
  assert.ok(handler, 'CameraView must receive focus results from the shared Web topic');
  let cleared = 0;
  const keys = new Set(['KeyW']);
  const camera = ref({ archive_session: 'archive', camera_id: 'camera-guid', handle: 12 });
  const setup = new Function('deps', `
    const { camera, readAppliedCameraPose, keys, window } = deps;
    const sceneId = 'scene.ini', cameraId = 'camera-guid';
    let posePublishTimer = 1, looking = true;
    ${view.scriptSetup.content.slice(handler.start, handler.end)}
    return { onCameraPoseApplied, state: () => ({posePublishTimer, looking}) };
  `)({ camera, readAppliedCameraPose: cameraController.readAppliedCameraPose, keys,
    window: { clearTimeout: () => cleared++ } });
  assert.equal(setup.onCameraPoseApplied(fixture().result), true);
  assert.deepEqual(camera.value.position, [1, 2, 3]);
  assert.deepEqual(camera.value.world_up, [0, 1, 0]);
  assert.equal(camera.value.handle, 12);
  assert.equal(keys.size, 0);
  assert.equal(cleared, 1);
  assert.deepEqual(setup.state(), { posePublishTimer: 0, looking: false });
  assert.equal(setup.onCameraPoseApplied({ ...fixture().result, archive_session: 'old' }), false);
  assert.equal(cleared, 1);
  assert.match(view.scriptSetup.content, /coronaEventBus\.on\('camera-pose-applied', onCameraPoseApplied\)/);
  assert.match(view.scriptSetup.content, /coronaEventBus\.off\('camera-pose-applied', onCameraPoseApplied\)/);
});

test('SceneBar does not publish an old focus after its archive changes or native rejects', async () => {
  const f = fixture();
  let release;
  f.api.scene.focusActor = () => new Promise(resolve => { release = resolve; });
  const pending = f.focus({ name: 'Actor' });
  f.archiveSession.value = 'replacement';
  release(f.result);
  await pending;
  assert.deepEqual(f.events, []);
  f.api.scene.focusActor = () => Promise.reject(new Error('Native focus failed'));
  await f.focus({ name: 'Actor' });
  assert.deepEqual(f.events, []);
  assert.equal(f.errors.length, 1);
});
