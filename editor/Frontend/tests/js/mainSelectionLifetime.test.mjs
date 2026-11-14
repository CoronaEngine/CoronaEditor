import assert from 'node:assert/strict';
import test from 'node:test';
import { mountMainPage } from './mainPageFixtures.mjs';
import { deferred } from './windowSessionFixtures.mjs';

const scene = 'scene_v3.xml', archive = 'main-archive';
const selection = name => ({ scene, actor: name, actor_type: 'model', archive_session: archive });
const snapshot = actors => ({ scene, archive_session: archive, actors });

async function mount(t) {
  const h = mountMainPage(t); await h.mount();
  const effects = [];
  h.dock.openPanel = id => { effects.push(['open', id]); h.dock.panels[id] = { open: true }; };
  h.api.scene.readActorProperties = async () => ({ scene, archive_session: archive, geometry: {} });
  return { ...h, effects };
}

test('a current selection opens Object in the scene it belongs to', async t => {
  const h = await mount(t);
  await h.page.handleActorSelectionForObjectDock(selection('A'));
  assert.deepEqual(h.effects, [['open', 'Object']]);
});

test('a scene selection opens nothing', async t => {
  const h = await mount(t);
  await h.page.handleActorSelectionForObjectDock({ scene, actor_type: 'scene' });
  assert.deepEqual(h.effects, []);
});

test('a current selection still opens Object when the transform read fails', async t => {
  const h = await mount(t);
  h.api.scene.readActorProperties = async () => { throw Error('properties unavailable'); };
  await h.page.handleActorSelectionForObjectDock(selection('A'));
  assert.deepEqual(h.effects, [['open', 'Object']]);
});

for (const scope of ['unmount', 'scene', 'archive']) test(`selection entry rejects ${scope} before publishing or reading`, async t => {
  const h = await mount(t);
  let reads = 0, events = 0;
  h.api.scene.readScene.projections.index = h.api.scene.readActorProperties = async () => { reads++; return snapshot([]); };
  h.bus.on('model-node-selection', () => events++);
  if (scope === 'unmount') h.unmount();
  const payload = { ...selection('A'), actor_name: 'A', node_index: 1 };
  if (scope === 'scene') payload.scene = 'foreign.xml';
  if (scope === 'archive') payload.archive_session = 'foreign';
  const before = h.effects.slice();
  await h.page.handleActorSelectionForObjectDock(payload);
  assert.deepEqual({ reads, events, effects: h.effects }, { reads: 0, events: 0, effects: before });
});

test('retired selection cannot seed an old transform baseline after selection changes', async t => {
  const h = await mount(t), pending = deferred();
  h.api.scene.readActorProperties = () => pending.promise;
  await h.page.handleActorSelectionForObjectDock(selection('A'));
  await h.page.handleActorSelectionForObjectDock({ scene, actor_type: 'scene' });
  pending.resolve({ scene, archive_session: archive, geometry: { position: [9, 9, 9] } });
  await pending.promise;
  assert.equal(h.page.actorTransformBaselines.size, 0);
});
