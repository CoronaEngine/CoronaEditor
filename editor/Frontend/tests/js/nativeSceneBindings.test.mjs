import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

function nativeScene(t) {
  const previous = globalThis.window;
  const calls = [];
  const snapshot = { archive_session: 'archive', scene: 'scene.ini', tree_revision: '18446744073709551615', selection: {} };
  const native = {
    readActive: async () => snapshot,
    selectActor: async (...args) => { calls.push(args); return { status: 'success' }; },
  };
  const app = {}, viewport = {};
  globalThis.window = {
    corona: { app, input: {}, scene: native, viewport },
    cefQuery: () => { throw new Error('legacy transport is forbidden'); },
  };
  t.after(() => { globalThis.window = previous; });
  return { native, app, viewport, snapshot, calls };
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
  assert.equal('focusActor' in (editorApi.sceneTools || {}), false);
  assert.equal(editorApi.resourceSearch?.focusActor, undefined);
  assert.equal('onFocusPoseResult' in (editorApi.events ?? {}), false);
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
  assert.equal('selectActor' in (editorApi.sceneTools || {}), false);
  const context = { sourceViewport: 'cameraView', sourceCameraId: 'camera/max', node_index: 7 };
  assert.deepEqual(await editorApi.scene.selectActor('scene.ini', 'model', 'Probe', context), { status: 'success' });
  assert.deepEqual(calls, [['scene.ini', 'model', 'Probe', context]]);
});

test('scene facade preserves native failures and does not retry an old route', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.readActive = () => Promise.reject(failure);
  native.selectActor = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.readActive(), error => error === failure);
  await assert.rejects(editorApi.scene.selectActor('scene.ini', 'model', 'Probe'), error => error === failure);
});

test('vision availability uses the typed app binding without JSON or the legacy facade', async t => {
  const { app } = nativeScene(t);
  const result = { available: true };
  const calls = [];
  app.isVisionAvailable = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('vision availability JSON transport forbidden'); };
  assert.equal(await editorApi.app.isVisionAvailable(), result);
  assert.deepEqual(calls, [[]]);
  assert.equal('isVisionAvailable' in (editorApi.sceneTools || {}), false);
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
  native.updateActor = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON properties are forbidden'); };
  const patch = { archive_session: 'archive', visible: false, follow_camera: true,
    mechanics: { mass: 4, body_type: 'kinematic', linear_lock: [true, false, false] },
    camera_lock: { enabled: true, position_offset: [1, 2, 3] }, animation_sources: [] };
  assert.equal(await editorApi.scene.updateActor('scene.ini', 'actor-id', patch), result);
  assert.deepEqual(calls, [['scene.ini', 'actor-id', patch]]);
  for (const retired of ['setActorState', 'setActorPhysics', 'setActorCameraLock']) {
    assert.equal(retired in (editorApi.sceneTools || {}), false, `${retired} must be removed`);
  }
});

test('Actor property failures preserve native errors and never retry a legacy route', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.updateActor = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.updateActor('scene.ini', 'actor-id', {
    archive_session: 'old', visible: false,
  }), error => error === failure);
});

test('environment has one raw V8 read and patch for sun, grid and physics with JSON disabled', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { archive_session: 'archive', scene: 'scene.ini', sun: { enabled: false },
    grid: { enabled: true }, physics: { gravity: [0, -9, 0], fixed_dt: 0.01 } };
  for (const method of ['readEnvironment', 'setEnvironment']) {
    native[method] = async (...args) => { calls.push([method, ...args]); return result; };
  }
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON environment is forbidden'); };
  const scope = { archive_session: 'archive' };
  const patch = { ...scope, sun: { enabled: false }, grid: { enabled: true }, physics: { gravity: [0, -9, 0] } };
  assert.equal(await editorApi.scene.readEnvironment('scene.ini', scope), result);
  assert.equal(await editorApi.scene.setEnvironment('scene.ini', patch), result);
  assert.deepEqual(calls, [['readEnvironment', 'scene.ini', scope], ['setEnvironment', 'scene.ini', patch]]);
  for (const old of ['getEnvironment', 'readEnvironment', 'setEnvironment', 'sunDirection', 'floorGrid', 'getPhysicsParams', 'setPhysicsParams']) {
    assert.equal(old in (editorApi.sceneTools || {}), false, `retired environment wrapper: ${old}`);
  }
});

test('environment preserves native scope failures without retrying granular manifest routes', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.readEnvironment = native.setEnvironment = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.readEnvironment('scene.ini', { archive_session: 'old' }), error => error === failure);
  await assert.rejects(editorApi.scene.setEnvironment('scene.ini', { archive_session: 'old', grid: { enabled: false } }),
    error => error === failure);
});

test('screenshot uses one raw scoped V8 operation for explicit paths and interactive capture', async t => {
  const { viewport } = nativeScene(t);
  const calls = [];
  const result = { status: 'success', archive_session: 'archive', scene: 'scene.ini', camera_id: 'camera-guid', path: '图.png' };
  viewport.captureScreenshot = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON screenshot transport is forbidden'); };
  const options = { archive_session: 'archive', path: '图.png' };
  assert.equal(await editorApi.viewport.captureScreenshot('scene.ini', 'camera-guid', options), result);
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.viewport.captureScreenshot('scene.ini', 'camera-guid', scope), result);
  assert.deepEqual(calls, [['scene.ini', 'camera-guid', options], ['scene.ini', 'camera-guid', scope]]);
  assert.equal('selectScreenshotPath' in (editorApi.sceneTools || {}), false);
  assert.equal('saveScreenshot' in (editorApi.sceneTools || {}), false);
  assert.equal('capture' in editorApi.viewport, false);
});

test('screenshot cancellation and native errors do not retry or invoke an old picker', async t => {
  const { viewport } = nativeScene(t);
  const canceled = { status: 'canceled', path: '' };
  viewport.captureScreenshot = async () => canceled;
  assert.equal(await editorApi.viewport.captureScreenshot('scene.ini', 'camera-guid', { archive_session: 'archive' }), canceled);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  viewport.captureScreenshot = () => Promise.reject(failure);
  await assert.rejects(editorApi.viewport.captureScreenshot('scene.ini', 'camera-guid', { archive_session: 'old' }), error => error === failure);
});

test('camera pose and view settings share one scoped V8 patch with JSON disabled', async t => {
  const { native } = nativeScene(t), calls = [];
  const result = { archive_session: 'archive', scene: 'scene.ini', camera: { camera_id: 'camera-id', opaque_handle: '18446744073709551615' } };
  native.updateCamera = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('camera JSON transport is forbidden'); };
  const patch = { archive_session: 'archive', position: [0, 2, -3], forward: [0, 0, 1], world_up: [0, 1, 0], fov: 50,
    width: 640, height: 480, move_speed: 0.5, view_open: false };
  assert.equal(await editorApi.scene.updateCamera('scene.ini', 'camera-id', patch), result);
  assert.deepEqual(calls, [['scene.ini', 'camera-id', patch]]);
  assert.equal('setCameraPose' in editorApi.viewport, false);
  assert.equal('updateCameraView' in (editorApi.sceneTools || {}), false);
});

test('camera patch propagates native input ownership and archive failures without a Fast fallback', async t => {
  const { native } = nativeScene(t);
  for (const code of ['PROJECT_CONTEXT_CHANGED', 'EDITOR_INPUT_LOCKED']) {
    const failure = Object.assign(new Error(code), { code });
    native.updateCamera = () => Promise.reject(failure);
    await assert.rejects(editorApi.scene.updateCamera('scene.ini', 'camera-id', {
      archive_session: 'archive', position: [1, 2, 3],
    }), error => error === failure);
  }
});

test('Actor rename uses the scoped typed scene binding with JSON disabled', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { status: 'success', archive_session: 'archive', scene: 'scene.ini',
    actor_guid: 'actor-id', old_name: 'Probe', new_name: 'Renamed' };
  native.updateActor = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('actor rename JSON transport is forbidden'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.updateActor('scene.ini', 'actor-id', { ...(scope), name: 'Renamed' }), result);
  assert.deepEqual(calls, [['scene.ini', 'actor-id', { ...scope, name: 'Renamed' }]]);
  assert.equal('renameActor' in (editorApi.sceneTools || {}), false);
});

test('Actor rename errors propagate without retrying a manifest route', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.updateActor = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.updateActor('scene.ini', 'actor-id', { ...({
    archive_session: 'old',
  }), name: 'Renamed' }), error => error === failure);
});

test('Actor delete uses the scoped typed scene binding and clears no legacy facade', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { status: 'success', archive_session: 'archive', scene: 'scene.ini',
    actor_guid: 'actor-id', old_name: 'Probe', tree_revision: 8, selection_cleared: true };
  native.deleteActor = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('actor delete JSON transport is forbidden'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.deleteActor('scene.ini', 'actor-id', scope), result);
  assert.deepEqual(calls, [['scene.ini', 'actor-id', scope]]);
  assert.equal('removeActor' in (editorApi.sceneTools || {}), false);
});

test('Actor delete errors propagate without retrying a manifest route', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.deleteActor = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.deleteActor('scene.ini', 'actor-id', { archive_session: 'old' }),
    error => error === failure);
});

test('Actor resource rebinding uses the scoped typed scene binding with JSON disabled', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { ok: true, status: 'loaded', archive_session: 'archive', scene: 'scene.ini',
    actor_guid: 'actor-id', actor: { name: 'Probe', actor_guid: 'actor-id', load_status: 'loaded' } };
  native.rebindActorResource = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('actor resource JSON transport is forbidden'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.rebindActorResource('scene.ini', 'actor-id', 'Models/probe.obj', scope), result);
  assert.deepEqual(calls, [['scene.ini', 'actor-id', 'Models/probe.obj', scope]]);
  assert.equal('rebindActorResource' in (editorApi.sceneTools || {}), false);
});

test('Actor resource rebinding errors never retry a manifest route', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.rebindActorResource = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.rebindActorResource('scene.ini', 'actor-id', 'Models/probe.obj', {
    archive_session: 'old',
  }), error => error === failure);
});

test('scene save uses one scoped typed V8 operation and retires duplicate save facades', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  const result = { status: 'saved', archive_session: 'archive', scene: 'scene.ini', filepath: 'scene.ini' };
  native.save = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('scene save JSON transport is forbidden'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.save('scene.ini', scope), result);
  assert.deepEqual(calls, [['scene.ini', scope]]);
  assert.equal('saveActor' in (editorApi.sceneTools || {}), false);
  assert.equal(editorApi.main, undefined);
});

test('scene save preserves native archive failures without an actor or manifest fallback', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('old archive'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.save = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.save('scene.ini', { archive_session: 'old' }), error => error === failure);
});

test('model file selection uses one scoped typed V8 operation and preserves cancellation', async t => {
  const { native } = nativeScene(t);
  const calls = [];
  native.selectModelFile = async (...args) => { calls.push(args); return ''; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('model selection JSON transport is forbidden'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.selectModelFile('scene.ini', 'model', scope), '');
  assert.deepEqual(calls, [['scene.ini', { ...scope, file_type: 'model' }]]);
  assert.equal('selectModelFile' in (editorApi.sceneTools || {}), false);
});

test('IK reads and revisioned writes use one scoped V8 contract with JSON disabled', async t => {
  const { native } = nativeScene(t), calls = [];
  const skeleton = { is_skinned: true, nodes: [{ name: 'Root', index: 0, parent: -1, leaf: false }] };
  const config = { ready: true, is_skinned: true, revision: 4, chains: [] };
  const written = { ready: true, is_skinned: true, revision: 5, chains: [] };
  const rig = { skeleton, ik: config };
  native.readActorRig = async (...args) => { calls.push(['rig', ...args]); return rig; };
  native.setActorIkChains = async (...args) => { calls.push(['write', ...args]); return written; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('IK JSON transport is forbidden'); };
  const scope = { archive_session: 'archive' };
  const chains = [{ id: 'foot', bone_name: 'Foot', mode: 'foot_plant', enabled: true }];
  assert.equal(await editorApi.scene.readActorRig('scene.ini', 'actor-guid', scope), rig);
  assert.equal(await editorApi.scene.setActorIkChains('scene.ini', 'actor-guid', chains, 4, scope), written);
  assert.deepEqual(calls, [
    ['rig', 'scene.ini', 'actor-guid', scope],
    ['write', 'scene.ini', 'actor-guid', chains, 4, scope],
  ]);
  for (const method of ['getActorSkeletonLeaves', 'getActorIkChains', 'setActorIkChains']) {
    assert.equal(method in (editorApi.sceneTools || {}), false, `legacy IK facade ${method} must be retired`);
  }
});

test('IK V8 failures are propagated without retrying manifest routes', async t => {
  const { native } = nativeScene(t);
  const failure = Object.assign(new Error('archive changed'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.readActorRig = native.setActorIkChains = () => Promise.reject(failure);
  await assert.rejects(editorApi.scene.readActorRig('scene.ini', 'actor', { archive_session: 'old' }), error => error === failure);
  await assert.rejects(editorApi.scene.setActorIkChains('scene.ini', 'actor', [], 4, { archive_session: 'old' }), error => error === failure);
});

test('actor context reads use one scoped typed V8 projection without the legacy tree facade', async t => {
  const { native } = nativeScene(t), calls = [];
  const result = {
    archive_session: 'archive', scene: 'scene.ini', tree_revision: 8,
    actors: [{ name: 'Probe', actor_guid: 'actor-guid', type: 'actor', semantic_role: 'probe',
      geometry: { position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
      size: [2, 3, 4], collision: 'box', physics_enabled: true }],
  };
  native.readScene = async (...args) => { calls.push(args); return result; };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('actor context JSON transport is forbidden'); };
  const scope = { archive_session: 'archive' };
  assert.equal(await editorApi.scene.readScene({ ...(scope), scene: 'scene.ini', actors: 'context' }), result);
  assert.deepEqual(calls, [[{ ...scope, scene: 'scene.ini', actors: 'context' }]]);
  assert.equal('listActorTree' in editorApi.scene, false);
});
