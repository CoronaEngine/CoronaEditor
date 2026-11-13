import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { mountMainPage } from './mainPageFixtures.mjs';
import { deferred } from './windowSessionFixtures.mjs';

function retire(h, kind) {
  if (kind === 'unmount') h.unmount();
  if (kind === 'archive') h.page.environmentArchiveSession.value = 'replacement';
  if (kind === 'scene') h.page.currentSceneId.value = 'other.xml';
}
for (const retirement of ['unmount', 'archive', 'scene']) {
  for (const [name, method, args, native] of [
    ['light', 'updateSceneLight', ['x'], 'setEnvironment'],
    ['grid', 'setSceneGridEnabledFromPanel', [false], 'setEnvironment'],
    ['physics write', 'handleApplyPhysics', [], 'setEnvironment'],
    ['physics read', 'loadPhysicsParams', [], 'readEnvironment'],
    ['resource status', 'pollProjectResourceLoadStatus', [], 'getProjectLoadStatus'],
  ]) for (const failure of [false, true]) {
    test(`main ${name} ${failure ? 'failure' : 'reply'} is retired after ${retirement}`, async t => {
      const h = mountMainPage(t); await h.mount();
      const pending = deferred();
      (name === 'resource status' ? h.api.project : h.api.scene)[native] = () => pending.promise;
      const action = h.page[method](...args);
      retire(h, retirement);
      const before = { grid: h.page.sceneGridEnabled.value, physics: { ...h.page.physicsParams.value },
        busy: h.page.sceneLightBusy.value, records: h.records.length, calls: h.calls.length,
        errors: h.errors.length, status: h.page.projectResourceLoadStatus.value, timers: h.timers.size };
      if (failure) pending.reject(Error('retired operation failed'));
      else pending.resolve({ archive_session: 'main-archive', scene: 'scene_v3.xml',
        physics: { gravity: [99, 99, 99] }, active: true, loading: true });
      const result = await action;
      if (name !== 'resource status') assert.equal(result, false);
      assert.deepEqual({ grid: h.page.sceneGridEnabled.value, physics: { ...h.page.physicsParams.value },
        busy: h.page.sceneLightBusy.value, records: h.records.length, calls: h.calls.length,
        errors: h.errors.length, status: h.page.projectResourceLoadStatus.value, timers: h.timers.size }, before);
    });
  }
}

test('light event records the submitted direction instead of a later draft', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.scene.setEnvironment = () => pending.promise;
  h.page.sceneLightSettings.direction.x = 3;
  const saving = h.page.updateSceneLight('x');
  h.page.sceneLightSettings.direction.x = 8;
  pending.resolve({}); assert.equal(await saving, true);
  assert.equal(h.records.at(-1).details.value, 3);
});

test('light scope replacement permits a new edit and old finally cannot release its busy flag', async t => {
  const h = mountMainPage(t); await h.mount(); const first = deferred(), next = deferred(); let writes = 0;
  h.api.scene.setEnvironment = () => ++writes === 1 ? first.promise : next.promise;
  const old = h.page.updateSceneLight();
  h.page.environmentArchiveSession.value = 'replacement';
  assert.equal(h.page.sceneLightBusy.value, false);
  const current = h.page.updateSceneLight(); assert.equal(writes, 2);
  first.resolve({}); assert.equal(await old, false); assert.equal(h.page.sceneLightBusy.value, true);
  next.resolve({}); assert.equal(await current, true); assert.equal(h.page.sceneLightBusy.value, false);
});

test('an older grid reply cannot undo a newer grid choice', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred(); let writes = 0;
  h.api.scene.setEnvironment = () => ++writes === 1 ? pending.promise : Promise.resolve({});
  const old = h.page.setSceneGridEnabledFromPanel(false);
  await h.page.setSceneGridEnabledFromPanel(true);
  pending.resolve({}); assert.equal(await old, false); assert.equal(h.page.sceneGridEnabled.value, true);
});

test('physics read started before a new write cannot replace the submitted values', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.scene.readEnvironment = () => pending.promise;
  const reading = h.page.loadPhysicsParams();
  await h.page.applyPhysicsFromSettings({ floorY: 6 });
  pending.resolve({ physics: { floor_y: 1 } });
  assert.equal(await reading, false); assert.equal(h.page.physicsParams.value.floorY, 6);
});

for (const failure of [false, true]) test(`older resource ${failure ? 'failure' : 'reply'} cannot replace a newer sample`, async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred(); let reads = 0;
  h.api.project.getProjectLoadStatus = () => ++reads === 1 ? pending.promise : Promise.resolve({ active: true, loading: true, ready: 5 });
  const old = h.page.pollProjectResourceLoadStatus();
  await h.page.pollProjectResourceLoadStatus();
  const before = h.page.projectResourceLoadStatus.value, timers = h.timers.size;
  if (failure) pending.reject(Error('old status failed')); else pending.resolve({ active: true, loading: true, ready: 1 });
  await old;
  assert.deepEqual(h.page.projectResourceLoadStatus.value, before); assert.equal(h.timers.size, timers);
  assert.deepEqual(h.errors, []);
});

test('stopping resource polling also retires its in-flight sample', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.project.getProjectLoadStatus = () => pending.promise;
  const reading = h.page.pollProjectResourceLoadStatus(); h.page.stopProjectResourceLoadPolling();
  pending.resolve({ active: true, loading: true }); await reading;
  assert.equal(h.page.projectResourceLoadStatus.value, null); assert.equal(h.timers.size, 0);
});

test('camera projection read before environment edits cannot roll back light and grid', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.scene.readEnvironment = () => pending.promise;
  const reading = h.page.syncSceneCameraBinding('scene_v3.xml');
  h.page.sceneLightSettings.direction.x = 7; await h.page.updateSceneLight('x');
  await h.page.setSceneGridEnabledFromPanel(false);
  pending.resolve({ archive_session: 'main-archive', scene: 'scene_v3.xml', sun: { direction: [1, 1, 1] }, grid: { enabled: true } });
  await reading;
  assert.equal(h.page.sceneLightSettings.direction.x, 7); assert.equal(h.page.sceneGridEnabled.value, false);
});


test('camera projection from a previous scene in the same archive is retired', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.scene.readEnvironment = () => pending.promise;
  const reading = h.page.syncSceneCameraBinding('scene_v3.xml');
  h.page.currentSceneId.value = 'other.xml';
  pending.resolve({ archive_session: 'main-archive', scene: 'scene_v3.xml', sun: { direction: [99, 1, 1] } });
  assert.equal(await reading, false); assert.notEqual(h.page.sceneLightSettings.direction.x, 99);
});

for (const field of ['archive_session', 'scene']) test(`physics projection rejects a foreign ${field}`, async t => {
  const h = mountMainPage(t); await h.mount();
  h.api.scene.readEnvironment = async () => ({ archive_session: 'main-archive', scene: 'scene_v3.xml',
    [field]: 'foreign', physics: { floor_y: 99 } });
  assert.equal(await h.page.loadPhysicsParams(), false);
  assert.notEqual(h.page.physicsParams.value.floorY, 99);
});

for (const [name, action, changed] of [
  ['physics', h => h.page.applyPhysicsFromSettings({ floorY: 99 }), h => h.page.physicsParams.value.floorY],
  ['light enabled', h => h.creativeActions.setSceneLightEnabled(false), h => h.page.sceneLightSettings.enabled],
  ['light direction', h => h.creativeActions.setSceneLightDirection('x', 99), h => h.page.sceneLightSettings.direction.x],
]) test(`retired ${name} action cannot modify its old draft`, async t => {
  const h = mountMainPage(t); await h.mount(); h.unmount(); const before = changed(h);
  assert.equal(await action(h), false); assert.equal(changed(h), before);
});

test('a camera refresh started during a light write preserves the draft while still applying cameras', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.scene.setEnvironment = () => pending.promise;
  h.page.sceneLightSettings.direction.x = 7;
  const saving = h.page.updateSceneLight('x');
  h.api.scene.readEnvironment = async () => ({ archive_session: 'main-archive', scene: 'scene_v3.xml', sun: { direction: [1, 1, 1] } });
  assert.equal(await h.page.syncSceneCameraBinding('scene_v3.xml'), true);
  assert.equal(h.page.sceneLightSettings.direction.x, 7);
  assert.equal(h.page.cameraBindingState.value.cameraId, 'camera-1');
  pending.resolve({}); await saving;
  assert.equal(await h.page.syncSceneCameraBinding('scene_v3.xml'), true);
  assert.equal(h.page.sceneLightSettings.direction.x, 1);
});

test('current light failure still restores native values and releases busy', async t => {
  const h = mountMainPage(t); await h.mount();
  h.api.scene.setEnvironment = async () => { throw Error('native rejected'); };
  h.api.scene.readEnvironment = async () => ({ archive_session: 'main-archive', scene: 'scene_v3.xml', sun: { direction: [2, 1, 1] } });
  h.page.sceneLightSettings.direction.x = 9;
  assert.equal(await h.page.updateSceneLight('x'), false);
  assert.equal(h.page.sceneLightSettings.direction.x, 2);
  assert.equal(h.page.sceneLightBusy.value, false); assert.equal(h.errors.length, 1);
});

test('current resource samples schedule exactly one next poll and stop when loading ends', async t => {
  const h = mountMainPage(t); await h.mount(); let reads = 0;
  h.api.project.getProjectLoadStatus = async () => ++reads === 1 ? { active: true, loading: true, ready: 1 } : { active: true, loading: false };
  await h.page.pollProjectResourceLoadStatus(); assert.equal(h.timers.size, 1);
  const [id, callback] = [...h.timers][0]; h.timers.delete(id); callback();
  await setImmediate();
  assert.equal(reads, 2); assert.equal(h.timers.size, 0); assert.equal(h.page.projectResourceLoadStatus.value, null);
});

test('a queued resource timer cannot restart a stopped polling chain', async t => {
  const h = mountMainPage(t); await h.mount(); let reads = 0;
  h.api.project.getProjectLoadStatus = async () => { reads++; return { active: true, loading: true }; };
  await h.page.pollProjectResourceLoadStatus(); const callback = [...h.timers.values()][0];
  h.page.stopProjectResourceLoadPolling(); callback(); await Promise.resolve();
  assert.equal(reads, 1); assert.equal(h.timers.size, 0);
});
