import { sceneQueryFixture } from './sceneQueryFixtures.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { reactive, ref } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';
import { pickedNodeIdentity } from '../../src/utils/modelHierarchy.js';
import { emptySceneTreeSettlement, resolveSceneTreeSnapshot } from '../../src/utils/sceneTreeSnapshot.js';
import { deferred } from './windowSessionFixtures.mjs';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/sidebar/SceneBar.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'scene-bar-mutation-lifetime' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');

function mount(t, overrides = {}) {
  const calls = [], errors = [], warnings = [], saved = [], timers = new Map();
  let unmounted, timerId = 0;
  const api = namespace => new Proxy({}, { get: (_, method) => (...args) => {
    calls.push({ method, args });
    if (overrides[method]) return overrides[method](...args);
    if (method === 'readScene') return Promise.resolve({ archive_session: args[0].archive_session,
      scene: args[0].scene, actors: [{ name: 'Probe', actor_guid: 'actor', type: 'model' }], cameras: [] });
    if (method === 'createCamera') return Promise.resolve({ camera: { name: 'New', camera_id: 'new-camera' } });
    if (method === 'isVisionAvailable') return Promise.resolve({ available: true });
    return Promise.resolve(namespace === 'window' ? {} : { ok: true });
  } });
  const bindings = { ref, reactive, onMounted() {}, onUnmounted: fn => { unmounted = fn; }, createViewLifetime,
    useRoute: () => ({}), ModelNodeHierarchy: {}, pickedNodeIdentity, editorApi: { app: api('app'), input: api('input'), scene: api('scene'), audio: api('audio'), viewport: api('viewport') },
    appService: api('window'), DEFAULT_SCENE_NAME: 'scene.ini', resolveOpenedProjectScene: value => value.scene,
    emptySceneTreeSettlement, resolveSceneTreeSnapshot,
    useErrorHandler: () => ({ error: (...args) => errors.push(args), warn: (...args) => warnings.push(args) }),
    coronaEventBus: { on() {}, off() {}, emit() {} }, cabbageContextService: { notifySceneSaved: value => saved.push(value) },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    window: { confirm: () => true, alert: value => errors.push(value), clearTimeout: id => timers.delete(id),
      setTimeout: fn => { timers.set(++timerId, fn); return timerId; } } };
  const component = new Function(...Object.keys(bindings), compiled)(...Object.values(bindings));
  const state = component.setup({}, { expose() {} });
  state.currentSceneName.value = 'scene.ini'; state.archiveSession.value = 'archive';
  const camera = { name: 'Camera', camera_id: 'camera', archive_session: 'archive', deletable: true };
  state.sceneCameras.value = [camera, { ...camera, name: 'Main', camera_id: 'main' }];
  state.selectedCameraName.value = camera.name;
  const actor = reactive({ name: 'Probe', actor_guid: 'actor', type: 'model', visible: true });
  state.sceneImages.value = [actor];
  t.after(() => unmounted());
  return { state, actor, camera, calls, errors, warnings, saved, timers, dispose: () => unmounted(),
    tick: async () => { for (const [id, fn] of timers) { timers.delete(id); fn(); } await setImmediate(); } };
}

for (const retirement of ['unmount', 'archive', 'scene']) {
  function retire(page) {
    if (retirement === 'unmount') page.dispose();
    else if (retirement === 'archive') page.state.archiveSession.value = 'replacement';
    else page.state.currentSceneName.value = 'replacement.ini';
  }

  test(`SceneBar camera close reply cannot initiate deletion after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { closeCameraView: () => pending.promise });
    const deleting = page.state.DeleteCamera(page.camera);
    retire(page); pending.resolve({}); await setImmediate(); await page.tick(); await deleting;
    assert.deepEqual(page.calls.map(call => call.method), ['closeCameraView']);
  });

  test(`SceneBar camera retirement wait cannot initiate deletion after ${retirement}`, async t => {
    const page = mount(t);
    const deleting = page.state.DeleteCamera(page.camera);
    await setImmediate(); assert.equal(page.timers.size, 1);
    retire(page); await page.tick(); await deleting;
    assert.deepEqual(page.calls.map(call => call.method), ['closeCameraView']);
  });

  test(`SceneBar created camera cannot open a new window after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { createCamera: () => pending.promise });
    const creating = page.state.ImportCamera();
    retire(page); pending.resolve({ camera: { name: 'New', camera_id: 'new-camera' } }); await creating;
    assert.deepEqual(page.calls.map(call => call.method), ['createCamera']);
  });

  test(`SceneBar resource chooser cannot bind to a changed scope after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { selectModelFile: () => pending.promise });
    const selecting = page.state.RebindActorResource(page.actor);
    retire(page); pending.resolve('replacement.ply'); await selecting;
    assert.deepEqual(page.calls.map(call => call.method), ['selectModelFile']);
  });

  test(`SceneBar render backend reply cannot overwrite retired state after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { setCameraRenderSettings: () => pending.promise });
    const switching = page.state.ToggleRenderBackend();
    retire(page); pending.resolve({ render_backend: 'vision' }); await switching;
    assert.equal(page.state.activeRenderBackend.value, 'native');
  });

  test(`SceneBar save reply does not notify a changed scope after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { save: () => pending.promise });
    const saving = page.state.SaveScene();
    retire(page); pending.resolve({ status: 'saved', filepath: 'scene.ini' }); await saving;
    assert.deepEqual(page.saved, []);
  });

  test(`SceneBar stale visibility failure cannot roll back a retired row after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { updateActor: () => pending.promise });
    const editing = page.state.ToggleVisible(page.actor);
    retire(page); pending.reject(new Error('old visibility edit')); await editing;
    assert.equal(page.actor.visible, false);
    assert.deepEqual(page.errors, []);
  });

  test(`SceneBar stale delete reply cannot clear the new selection after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { deleteActor: () => pending.promise });
    page.state.selectedItem.value = 'Probe';
    const deleting = page.state.DeleteActor(page.actor);
    retire(page); pending.resolve({ actor_guid: 'actor' }); await deleting;
    assert.equal(page.state.selectedItem.value, 'Probe');
    assert.equal(page.calls.filter(call => call.method === 'readScene').length, 0);
  });

  for (const [method, pendingMethod, argumentsFor] of [
    ['OpenCameraView', 'createCameraView', page => [page.camera]],
    ['ImportCamera', 'createCamera', () => []],
    ['RebindActorResource', 'selectModelFile', page => [page.actor]],
    ['TakeScreenshot', 'captureScreenshot', () => []],
    ['focusActorFromList', 'focusActor', page => [page.actor]],
    ['RefreshRenderBackendState', 'readScene', () => []],
  ]) {
    test(`SceneBar ${method} late failure is ignored after ${retirement}`, async t => {
      const pending = deferred(), page = mount(t, { [pendingMethod]: () => pending.promise });
      const action = page.state[method](...argumentsFor(page));
      retire(page); pending.reject(new Error('old operation failed')); await action;
      assert.deepEqual(page.errors, []);
    });
  }

  test(`SceneBar camera window reply cannot select or refresh after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { createCameraView: () => pending.promise });
    const creating = page.state.ImportCamera();
    await setImmediate(); retire(page); pending.resolve({}); await creating;
    assert.equal(page.state.selectedCameraName.value, 'Camera');
    assert.equal(page.calls.filter(call => call.method === 'readScene').length, 0);
  });

  test(`SceneBar rebind reply cannot alert or refresh after ${retirement}`, async t => {
    const pending = deferred(), page = mount(t, { selectModelFile: async () => 'replacement.ply',
      rebindActorResource: () => pending.promise });
    const rebinding = page.state.RebindActorResource(page.actor);
    await setImmediate(); retire(page); pending.resolve({ ok: false }); await rebinding;
    assert.deepEqual(page.errors, []);
    assert.equal(page.calls.filter(call => call.method === 'readScene').length, 0);
  });
}

test('SceneBar cannot apply a backend reply to a different selected camera', async t => {
  const pending = deferred(), page = mount(t, { setCameraRenderSettings: () => pending.promise });
  const switching = page.state.ToggleRenderBackend();
  page.state.selectedCameraName.value = 'Main';
  pending.resolve({ render_backend: 'vision' }); await switching;
  assert.equal(page.state.activeRenderBackend.value, 'native');
});

test('SceneBar newer backend change wins over an older read', async t => {
  const pending = deferred(), page = mount(t, { ...sceneQueryFixture({ cameras: () => pending.promise }),
    setCameraRenderSettings: async () => ({ render_backend: 'vision' }) });
  const reading = page.state.RefreshRenderBackendState();
  await page.state.ToggleRenderBackend();
  pending.resolve({ archive_session: 'archive', scene: 'scene.ini', cameras: [{ camera_id: 'camera', render_backend: 'native' }] });
  await reading;
  assert.equal(page.state.activeRenderBackend.value, 'vision');
});

test('SceneBar old visibility failure cannot undo a newer same-value edit', async t => {
  const pending = deferred(); let calls = 0;
  const page = mount(t, { updateActor: () => ++calls === 1 ? pending.promise : Promise.resolve({}) });
  const first = page.state.ToggleVisible(page.actor);
  await page.state.ToggleVisible(page.actor); await page.state.ToggleVisible(page.actor);
  pending.reject(new Error('first visibility edit failed')); await first;
  assert.equal(page.actor.visible, false);
  assert.deepEqual(page.errors, []);
});

test('SceneBar cannot delete a camera row from a previous archive', async t => {
  const page = mount(t);
  const deleting = page.state.DeleteCamera({ ...page.camera, archive_session: 'old' });
  await setImmediate(); await page.tick(); await deleting;
  assert.deepEqual(page.calls, []);
});

test('SceneBar live camera deletion keeps close, retirement wait, delete and refresh order', async t => {
  const page = mount(t);
  const deleting = page.state.DeleteCamera(page.camera);
  await setImmediate(); await page.tick(); await deleting;
  assert.deepEqual(page.calls.map(call => call.method), ['closeCameraView', 'deleteCamera', 'readScene']);
  assert.deepEqual(page.calls[1].args, ['scene.ini', 'camera', { archive_session: 'archive' }]);
});

test('SceneBar live camera creation still opens exactly one surface', async t => {
  const page = mount(t);
  await page.state.ImportCamera();
  assert.deepEqual(page.calls.map(call => call.method), ['createCamera', 'createCameraView', 'readScene']);
});


test('SceneBar live save notifies only after native success with the captured scope', async t => {
  const pending = deferred(), page = mount(t, { save: () => pending.promise });
  const saving = page.state.SaveScene();
  assert.deepEqual(page.saved, []);
  assert.deepEqual(page.calls[0].args, ['scene.ini', { archive_session: 'archive' }]);
  pending.resolve({ status: 'saved', filepath: 'saved.ini' }); await saving;
  assert.deepEqual(page.saved, ['saved.ini']);
});

test('SceneBar canceled resource chooser leaves the actor untouched', async t => {
  const page = mount(t, { selectModelFile: async () => '' });
  await page.state.RebindActorResource(page.actor);
  assert.deepEqual(page.calls.map(call => call.method), ['selectModelFile']);
  assert.deepEqual(page.errors, []);
});

test('SceneBar live rebind preserves actor GUID and archive through refresh', async t => {
  const page = mount(t, { selectModelFile: async () => 'replacement.ply' });
  await page.state.RebindActorResource(page.actor);
  assert.deepEqual(page.calls.map(call => call.method), ['selectModelFile', 'rebindActorResource', 'readScene']);
  assert.deepEqual(page.calls[1].args, ['scene.ini', 'actor', 'replacement.ply', { archive_session: 'archive' }]);
  assert.deepEqual(page.errors, []);
});

test('SceneBar current visibility failure rolls back and reports the failed edit', async t => {
  const page = mount(t, { updateActor: async () => { throw Error('native rejected'); } });
  await page.state.ToggleVisible(page.actor);
  assert.equal(page.actor.visible, true);
  assert.deepEqual(page.calls[0].args, ['scene.ini', 'actor', { archive_session: 'archive', visible: false }]);
  assert.equal(page.errors.length, 1);
});

test('SceneBar current render backend failure preserves the previous value and reports it', async t => {
  const page = mount(t, { setCameraRenderSettings: async () => { throw Error('native rejected'); } });
  await page.state.ToggleRenderBackend();
  assert.equal(page.state.activeRenderBackend.value, 'native');
  assert.equal(page.errors.length, 1);
});

test('SceneBar current actor deletion clears its selection and refreshes', async t => {
  const page = mount(t, { deleteActor: async () => ({ actor_guid: 'actor' }) });
  page.state.selectedItem.value = 'Probe';
  await page.state.DeleteActor(page.actor);
  assert.equal(page.state.selectedItem.value, null);
  assert.deepEqual(page.calls.map(call => call.method), ['deleteActor', 'readScene']);
  assert.deepEqual(page.errors, []);
});
