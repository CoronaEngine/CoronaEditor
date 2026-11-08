import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { effectScope, nextTick, ref, watch } from 'vue';
import { parse } from 'vue/compiler-sfc';

const source = fs.readFileSync(new URL('../../src/views/sidebar/SceneControls.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = descriptor.scriptSetup.content.replace(/^import .*;\r?\n/gm, '');
const physics = { gravityX: 0, gravityY: -9.8, gravityZ: 0, floorY: 0, floorRestitution: 0.5, fixedDt: 0.01 };

function mount(t, { withoutJson = false } = {}) {
  const state = ref({ physics: { ...physics }, cameraId: 'camera-1' });
  const scope = effectScope();
  t.after(() => scope.stop());
  const context = vm.createContext({
    ref, watch, PLUGIN_MANIFEST: [], appService: {},
    useI18n: () => ({ t: value => value }),
    useCreativePanelState: () => ({ state }),
    ...(withoutJson ? { JSON: {
      stringify() { throw new Error('Physics draft must not serialize message DTOs'); },
      parse() { throw new Error('Physics draft must not parse message DTOs'); },
    } } : {}),
  });
  const draft = scope.run(() => vm.runInContext(`${script}\nphysicsDraft;`, context));
  return { state, draft, scope };
}

test('physics message initializes the draft without JSON conversion', t => {
  const { state, draft } = mount(t, { withoutJson: true });
  assert.deepEqual({ ...draft.value }, physics);
  draft.value.floorY = 7;
  assert.equal(state.value.physics.floorY, 0);
});

test('equal physics in a camera broadcast preserves unsubmitted edits and draft identity', async t => {
  const { state, draft } = mount(t);
  draft.value.floorY = 7;
  const editing = draft.value;
  state.value = { cameraId: 'camera-2', physics: Object.fromEntries(Object.entries(physics).reverse()) };
  await nextTick();
  assert.equal(draft.value, editing);
  assert.equal(draft.value.floorY, 7);
});

for (const field of Object.keys(physics)) {
  test(`changed ${field} refreshes the independent physics draft`, async t => {
    const { state, draft } = mount(t);
    draft.value.floorY = 7;
    state.value.physics[field] = physics[field] + 1;
    await nextTick();
    assert.deepEqual({ ...draft.value }, { ...physics, [field]: physics[field] + 1 });
    assert.notEqual(draft.value, state.value.physics);
  });
}

test('missing physics clears the old draft and later state restores it', async t => {
  const { state, draft } = mount(t);
  state.value = {};
  await nextTick();
  assert.deepEqual({ ...draft.value }, {});
  state.value.physics = { ...physics };
  await nextTick();
  assert.deepEqual({ ...draft.value }, physics);
});

test('retired scene controls stop updating the physics draft', async t => {
  const { state, draft, scope } = mount(t);
  const editing = draft.value;
  scope.stop();
  state.value.physics.floorY = 9;
  await nextTick();
  assert.equal(draft.value, editing);
  assert.equal(draft.value.floorY, 0);
});
