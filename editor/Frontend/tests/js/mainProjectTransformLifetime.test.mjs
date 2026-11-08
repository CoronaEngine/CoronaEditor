import assert from 'node:assert/strict';
import test from 'node:test';
import { mountMainPage } from './mainPageFixtures.mjs';
import { deferred } from './windowSessionFixtures.mjs';

const scene = 'scene_v3.xml', archive = 'main-archive', key = `${scene}::Probe`;
const transform = x => ({ scene, actor: 'Probe', archive_session: archive,
  position: [x, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
const properties = x => ({ scene, archive_session: archive, geometry: transform(x) });

for (const retirement of ['unmount', 'archive', 'scene', 'new project']) {
  test(`project event failure after ${retirement} does not report an old error`, async t => {
    const h = mountMainPage(t); await h.mount(); const pending = deferred();
    h.api.scene.readActive = () => pending.promise;
    const old = h.page.onProjectOpenedEvent({ archive_session: archive });
    if (retirement === 'unmount') h.unmount();
    if (retirement === 'archive') h.page.environmentArchiveSession.value = 'replacement';
    if (retirement === 'scene') h.page.currentSceneId.value = 'other.xml';
    if (retirement === 'new project') {
      h.api.scene.readActive = async () => ({ archive_session: archive, scene });
      await h.page.onProjectOpenedEvent({ archive_session: archive });
    }
    const before = h.errors.slice();
    pending.reject(Error('old project read failed')); await old;
    assert.deepEqual(h.errors, before);
  });
}

test('a current project event read failure still reports the native error', async t => {
  const h = mountMainPage(t); await h.mount(); const failure = Error('native read unavailable');
  h.api.scene.readActive = async () => { throw failure; };
  await h.page.onProjectOpenedEvent({ archive_session: archive });
  assert.equal(h.errors.length, 1);
  assert.equal(h.errors[0][1], failure);
});

test('a rejected stale notification does not suppress the current refresh error', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.scene.readActive = () => pending.promise;
  const current = h.page.onProjectOpenedEvent({ archive_session: archive });
  h.api.scene.readActive = async () => ({ archive_session: archive, scene });
  await h.page.onProjectOpenedEvent({ archive_session: 'stale' });
  pending.reject(Error('current refresh failed')); await current;
  assert.equal(h.errors.length, 1);
});

for (const scope of ['scene', 'archive']) test(`a sampled project reply cannot restore bindings after the observed ${scope} changes`, async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.scene.readActive = () => pending.promise;
  const old = h.page.onProjectOpenedEvent({ archive_session: archive });
  if (scope === 'archive') h.page.environmentArchiveSession.value = 'replacement';
  else h.page.currentSceneId.value = 'other.xml';
  h.calls.length = 0;
  pending.resolve({ archive_session: archive, scene }); await old;
  assert.deepEqual(h.calls, []);
  assert.equal(scope === 'archive' ? h.page.environmentArchiveSession.value : h.page.currentSceneId.value,
    scope === 'archive' ? 'replacement' : 'other.xml');
});

test('a retired project callback does not start a native read', async t => {
  const h = mountMainPage(t); await h.mount(); h.unmount(); let reads = 0;
  h.api.scene.readActive = async () => { reads++; return {}; };
  await h.page.onProjectOpenedEvent({ archive_session: archive });
  assert.equal(reads, 0);
});

test('a delayed property baseline cannot replace a newer transform notification', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred();
  h.api.scene.readActorProperties = () => pending.promise;
  const seeding = h.page.seedActorTransformBaseline(scene, 'Probe');
  h.page.handleActorTransformForCabbage(transform(4));
  pending.resolve(properties(0)); await seeding;
  assert.equal(h.page.actorTransformBaselines.get(key).position.x, 4);
  h.page.handleActorTransformForCabbage(transform(4));
  assert.deepEqual(h.records, [], 'a repeated live value must not be recorded as a new transform');
});

test('a newer property baseline wins when two reads finish out of order', async t => {
  const h = mountMainPage(t); await h.mount(); const pending = deferred(); let reads = 0;
  h.api.scene.readActorProperties = () => ++reads === 1 ? pending.promise : Promise.resolve(properties(4));
  const old = h.page.seedActorTransformBaseline(scene, 'Probe');
  await h.page.seedActorTransformBaseline(scene, 'Probe');
  pending.resolve(properties(0)); await old;
  assert.equal(h.page.actorTransformBaselines.get(key).position.x, 4);
});

test('a superseded property read cannot seed a baseline while the newer read is still pending', async t => {
  const h = mountMainPage(t); await h.mount(); const first = deferred(), second = deferred(); let reads = 0;
  h.api.scene.readActorProperties = () => ++reads === 1 ? first.promise : second.promise;
  const old = h.page.seedActorTransformBaseline(scene, 'Probe');
  const current = h.page.seedActorTransformBaseline(scene, 'Probe');
  first.resolve(properties(0)); await old; assert.equal(h.page.actorTransformBaselines.size, 0);
  second.resolve(properties(4)); await current;
  assert.equal(h.page.actorTransformBaselines.get(key).position.x, 4);
});

for (const scope of ['unmount', 'archive', 'scene', 'missing archive']) {
  test(`transform notification rejects ${scope} before mutating the baseline or recording`, async t => {
    const h = mountMainPage(t); await h.mount();
    h.page.handleActorTransformForCabbage(transform(0));
    const payload = transform(4);
    if (scope === 'unmount') h.unmount();
    if (scope === 'archive') payload.archive_session = 'old-archive';
    if (scope === 'scene') payload.scene = 'other.xml';
    if (scope === 'missing archive') delete payload.archive_session;
    const before = [...h.page.actorTransformBaselines];
    h.page.handleActorTransformForCabbage(payload);
    assert.deepEqual([...h.page.actorTransformBaselines], before);
    assert.deepEqual(h.records, []);
  });
}

for (const scope of ['archive', 'scene']) test(`switching ${scope} clears transform baselines even at the same project path`, async t => {
  const h = mountMainPage(t); await h.mount();
  h.page.handleActorTransformForCabbage(transform(0)); assert.equal(h.page.actorTransformBaselines.size, 1);
  if (scope === 'archive') h.page.environmentArchiveSession.value = 'replacement';
  else h.page.currentSceneId.value = 'other.xml';
  assert.equal(h.page.actorTransformBaselines.size, 0);
});

test('current transform notifications still record changed fields after the initial echo', async t => {
  const h = mountMainPage(t); await h.mount();
  h.page.handleActorTransformForCabbage(transform(0));
  h.page.handleActorTransformForCabbage(transform(4));
  assert.equal(h.records.length, 1);
  assert.equal(h.records[0].type, 'transform_position');
  assert.deepEqual(h.records[0].details, { sceneName: scene, actorName: 'Probe', source: 'viewport' });
});
