import assert from 'node:assert/strict';
import test from 'node:test';
import { editorApi } from '../../src/api/editorApi.js';

test('consolidated scene methods forward owned objects without JSON transport', async t => {
  const previous = globalThis.window;
  const parse = JSON.parse, stringify = JSON.stringify;
  t.after(() => { globalThis.window = previous; JSON.parse = parse; JSON.stringify = stringify; });
  const calls = [], result = { archive_session: 'archive', scene: 'scene.ini' };
  const names = ['read_scene', 'update_actor', 'update_camera', 'read_actor_rig'];
  globalThis.window = { corona: { scene: Object.fromEntries(names.map(name => [name,
    async (...args) => { calls.push([name, ...args]); return result; }])) } };
  JSON.parse = JSON.stringify = () => { throw Error('JSON DTO transport'); };
  const scope = { archive_session: 'archive' };
  const query = { ...scope, scene: 'scene.ini', actors: 'index', cameras: true };
  assert.equal(await editorApi.scene.read_scene(query), result);
  assert.equal(await editorApi.scene.update_actor('scene.ini', 'actor-guid', { ...scope, name: 'Renamed', visible: false }), result);
  assert.equal(await editorApi.scene.update_camera('scene.ini', 'camera-id', { ...scope, name: 'Camera', fov: 60 }), result);
  assert.equal(await editorApi.scene.read_actor_rig('scene.ini', 'actor-guid', scope), result);
  assert.equal(calls[0][1], query);
  assert.deepEqual(calls.map(call => call[0]), names);
});

test('retired scene methods are absent while transform and IK writes remain scoped', () => {
  for (const name of ['readTree', 'readActorIndex', 'readActorTree', 'readCameras',
    'renameActor', 'setActorProperties', 'renameCamera', 'setCameraProperties',
    'readActorSkeleton', 'readActorIkChains']) assert.equal(editorApi.scene[name], undefined, name);
  for (const name of ['read_active', 'read_transforms', 'set_actor_transform', 'set_actor_ik_chains'])
    assert.equal(typeof editorApi.scene[name], 'function', name);
});
