import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureStoryMap, MAP_GUID, MAP_MODEL_REF, mapOriginTransform } from '../../frontend/storyMap.mjs';

const options = api => ({ api, sceneId: 'scene.ini', frontendUrl: 'file:///editor/index.html',
  resolveAsset: () => 'map.glb', wait: async () => {} });

test('map cancellation while importing prevents readiness reads and further writes', async () => {
  let current = true, reads = 0, writes = 0;
  const api = {
    scene: { getSnapshot: async () => { reads++; return { actors: [] }; } },
    sceneTools: { createActor: async () => {
      writes++; current = false;
      return { status: 'success', actor: { actor_guid: MAP_GUID } };
    } },
  };
  await assert.rejects(ensureStoryMap({ ...options(api), isCurrent: () => current }), { name: 'AbortError' });
  assert.equal(reads, 1);
  assert.equal(writes, 1);
});

test('map replacement cancellation does not retry another identity or create a new actor', async () => {
  let current = true;
  const keys = [];
  const api = {
    scene: { getSnapshot: async () => ({ actors: [{ actor_guid: MAP_GUID,
      name: 'map', handle: 42, model_ref: 'old-map' }] }) },
    sceneTools: {
      removeActor: async (_scene, key) => { keys.push(key); current = false; return { status: 'success' }; },
      createActor: async () => assert.fail('canceled replacement must not create'),
    },
  };
  await assert.rejects(ensureStoryMap({ ...options(api), isCurrent: () => current }), { name: 'AbortError' });
  assert.deepEqual(keys, [MAP_GUID]);
});

test('map readiness polling verifies the current world before every native read', async () => {
  const actor = { actor_guid: MAP_GUID, model_ref: MAP_MODEL_REF, geometry: mapOriginTransform() };
  let checks = 0, reads = 0;
  const api = {
    scene: { getSnapshot: async () => { reads++; return { actors: [actor] }; } },
    sceneTools: { createActor: async () => ({ status: 'success', actor }) },
  };
  await assert.rejects(ensureStoryMap({ ...options(api), assertSource: async () => {
    if (++checks >= 3) throw new Error('world changed');
  } }), /world changed/);
  assert.ok(reads <= 2, 'no read is sent after source validation fails');
});
