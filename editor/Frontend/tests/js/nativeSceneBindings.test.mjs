import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';
import { isViewportGizmoSelectionOwner } from '../../src/utils/viewportGizmo.js';

function nativeScene(t) {
  const previous = globalThis.window;
  const calls = [];
  const snapshot = { archive_session: 'archive', scene: 'scene.ini', tree_revision: '18446744073709551615', selection: {} };
  const native = {
    readActive: async () => snapshot,
    selectActor: async (...args) => { calls.push(args); return { status: 'success' }; },
  };
  globalThis.window = { corona: { scene: native }, cefQuery: () => { throw new Error('legacy transport is forbidden'); } };
  t.after(() => { globalThis.window = previous; });
  return { native, snapshot, calls };
}

test('focus applies once through scoped V8 and has no obsolete focus facades or result event', async t => {
  const { native } = nativeScene(t);
  const calls = [], scope = { archive_session: 'archive' };
  const result = { scene: 'scene.ini', archive_session: 'archive', camera: { camera_id: 'camera-id' } };
  native.focusActor = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON focus transport forbidden'); };
  assert.equal(typeof editorApi.scene.focusActor, 'function');
  assert.equal(await editorApi.scene.focusActor('scene.ini', 'actor-guid', 'camera-id', scope), result);
  assert.deepEqual(calls, [['scene.ini', 'actor-guid', 'camera-id', scope]]);
  assert.equal('focusActor' in editorApi.sceneTools, false);
  assert.equal('focusActor' in editorApi.resourceSearch, false);
  assert.equal('onFocusPoseResult' in editorApi.events, false);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.focusActor = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.focusActor('scene.ini', 'actor', 'camera', scope), error => error === failure);
});

test('scene facade reads native values and selects through the same V8 object with JSON disabled', async t => {
  const { snapshot, calls } = nativeScene(t);
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON transport is forbidden'); };
  assert.equal(await editorApi.scene.readActive(), snapshot);
  const context = { sourceViewport: 'cameraView', sourceCameraId: 'camera/max', node_index: 7 };
  assert.deepEqual(await editorApi.sceneTools.selectActor('scene.ini', 'model', 'Probe', context), { status: 'success' });
  assert.deepEqual(calls, [['scene.ini', 'model', 'Probe', context]]);
});

test('scene facade preserves native failures and does not retry an old route', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.readActive = () => Promise.reject(failure);
  native.selectActor = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.readActive(), error => error === failure);
  await assert.rejects(editorApi.sceneTools.selectActor('scene.ini', 'model', 'Probe'), error => error === failure);
});

test('selection ownership compares stable camera IDs exactly', () => {
  const selection = { source_viewport: 'cameraView', source_camera_id: 'camera/9007199254740993' };
  assert.equal(isViewportGizmoSelectionOwner({ viewportScope: 'cameraView', cameraId: 'camera/9007199254740992', selection }), false);
  assert.equal(isViewportGizmoSelectionOwner({ viewportScope: 'cameraView', cameraId: 'camera/9007199254740993', selection }), true);
  assert.equal(isViewportGizmoSelectionOwner({ viewportScope: 'cameraView', cameraId: '', selection }), false);
});

test('Actor transform has one native patch entry with raw values and no JSON transport', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { status: 'success', scene: 'scene.ini', actor: { actor_guid: 'actor-id', actor_version: 2 } };
  native.setActorTransform = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON transform is forbidden'); };
  const patch = { archive_session: 'archive', position: [0, 2, -3], rotation: [0, 0, 0], scale: [1, 2, 1] };
  assert.equal(await editorApi.scene.setActorTransform('scene.ini', 'actor-id', patch), result);
  assert.deepEqual(calls, [['scene.ini', 'actor-id', patch]]);
});

test('Actor transform failures never fall back to Fast or manifest writes', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.setActorTransform = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.setActorTransform('scene.ini', 'actor-id', {
    archive_session: 'old', position: [1, 2, 3],
  }), error => error === failure);
});

test('Actor properties merge state, physics and camera lock into one raw V8 patch', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { status: 'success', actor: { actor_guid: 'actor-id', actor_version: 8 } };
  native.setActorProperties = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON properties are forbidden'); };
  const patch = { archive_session: 'archive', visible: false, follow_camera: true,
    mechanics: { mass: 4, body_type: 'kinematic', linear_lock: [true, false, false] },
    camera_lock: { enabled: true, position_offset: [1, 2, 3] }, animation_sources: [] };
  assert.equal(await editorApi.scene.setActorProperties('scene.ini', 'actor-id', patch), result);
  assert.deepEqual(calls, [['scene.ini', 'actor-id', patch]]);
  for (const retired of ['setActorState', 'setActorPhysics', 'setActorCameraLock']) {
    assert.equal(retired in editorApi.sceneTools, false, `${retired} must be removed`);
  }
});

test('Actor property failures preserve native errors and never retry a legacy route', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.setActorProperties = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.setActorProperties('scene.ini', 'actor-id', {
    archive_session: 'old', visible: false,
  }), error => error === failure);
});

test('environment has one raw V8 read and patch for sun, grid and physics with JSON disabled', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { archive_session: 'archive', scene: 'scene.ini', sun: { enabled: false },
    grid: { enabled: true }, physics: { gravity: [0, -9, 0], fixed_dt: 0.01 } };
  for (const method of ['getEnvironment', 'setEnvironment']) {
    native[method] = async (...args) => { calls.push([method, ...args]); return result; };
  }
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON environment is forbidden'); };
  const scope = { archive_session: 'archive' };
  const patch = { ...scope, sun: { enabled: false }, grid: { enabled: true }, physics: { gravity: [0, -9, 0] } };
  assert.equal(await editorApi.scene.getEnvironment('scene.ini', scope), result);
  assert.equal(await editorApi.scene.setEnvironment('scene.ini', patch), result);
  assert.deepEqual(calls, [['getEnvironment', 'scene.ini', scope], ['setEnvironment', 'scene.ini', patch]]);
  for (const old of ['getEnvironment', 'setEnvironment', 'sunDirection', 'floorGrid', 'getPhysicsParams', 'setPhysicsParams']) {
    assert.equal(old in editorApi.sceneTools, false, `retired environment wrapper: ${old}`);
  }
});

test('environment preserves native scope failures without retrying granular manifest routes', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.getEnvironment = native.setEnvironment = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.getEnvironment('scene.ini', { archive_session: 'old' }), error => error === failure);
  await assert.rejects(editorApi.scene.setEnvironment('scene.ini', { archive_session: 'old', grid: { enabled: false } }),
    error => error === failure);
});

test('screenshot uses one raw scoped V8 operation for explicit paths and interactive capture', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { status: 'success', archive_session: 'archive', scene: 'scene.ini', camera_id: 'camera-guid', path: '图.png' };
  native.captureScreenshot = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON screenshot transport is forbidden'); };
  const options = { archive_session: 'archive', path: '图.png' };
  assert.equal(await editorApi.scene.captureScreenshot('scene.ini', 'camera-guid', options), result);
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.captureScreenshot('scene.ini', 'camera-guid', scope), result);
  assert.deepEqual(calls, [['scene.ini', 'camera-guid', options], ['scene.ini', 'camera-guid', scope]]);
  assert.equal('selectScreenshotPath' in editorApi.sceneTools, false);
  assert.equal('saveScreenshot' in editorApi.sceneTools, false);
  assert.equal('capture' in editorApi.viewport, false);
});

test('screenshot cancellation and native errors do not retry or invoke an old picker', async t => {
  const { native } = nativeScene(t);
  const canceled = { status: 'canceled', path: '' };
  native.captureScreenshot = async () => canceled;
  assert.equal(await editorApi.scene.captureScreenshot('scene.ini', 'camera-guid', { archive_session: 'archive' }), canceled);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.captureScreenshot = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.captureScreenshot('scene.ini', 'camera-guid', { archive_session: 'old' }), error => error === failure);
});

test('camera pose and view settings share one scoped V8 patch with JSON disabled', async t => {
  const { native } = nativeScene(t), calls = [];
  const result = { archive_session: 'archive', scene: 'scene.ini', camera: { camera_id: 'camera-id', opaque_handle: '18446744073709551615' } };
  native.setCameraProperties = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('camera JSON transport is forbidden'); };
  const patch = { archive_session: 'archive', position: [0, 2, -3], forward: [0, 0, 1], world_up: [0, 1, 0], fov: 50,
    width: 640, height: 480, move_speed: 0.5, view_open: false };
  assert.equal(await editorApi.scene.setCameraProperties('scene.ini', 'camera-id', patch), result);
  assert.deepEqual(calls, [['scene.ini', 'camera-id', patch]]);
  assert.equal('setCameraPose' in editorApi.viewport, false);
  assert.equal('updateCameraView' in editorApi.sceneTools, false);
});

test('camera patch propagates native input ownership and archive failures without a Fast fallback', async t => {
  const { native } = nativeScene(t);
  for (const code of ['PROJECT_CONTEXT_CHANGED', 'EDITOR_INPUT_LOCKED']) {
    const failure = Object.assign(new Error(code), { code });
    native.setCameraProperties = () => Promise.reject(failure);
    await assert.rejects(editorApi.scene.setCameraProperties('scene.ini', 'camera-id', {
      archive_session: 'archive', position: [1, 2, 3],
    }), error => error === failure);
  }
});
