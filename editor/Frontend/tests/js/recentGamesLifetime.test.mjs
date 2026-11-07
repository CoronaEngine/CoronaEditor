import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ref } from 'vue';
import { parse, compileScript } from 'vue/compiler-sfc';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';

const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/layout/RecentGames.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'recent-games-test' }).content
  .replace(/^import .*;$/gm, '').replace('export default', 'return');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function mount(t, overrides = {}) {
  let mounted, unmounted;
  const timers = new Map(), calls = [], routes = [];
  const previous = globalThis.window;
  globalThis.window = { setInterval: callback => { timers.set(1, callback); return 1; },
    clearInterval: id => timers.delete(id) };
  t.after(() => { unmounted?.(); globalThis.window = previous; });
  const project = {
    getAppVersion: async () => '2.0',
    getRecentProjects: async () => { calls.push('history'); return [{ path: 'world', name: 'World' }]; },
    getProjectLoadStatus: async () => { calls.push('status'); return { archive_service_ready: true }; },
    ...overrides,
  };
  const component = new Function('ref', 'onMounted', 'onUnmounted', 'createViewLifetime', 'useRouter', 'editorApi',
    'projectLauncherService', 'isProjectOpenSuperseded', 'notifyWorldError', compiled)(
    ref, fn => { mounted = fn; }, fn => { unmounted = fn; }, createViewLifetime,
    () => ({ push: path => routes.push(path), replace: async path => routes.push(path) }), { project },
    { openProject: overrides.openProject || (async path => ({ ok: true, path })) }, () => false, () => {});
  const state = component.setup({}, { expose() {} });
  return { state, calls, routes, timers, ready: mounted(), dispose: () => unmounted() };
}

test('recent projects consumes direct launcher values', async t => {
  const page = mount(t); await page.ready;
  assert.equal(page.state.appVersion.value, '2.0');
  assert.deepEqual(page.state.recentProjects.value, [{ path: 'world', name: 'World' }]);
  assert.equal(page.state.archiveReady.value, true);
});

test('retired launcher does not start more reads or an interval after a late version reply', async t => {
  const pending = deferred(), page = mount(t, { getAppVersion: () => pending.promise });
  page.dispose(); pending.resolve('late'); await page.ready;
  assert.deepEqual(page.calls, []); assert.equal(page.timers.size, 0);
  assert.equal(page.state.appVersion.value, 'V1.0.0');
});

test('retired launcher ignores a late history reply and creates no status poll', async t => {
  const pending = deferred(), page = mount(t, { getRecentProjects: () => pending.promise });
  await Promise.resolve(); page.dispose(); pending.resolve([{ path: 'late' }]); await page.ready;
  assert.deepEqual(page.state.recentProjects.value, []); assert.equal(page.timers.size, 0);
  assert.deepEqual(page.calls, []);
});

test('status polling cannot apply an older reply or write after retirement', async t => {
  const older = deferred(), retired = deferred(); let reads = 0;
  const page = mount(t, { getProjectLoadStatus: () => {
    ++reads;
    return reads === 2 ? older.promise : reads === 4 ? retired.promise
      : Promise.resolve({ archive_service_ready: reads === 3 });
  } });
  await page.ready;
  const poll = page.timers.get(1)();
  await page.timers.get(1)();
  older.resolve({ archive_service_ready: false }); await poll;
  assert.equal(page.state.archiveReady.value, true);
  const late = page.timers.get(1)(); page.dispose();
  retired.resolve({ archive_service_ready: false }); await late;
  assert.equal(page.state.archiveReady.value, true); assert.equal(page.timers.size, 0);
});


test('a direct project picker selection opens the project', async t => {
  const page = mount(t, { openProjectFile: async () => ({ name: 'World', path: 'world' }) });
  await page.ready;
  await page.state.handleImport();
  assert.deepEqual(page.routes, ['/']);
});

test('a canceled project picker does not open a project', async t => {
  const page = mount(t, { openProjectFile: async () => ({}) });
  await page.ready;
  await page.state.handleImport();
  assert.deepEqual(page.routes, []);
});

test('a project picker completing after retirement does not open a project', async t => {
  const pending = deferred(), page = mount(t, { openProjectFile: () => pending.promise });
  await page.ready;
  const importing = page.state.handleImport();
  page.dispose();
  pending.resolve({ name: 'World', path: 'world' });
  await importing;
  assert.deepEqual(page.routes, []);
});

test('direct open diagnostics reach confirmation before a degraded retry', async t => {
  const calls = [], confirmations = [];
  const page = mount(t, { openProject: async (path, options) => {
    calls.push({ path, options });
    return calls.length === 1 ? { ok: false, status: 'decision_required', diagnostics: [
      { actor_name: 'Chair', resource_path: 'Assets/chair.ply', count: 2, message: 'Missing geometry' },
    ] } : { ok: true, status: 'opened_degraded', path };
  } });
  window.confirm = message => { confirmations.push(message); return true; };
  await page.ready;
  await page.state.handleOpenProject('world');
  assert.deepEqual(calls, [{ path: 'world', options: undefined },
    { path: 'world', options: { loadPolicy: 'degraded' } }]);
  assert.equal(confirmations.length, 1);
  for (const detail of ['Chair', 'Assets/chair.ply', '2', 'Missing geometry'])
    assert.ok(confirmations[0].includes(detail), detail);
  assert.deepEqual(page.routes, ['/']);
});

test('declining direct open diagnostics leaves the project unopened', async t => {
  let opens = 0;
  const page = mount(t, { openProject: async () => {
    ++opens;
    return { ok: false, status: 'decision_required', diagnostics: [{ code: 'RESOURCE_NOT_FOUND' }] };
  } });
  window.confirm = () => false;
  await page.ready;
  await page.state.handleOpenProject('world');
  assert.equal(opens, 1);
  assert.deepEqual(page.routes, []);
});
