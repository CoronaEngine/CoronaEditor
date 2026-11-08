import assert from 'node:assert/strict';
import test from 'node:test';
import { mountMainPage } from './mainPageFixtures.mjs';
import { deferred } from './windowSessionFixtures.mjs';

const scene = 'scene_v3.xml', archive = 'main-archive';
const selection = name => ({ scene, actor: name, actor_type: 'model', archive_session: archive });
const actor = (name, guid = name) => ({ name, actor_guid: guid, type: 'model' });
const snapshot = actors => ({ scene, archive_session: archive, actors });

async function mount(t) {
  const h = mountMainPage(t); await h.mount();
  const effects = [];
  h.api.gizmo = { setTarget: async (...args) => effects.push(['gizmo', ...args]) };
  h.dock.openPanel = id => { effects.push(['open', id]); h.dock.panels[id] = { open: true }; };
  h.api.scene.readActorProperties = async () => ({ scene, archive_session: archive, geometry: {} });
  return { ...h, effects };
}

function retire(h, kind) {
  if (kind === 'unmount') h.unmount();
  if (kind === 'archive') h.page.environmentArchiveSession.value = 'replacement';
  if (kind === 'scene') h.page.currentSceneId.value = 'other.xml';
  if (kind === 'camera') h.page.cameraBindingState.value.cameraId = 'other-camera';
  if (kind === 'handle') h.page.cameraBindingState.value.cameraHandle = 'other-handle';
  if (kind === 'scene ABA') {
    h.page.currentSceneId.value = 'other.xml'; h.page.currentSceneId.value = scene;
  }
  if (kind === 'archive ABA') {
    h.page.environmentArchiveSession.value = 'replacement'; h.page.environmentArchiveSession.value = archive;
  }
  for (const [name, field] of [['camera ABA', 'cameraId'], ['handle ABA', 'cameraHandle']]) if (kind === name) {
    const original = h.page.cameraBindingState.value[field];
    h.page.cameraBindingState.value[field] = 'replacement'; h.page.cameraBindingState.value[field] = original;
  }
}

for (const retirement of ['unmount', 'archive', 'scene', 'camera', 'handle', 'scene ABA', 'archive ABA', 'camera ABA', 'handle ABA']) {
  for (const failure of [false, true]) test(`main selection ${failure ? 'failure' : 'reply'} after ${retirement} has no gizmo or Dock effects`, async t => {
    const h = await mount(t), pending = deferred();
    h.api.scene.readActorIndex = () => pending.promise;
    const old = h.page.handleActorSelectionForObjectDock(selection('A'));
    retire(h, retirement);
    const before = h.effects.slice();
    if (failure) pending.reject(Error('retired index read')); else pending.resolve(snapshot([actor('A')]));
    await old;
    assert.deepEqual(h.effects, before);
  });
}

for (const failure of [false, true]) test(`new selection wins over an older index ${failure ? 'failure' : 'reply'}`, async t => {
  const h = await mount(t), pending = deferred(); let reads = 0;
  h.api.scene.readActorIndex = () => ++reads === 1 ? pending.promise : Promise.resolve(snapshot([actor('B', 'new-B')]));
  const old = h.page.handleActorSelectionForObjectDock(selection('A'));
  await h.page.handleActorSelectionForObjectDock(selection('B'));
  const before = h.effects.slice();
  if (failure) pending.reject(Error('old read')); else pending.resolve(snapshot([actor('A'), actor('B', 'old-B')]));
  await old;
  assert.deepEqual(h.effects, before, 'old selection must not replace or clear the new gizmo');
  await h.page.handleActorSelectionForObjectDock(selection('B'));
  assert.equal(h.effects.at(-1)[3].actor_guid, 'new-B', 'old selection must not poison the shared Actor index');
});

for (const replacement of ['empty', 'node', 'cameraView']) test(`${replacement} selection retires an in-flight main Actor selection`, async t => {
  const h = await mount(t), pending = deferred();
  h.api.scene.readActorIndex = () => pending.promise;
  const old = h.page.handleActorSelectionForObjectDock(selection('A'));
  if (replacement === 'empty') await h.page.handleActorSelectionForObjectDock({ scene, actor_type: 'scene' });
  if (replacement === 'node') h.bus.emit('model-node-selection', { actorName: 'B', nodeIndex: 1 });
  if (replacement === 'cameraView') await h.page.handleActorSelectionForObjectDock({ ...selection('B'), source_viewport: 'cameraView', source_camera_id: 'secondary' });
  h.dock.panels.Object = { open: false };
  const before = h.effects.slice();
  pending.resolve(snapshot([actor('A')])); await old;
  assert.deepEqual(h.effects, before);
});

for (const scope of ['unmount', 'scene', 'archive']) test(`selection entry rejects ${scope} before publishing or reading`, async t => {
  const h = await mount(t);
  let reads = 0, events = 0;
  h.api.scene.readActorIndex = h.api.scene.readActorProperties = async () => { reads++; return snapshot([]); };
  h.bus.on('model-node-selection', () => events++);
  if (scope === 'unmount') h.unmount();
  const payload = { ...selection('A'), actor_name: 'A', node_index: 1 };
  if (scope === 'scene') payload.scene = 'foreign.xml';
  if (scope === 'archive') payload.archive_session = 'foreign';
  const before = h.effects.slice();
  await h.page.handleActorSelectionForObjectDock(payload);
  assert.deepEqual({ reads, events, effects: h.effects }, { reads: 0, events: 0, effects: before });
});

test('current selection still opens Object and installs the resolved native gizmo target', async t => {
  const h = await mount(t);
  h.api.scene.readActorIndex = async () => snapshot([actor('A')]);
  await h.page.handleActorSelectionForObjectDock(selection('A'));
  assert.deepEqual(h.effects, [
    ['gizmo', scene, 'camera-1', { archive_session: archive, actor_guid: 'A' }], ['open', 'Object'],
  ]);
});

test('a current failed Actor lookup still permits opening Object', async t => {
  const h = await mount(t);
  h.api.scene.readActorIndex = async () => { throw Error('index unavailable'); };
  await h.page.handleActorSelectionForObjectDock(selection('A'));
  assert.deepEqual(h.effects.at(-1), ['open', 'Object']);
  assert.equal(h.effects[0][3].actor_guid, null);
});

test('selection without a bound camera can still open Object without a native gizmo write', async t => {
  const h = await mount(t);
  h.page.cameraBindingState.value.cameraId = null;
  h.api.scene.readActorIndex = async () => snapshot([actor('A')]);
  await h.page.handleActorSelectionForObjectDock(selection('A'));
  assert.deepEqual(h.effects, [['open', 'Object']]);
});

test('a projection refresh of the same camera binding preserves the current selection request', async t => {
  const h = await mount(t), pending = deferred();
  h.api.scene.readActorIndex = () => pending.promise;
  const selecting = h.page.handleActorSelectionForObjectDock(selection('A'));
  h.page.cameraBindingState.value = { ...h.page.cameraBindingState.value };
  pending.resolve(snapshot([actor('A')])); await selecting;
  assert.deepEqual(h.effects.at(-1), ['open', 'Object']);
  assert.equal(h.effects[0][3].actor_guid, 'A');
});

test('retired selection cannot seed an old transform baseline after selection changes', async t => {
  const h = await mount(t), pending = deferred();
  h.api.scene.readActorProperties = () => pending.promise;
  h.api.scene.readActorIndex = async () => snapshot([actor('A')]);
  await h.page.handleActorSelectionForObjectDock(selection('A'));
  await h.page.handleActorSelectionForObjectDock({ scene, actor_type: 'scene' });
  pending.resolve({ scene, archive_session: archive, geometry: { position: [9, 9, 9] } });
  await pending.promise;
  assert.equal(h.page.actorTransformBaselines.size, 0);
});
