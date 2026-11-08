import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { ref } from 'vue';
import { compileScript, parse } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';
import { deferred } from './windowSessionFixtures.mjs';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/layout/NewGame.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'new-game-lifetime' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');

function mount(t, overrides = {}) {
  const timers = new Map(), intervals = new Map(), calls = [], routes = [], alerts = [];
  const world = { status: 'ready', revision: 1 };
  let mounted, unmounted, sequence = 0;
  const invoke = (name, value) => async () => { calls.push(name); return value; };
  const surface = {
    setInterval: callback => { intervals.set(++sequence, callback); return sequence; },
    clearInterval: id => intervals.delete(id),
    setTimeout: callback => { timers.set(++sequence, callback); return sequence; },
    clearTimeout: id => timers.delete(id),
  };
  const component = new Function('ref', 'onMounted', 'onUnmounted', 'createViewLifetime', 'useRouter',
    'editorApi', 'worldModeState', 'projectLauncherService', 'isProjectOpenSuperseded', 'cancelPendingProjectOpen',
    'notifyWorldError', 'initializeWorldTasks', 'translateUiText', 'window', 'alert', compiled)(
    ref, fn => { mounted = fn; }, fn => { unmounted = fn; }, createViewLifetime,
    () => ({ push: path => routes.push(path), replace: path => routes.push(path) }),
    { project: { getProjectLoadStatus: invoke('status', { archive_service_ready: true }),
      createWorldProject: invoke('create', { path: 'fixture' }), ...overrides.project },
    projectSettings: { getActiveProjectInfo: invoke('activation', { project_path: 'fixture' }), ...overrides.settings } },
    world, { openProject: overrides.open || invoke('open', { ok: true }) }, result => result?.status === 'superseded',
    () => {}, error => alerts.push(error), overrides.tasks || invoke('tasks', {}),
    text => text, surface, message => alerts.push(message));
  const state = component.setup({}, { expose() {} });
  const dispose = () => unmounted();
  t.after(dispose);
  return { state, calls, routes, alerts, timers, intervals, world, dispose,
    start: () => mounted(),
    async ready() { await state.refreshArchiveReady(); },
    finishDelay() { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); } };
}

for (const outcome of ['success', 'failure']) {
  test(`NewGame ignores retired archive readiness ${outcome}`, async t => {
    const pending = deferred();
    let reads = 0;
    const page = mount(t, { project: { getProjectLoadStatus: () => { reads++; return pending.promise; } } });
    const reading = page.state.refreshArchiveReady();
    page.dispose(); page.state.archiveReady.value = true;
    if (outcome === 'success') pending.resolve({ archive_service_ready: false });
    else pending.reject(new Error('late status'));
    await reading;
    assert.equal(page.state.archiveReady.value, true);
    await page.state.refreshArchiveReady();
    assert.equal(reads, 1, 'retired status polling must not restart');
  });
}

test('NewGame cancels and completes its activation delay on retirement', async t => {
  const page = mount(t, { settings: { getActiveProjectInfo: async () => ({ project_path: 'old' }) } });
  await page.ready();
  const creating = page.state.handleCreate(); await setImmediate();
  assert.equal(page.timers.size, 1);
  page.dispose(); await setImmediate();
  assert.equal(page.timers.size, 0, 'retirement must cancel the one-shot activation delay');
  await creating;
  assert.deepEqual(page.routes, []);
  assert.equal(page.state.creating.value, true, 'completion cannot write retired busy state');
});

test('NewGame activation reply after retirement cannot schedule another read or delay', async t => {
  const pending = deferred();
  const page = mount(t, { settings: { getActiveProjectInfo: () => pending.promise } });
  await page.ready();
  const creating = page.state.handleCreate(); await setImmediate();
  page.dispose(); pending.resolve({ project_path: 'old' }); await setImmediate();
  assert.equal(page.timers.size, 0);
  await creating;
  assert.deepEqual(page.calls, ['status', 'create', 'open']);
  assert.deepEqual(page.routes, []);
});

for (const stage of ['create', 'open', 'tasks']) {
  for (const outcome of ['success', 'failure']) {
    test(`NewGame ${stage} ${outcome} after retirement cannot update busy state or navigate`, async t => {
      const pending = deferred();
      const page = mount(t, stage === 'create' ? { project: { createWorldProject: () => pending.promise } }
        : stage === 'open' ? { open: () => pending.promise }
          : { tasks: () => pending.promise });
      await page.ready();
      const creating = page.state.handleCreate(); await setImmediate();
      page.dispose();
      if (outcome === 'success') pending.resolve({ path: 'fixture', ok: true });
      else pending.reject(new Error('late result'));
      await creating;
      assert.equal(page.state.creating.value, true);
      assert.deepEqual(page.routes, []);
      assert.deepEqual(page.alerts, []);
      assert.equal(page.timers.size, 0);
    });
  }
}

test('NewGame current creation keeps task setup and retires its status interval', async t => {
  const page = mount(t); page.start(); await page.ready();
  await page.state.handleCreate();
  assert.deepEqual(page.calls.slice(-4), ['create', 'open', 'activation', 'tasks']);
  assert.deepEqual(page.routes, ['/']);
  assert.equal(page.state.creating.value, false);
  assert.equal(page.intervals.size, 1);
  page.dispose(); assert.equal(page.intervals.size, 0);
});

test('NewGame activation polling stops when the selected project revision changes', async t => {
  const pending = deferred();
  const page = mount(t, { settings: { getActiveProjectInfo: () => pending.promise } });
  await page.ready();
  const creating = page.state.handleCreate(); await setImmediate();
  page.world.revision++;
  pending.resolve({ project_path: 'old' }); await setImmediate();
  assert.equal(page.timers.size, 0);
  await creating;
  assert.deepEqual(page.routes, []);
  assert.ok(!page.calls.includes('tasks'));
});

test('NewGame live activation polling retries and then initializes the selected world', async t => {
  let reads = 0;
  const page = mount(t, { settings: { getActiveProjectInfo: async () => ({ project_path: ++reads === 1 ? 'old' : 'fixture' }) } });
  await page.ready();
  const creating = page.state.handleCreate(); await setImmediate();
  assert.equal(page.timers.size, 1);
  page.finishDelay(); await creating;
  assert.equal(reads, 2);
  assert.equal(page.timers.size, 0);
  assert.deepEqual(page.routes, ['/']);
});
