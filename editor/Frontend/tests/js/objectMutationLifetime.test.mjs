import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { computed, reactive, ref } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';
import { pickedNodeIdentity } from '../../src/utils/modelHierarchy.js';
import * as ik from '../../src/utils/ikEditorController.js';
import { deferred } from './windowSessionFixtures.mjs';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/sidebar/Object.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'object-mutation-lifetime' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');

function mount(t, overrides = {}) {
  const calls = [], errors = [], events = [], saves = [], timers = new Map(), frames = new Map();
  let timerId = 0;
  let unmounted;
  const scene = new Proxy({}, { get: (_, method) => (...args) => {
    calls.push({ method, args });
    return overrides[method] ? overrides[method](...args) : Promise.resolve(method === 'readActorProperties'
      ? { archive_session: args[2].archive_session, scene: args[0], actor_guid: args[1], name: 'First' } : {});
  } });
  const bindings = { computed, reactive, ref, onMounted() {}, onUnmounted: fn => { unmounted = fn; },
    createViewLifetime, pickedNodeIdentity, coronaEventBus: { on() {}, off() {}, emit() {} }, IkBoneSelect: {},
    useErrorHandler: () => ({ error: (...args) => errors.push(args) }), editorApi: { scene },
    DEFAULT_SCENE_NAME: 'scene.ini', cabbageContextService: { recordEvent: (...args) => events.push(args),
      notifySceneSaved: (...args) => saves.push(args) },
    ...ik, clearTimeout: id => timers.delete(id),
    window: { cancelAnimationFrame: id => frames.delete(id), removeEventListener() {},
      setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
      requestAnimationFrame: fn => { frames.set(++timerId, fn); return timerId; } } };
  const component = new Function(...Object.keys(bindings), compiled)(...Object.values(bindings));
  const state = component.setup({}, { expose() {} });
  function select(name = 'First', guid = 'first-guid') {
    state.selectedSceneName.value = 'scene.ini'; state.selectedActorName.value = name;
    state.archiveSession.value = 'archive'; state.actor.name = name; state.actor.actorGuid = guid;
    state.actor.modelPath = `${name}.ply`; state.aliasDraft.value = `${name}-renamed`;
  }
  select();
  t.after(() => unmounted());
  return { state, calls, errors, events, saves, timers, frames, select, dispose: () => unmounted(),
    frame: () => { for (const [id, fn] of frames) { frames.delete(id); fn(); } },
    timer: async () => { for (const [id, fn] of timers) { timers.delete(id); fn(); } await setImmediate(); } };
}

for (const retire of ['unmount', 'actor', 'archive']) {
  function change(page) {
    if (retire === 'unmount') page.dispose();
    else if (retire === 'actor') page.select('Second', 'second-guid');
    else page.state.archiveSession.value = 'replacement';
  }

  test(`Object model chooser ignores its reply after ${retire}`, async t => {
    const pending = deferred();
    const page = mount(t, { selectModelFile: () => pending.promise });
    const selecting = page.state.selectModelFile();
    change(page);
    const before = page.state.actor.modelPath;
    pending.resolve('late.ply'); await selecting;
    assert.equal(page.state.actor.modelPath, before);
  });

  test(`Object resource chooser cannot rebind after ${retire}`, async t => {
    const pending = deferred();
    const page = mount(t, { selectModelFile: () => pending.promise });
    const rebinding = page.state.rebindPlaceholderResource();
    change(page);
    pending.resolve('late.ply'); await rebinding;
    assert.deepEqual(page.calls.map(call => call.method), ['selectModelFile']);
  });

  test(`Object rename success ignores its reply after ${retire}`, async t => {
    const pending = deferred();
    const page = mount(t, { updateActor: () => pending.promise });
    const renaming = page.state.commitAlias();
    change(page);
    const before = page.state.actor.name;
    pending.resolve({ new_name: 'late-renamed' }); await renaming;
    assert.equal(page.state.actor.name, before);
    assert.equal(page.calls.filter(call => call.method === 'readActorProperties').length, 0);
  });

  test(`Object rename failure cannot replace current draft after ${retire}`, async t => {
    const pending = deferred();
    const page = mount(t, { updateActor: () => pending.promise });
    const renaming = page.state.commitAlias();
    change(page);
    const before = page.state.aliasDraft.value;
    pending.reject(new Error('late conflict')); await renaming;
    assert.equal(page.state.aliasDraft.value, before);
    assert.equal(page.state.aliasError.value, '');
    assert.equal(page.errors.length, 0);
  });

  for (const outcome of ['success', 'failure']) {
    test(`Object native rebind ${outcome} is retired after ${retire}`, async t => {
      const pending = deferred();
      const page = mount(t, { selectModelFile: async () => 'replacement.ply',
        rebindActorResource: () => pending.promise });
      const rebinding = page.state.rebindPlaceholderResource();
      await setImmediate();
      assert.equal(page.calls.at(-1).method, 'rebindActorResource');
      change(page);
      if (outcome === 'success') pending.resolve({ ok: true });
      else pending.reject(new Error('late rebind error'));
      await rebinding;
      assert.equal(page.calls.filter(call => call.method === 'readActorProperties').length, 0);
      assert.equal(page.errors.length, 0);
    });
  }

  for (const [method, args] of [['setRenderSpace', [true]], ['setBodyType', ['static']]]) {
    test(`Object ${method} rejection cannot roll back a retired selection after ${retire}`, async t => {
      const pending = deferred();
      const page = mount(t, { updateActor: () => pending.promise });
      const editing = page.state[method](...args);
      change(page);
      page.state.actor.followCamera = true;
      page.state.actor.mechanics.bodyType = 'kinematic';
      pending.reject(new Error('old patch failed')); await editing;
      assert.equal(page.state.actor.followCamera, true);
      assert.equal(page.state.actor.mechanics.bodyType, 'kinematic');
      assert.equal(page.errors.length, 0);
    });
  }

  for (const [method, args] of [['setBodyType', ['static']], ['updateMechanic', ['SetMass', 2]],
    ['updateLocks', ['SetLinearLock', [true, false, false]]]]) {
    test(`Object ${method} does not record an old operation after ${retire}`, async t => {
      const pending = deferred();
      const page = mount(t, { updateActor: () => pending.promise });
      const editing = page.state[method](...args);
      change(page); pending.resolve({}); await editing;
      assert.deepEqual(page.events, []);
    });
  }

  test(`Object pending transform event cannot describe a new selection after ${retire}`, async t => {
    const pending = deferred();
    const page = mount(t, { setActorTransform: () => pending.promise });
    await page.state.applyTransform('SetPosition', 'x');
    page.frame(); await page.timer();
    change(page); pending.resolve({}); await setImmediate();
    assert.deepEqual(page.events, []);
  });

  test(`Object pending save retains its native request but ignores retired UI after ${retire}`, async t => {
    const pending = deferred();
    const page = mount(t, { save: () => pending.promise });
    const saving = page.state.saveActor();
    await setImmediate(); change(page);
    const busy = page.state.saving.value;
    pending.resolve({ filepath: 'first.actor' }); await saving;
    assert.equal(page.state.saving.value, busy);
    assert.deepEqual(page.saves, []);
    assert.deepEqual(page.calls.find(call => call.method === 'save').args,
      ['scene.ini', { archive_session: 'archive', actors_only: true }]);
  });

  for (const [method, args] of [['updateMechanic', ['SetMass', 3]], ['updateLocks', ['SetAngularLock', [false, true, false]]],
    ['updateCameraLock', []], ['updateCameraLockOffset', []]]) {
    test(`Object ${method} late native failure is ignored after ${retire}`, async t => {
      const pending = deferred();
      const page = mount(t, { updateActor: () => pending.promise });
      const editing = page.state[method](...args);
      change(page); pending.reject(new Error('old edit failed')); await editing;
      assert.deepEqual(page.errors, []);
    });
  }
}

for (const [method, values, read] of [['setRenderSpace', [true, false, true], page => page.state.actor.followCamera],
  ['setBodyType', ['static', 'kinematic', 'static'], page => page.state.actor.mechanics.bodyType]]) {
  test(`Object ${method} older failure cannot undo a newer same-value edit`, async t => {
    const pending = deferred(); let writes = 0;
    const page = mount(t, { updateActor: () => ++writes === 1 ? pending.promise : Promise.resolve({}) });
    const first = page.state[method](values[0]);
    await page.state[method](values[1]); await page.state[method](values[2]);
    pending.reject(new Error('first edit failed')); await first;
    assert.equal(read(page), values[2]);
    assert.equal(page.errors.length, 0);
  });
}

test('Object refuses to save after its pending native transform failed', async t => {
  const page = mount(t, { setActorTransform: async () => { throw new Error('transform rejected'); } });
  page.state.scheduleTransform('SetPosition');
  await page.state.saveActor();
  assert.equal(page.calls.filter(call => call.method === 'save').length, 0);
  assert.equal(page.saves.length, 0);
  assert.equal(page.state.saving.value, false);
});

test('Object new selection releases a previous selection save busy state', async t => {
  const pending = deferred();
  const page = mount(t, { save: () => pending.promise });
  const saving = page.state.saveActor();
  await setImmediate();
  await page.state.loadActor('scene.ini', 'Second', 'archive', 'second-guid');
  assert.equal(page.state.saving.value, false);
  pending.resolve({ filepath: 'first.actor' }); await saving;
  assert.deepEqual(page.saves, []);
});

test('Object native save waits for its captured transform even after unmount', async t => {
  const pending = deferred();
  const page = mount(t, { setActorTransform: () => pending.promise });
  page.state.scheduleTransform('SetPosition');
  const saving = page.state.saveActor();
  page.dispose(); pending.resolve({}); await saving;
  assert.deepEqual(page.calls.map(call => call.method), ['setActorTransform', 'save']);
  assert.deepEqual(page.saves, []);
});

test('live Object can correct a failed transform and save the accepted value', async t => {
  let attempts = 0;
  const page = mount(t, { setActorTransform: async () => {
    if (++attempts === 1) throw new Error('transform rejected');
    return {};
  } });
  page.state.scheduleTransform('SetPosition');
  await page.state.saveActor();
  page.state.actor.transform.position.x = 3;
  page.state.scheduleTransform('SetPosition');
  await page.state.saveActor();
  assert.equal(page.calls.filter(call => call.method === 'save').length, 1);
  assert.equal(page.calls.filter(call => call.method === 'setActorTransform').at(-1).args[2].position[0], 3);
  assert.equal(page.saves.length, 1);
});

test('Object transform event waits for its write when the animation frame has not run', async t => {
  const pending = deferred();
  const page = mount(t, { setActorTransform: () => pending.promise });
  await page.state.applyTransform('SetPosition', 'x');
  await page.timer();
  assert.equal(page.calls.filter(call => call.method === 'setActorTransform').length, 1);
  assert.deepEqual(page.events, []);
  pending.resolve({}); await setImmediate();
  assert.equal(page.events.length, 1);
  assert.equal(page.frames.size, 0);
});

test('live Object transform event reports its submitted value instead of a later draft', async t => {
  const pending = deferred();
  const page = mount(t, { setActorTransform: () => pending.promise });
  page.state.actor.transform.position.x = 2;
  await page.state.applyTransform('SetPosition', 'x');
  page.frame(); await page.timer();
  page.state.actor.transform.position.x = 9;
  pending.resolve({}); await setImmediate();
  assert.equal(page.events[0][0].details.value, 2);
});

for (const method of ['setRenderSpace', 'setBodyType', 'updateCameraLock', 'updateCameraLockOffset', 'saveActor']) {
  test(`Object ${method} entry cannot initiate native work after unmount`, async t => {
    const page = mount(t); page.dispose();
    await page.state[method](method === 'setBodyType' ? 'static' : true);
    assert.deepEqual(page.calls, []);
  });
}

test('live Object resource chooser still rebinds the captured Actor', async t => {
  const page = mount(t, { selectModelFile: async () => 'replacement.ply' });
  await page.state.rebindPlaceholderResource();
  const call = page.calls.find(call => call.method === 'rebindActorResource');
  assert.deepEqual(call.args, ['scene.ini', 'first-guid', 'replacement.ply', { archive_session: 'archive' }]);
  assert.equal(page.state.placeholderRebinding.value, false);
  assert.equal(page.errors.length, 0);
});

test('live Object rename clears its busy state and preserves the stable GUID', async t => {
  const page = mount(t, { updateActor: async () => ({ actor: { name: 'Renamed' } }) });
  await page.state.commitAlias();
  assert.equal(page.state.actor.name, 'Renamed');
  assert.equal(page.state.actor.actorGuid, 'first-guid');
  assert.equal(page.state.aliasSaving.value, false);
});

test('Object selection replacement releases the old resource chooser busy state', async t => {
  const pending = deferred();
  const page = mount(t, { selectModelFile: () => pending.promise });
  const selecting = page.state.rebindPlaceholderResource();
  await page.state.loadActor('scene.ini', 'Second', 'archive', 'second-guid');
  assert.equal(page.state.placeholderRebinding.value, false);
  pending.resolve('late.ply'); await selecting;
  assert.equal(page.calls.filter(call => call.method === 'rebindActorResource').length, 0);
});

test('Object cancelled resource chooser can be opened again', async t => {
  let picks = 0;
  const page = mount(t, { selectModelFile: async () => ++picks === 1 ? '' : 'replacement.ply' });
  await page.state.rebindPlaceholderResource();
  assert.equal(page.state.placeholderRebinding.value, false);
  await page.state.rebindPlaceholderResource();
  assert.equal(page.calls.filter(call => call.method === 'rebindActorResource').length, 1);
});
