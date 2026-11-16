// Project replacement retires the native network session as well as Web surfaces.
import { getWebMessages } from '../../src/api/webMessages.js';
import { memoryStorage } from './windowSessionFixtures.mjs';
import { setImmediate } from 'node:timers';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorldModeController, createWorldModeRouteGuard, normalizeWorldMode, normalizeProjectPath, requireProjectInfo, worldModeService } from '../../src/services/worldModeService.js';
import { editorApi } from '../../src/api/editorApi.js';

test.beforeEach(t => t.mock.method(editorApi.network, 'stop_session', async () => ({ ok: true })));
import { appService } from '../../src/services/appService.js';
import { projectLauncherService, resolveOpenedProjectScene, stopWorldRuntimeBeforeOpen } from '../../src/services/projectLauncherService.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const info = (path, mode) => ({ project_path: path, mode });

test('opens the single materialized scene', () => {
  assert.equal(resolveOpenedProjectScene({ scene: { path: 'scene.ini' } }), 'scene.ini');
  assert.equal(resolveOpenedProjectScene({ scene: { path: ' scene.ini ' } }), 'scene.ini');
});

test('does not restore old scene lists or active indexes', () => {
  assert.equal(resolveOpenedProjectScene({ scenes: [{ path: 'old.scene' }], active_index: 8 }), '');
  assert.equal(resolveOpenedProjectScene({}), '');
});

test('legacy story metadata uses the single editable world mode', () => {
  assert.equal(normalizeWorldMode('story'), 'creative');
  for (const mode of [undefined, null, '', 'creative', '3d', 'multiplayer', 'Story']) assert.equal(normalizeWorldMode(mode), 'creative');
  assert.equal(normalizeProjectPath('D:\\Worlds\\Demo\\'), 'd:/worlds/demo');
  assert.equal(requireProjectInfo(info('demo', 'story')).mode, 'story');
  for (const invalid of [{}, { data: {} }, { data: info('demo', 'creative') }, { project_path: '  ' }]) assert.throws(() => requireProjectInfo(invalid));
});

test('mode resolution is fail closed and does not mount an editor while pending', async () => {
  const request = deferred(), states = [];
  const controller = createWorldModeController({ readProjectInfo: () => request.promise, publish: (state) => states.push(state) });
  const result = controller.resolve('D:/story');
  assert.equal(controller.state.status, 'loading');
  assert.equal(controller.state.mode, null);
  request.reject(new Error('offline'));
  await assert.rejects(result, /offline/);
  assert.equal(controller.state.status, 'error');
  assert.ok(states.every((state) => state.mode === null));
});

test('active project scope remains on the committed world while a new selection is pending or fails', async () => {
  let activePath = 'old-world';
  const controller = createWorldModeController({ readProjectInfo: async () => info(activePath, 'creative') });
  await controller.resolve('old-world');
  const token = controller.beginOpen('new-world');
  assert.equal(controller.state.projectPath, 'new-world');
  assert.equal(controller.state.activeProjectPath, 'old-world');
  controller.fail(new Error('open failed'));
  controller.finishOpen(token);
  assert.equal(controller.state.activeProjectPath, 'old-world');

  activePath = 'new-world';
  await controller.resolve('new-world', { force: true });
  assert.equal(controller.state.activeProjectPath, 'new-world');
});

test('deduplicates reads and rejects mismatched authoritative project paths', async () => {
  let calls = 0;
  const request = deferred();
  const controller = createWorldModeController({ readProjectInfo: () => { calls++; return request.promise; } });
  const first = controller.resolve('D:/story'), second = controller.resolve('d:\\story\\');
  request.resolve(info('D:/story', 'story'));
  assert.equal((await first).mode, 'creative');
  assert.equal((await second).mode, 'creative');
  assert.equal(calls, 1);
  await assert.rejects(controller.resolve('D:/different'), /改变/);
  assert.equal(controller.state.mode, null);
});

test('stale success and failure cannot overwrite the most recent world', async () => {
  for (const fail of [false, true]) {
    const requests = [deferred(), deferred()]; let n = 0;
    const controller = createWorldModeController({ readProjectInfo: () => requests[n++].promise });
    const old = controller.resolve('old');
    const current = controller.resolve('current');
    requests[1].resolve(info('current', 'story'));
    await current;
    if (fail) requests[0].reject(new Error('old failure')); else requests[0].resolve(info('old', 'creative'));
    assert.equal(await old, null);
    assert.equal(controller.state.mode, 'creative');
    assert.equal(controller.state.projectPath, 'current');
  }
});

test('a scoped observer validates the project of a shared unscoped metadata read', async () => {
  const request = deferred();
  let reads = 0;
  const controller = createWorldModeController({ readProjectInfo: () => { reads++; return request.promise; } });
  const routeRead = controller.resolve();
  const observedRead = controller.resolve('expected');
  const results = Promise.allSettled([routeRead, observedRead]);
  request.resolve(info('different', 'creative'));
  assert.ok((await results).every(result => result.status === 'rejected' && /改变/.test(result.reason.message)));
  assert.equal(controller.state.status, 'error');
  assert.equal(reads, 1);
});

test('forced archive reopen supersedes even a pending read of the same project', async () => {
  const requests = [deferred(), deferred()];
  let reads = 0;
  const controller = createWorldModeController({ readProjectInfo: () => requests[reads++].promise });
  const old = controller.resolve('world');
  const reopened = controller.resolve('world', { force: true });
  assert.equal(reads, 2);
  requests[1].resolve(info('world', 'story'));
  assert.equal((await reopened).mode, 'creative');
  requests[0].resolve(info('world', 'creative'));
  assert.equal(await old, null);
  assert.equal(controller.state.mode, 'creative');
});

test('open ownership token survives mode resolution but not a newer open', async () => {
  const controller = createWorldModeController({ readProjectInfo: async () => info('world', 'story') });
  const old = controller.beginOpen('old');
  const token = controller.beginOpen('world');
  await controller.resolve('world', { force: true });
  assert.equal(controller.finishOpen(old), false);
  assert.equal(controller.opening, true);
  assert.equal(controller.finishOpen(token), true);
  assert.equal(controller.opening, false);
});

test('legacy story projects permit every editor route including standalone panels', async () => {
  let mode = 'story', closed = 0, reads = 0;
  const controller = createWorldModeController({ readProjectInfo: async () => { reads++; return info('world', mode); } });
  const guard = createWorldModeRouteGuard({ controller, closePanel: async () => { closed++; }, notify: assert.fail });
  assert.equal(await guard({ path: '/NewGame' }), true);
  assert.equal(reads, 0);
  assert.equal(await guard({ path: '/' }), true);
  for (const path of ['/SetUp', '/NodeGraph', '/CameraView', '/CabbageChat']) {
    assert.equal(await guard({ path }), true);
    assert.equal(await guard({ path, query: { standalone: '1' } }), true);
  }
  assert.equal(closed, 0);
  mode = 'creative'; controller.invalidate();
  assert.equal(await guard({ path: '/NodeGraph', query: { standalone: '1' } }), true);
  const token = controller.beginOpen('next');
  assert.equal(await guard({ path: '/' }), false);
  controller.finishOpen(token);
});

test('failed mode reads return to launcher and never fall back to creative', async () => {
  const errors = [];
  const controller = createWorldModeController({ readProjectInfo: async () => { throw new Error('metadata unavailable'); } });
  const guard = createWorldModeRouteGuard({ controller, closePanel: async () => {}, notify: (e) => errors.push(e) });
  assert.equal(await guard({ path: '/' }), '/StartScreen');
  assert.deepEqual(errors, ['metadata unavailable']);
  assert.equal(controller.state.mode, null);
});

test('project opening is serialized and commits only verified authoritative worlds', async (t) => {
  const first = deferred(), paths = [], saved = [];
  let activePath = 'first';
  t.mock.method(editorApi.project, 'open_project', async (path) => {
    paths.push(path); if (path === 'first') await first.promise;
    activePath = path; return { ok: true, path };
  });
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => info(activePath, 'story'));
  const previousWindow = globalThis.window, previousEvent = globalThis.CustomEvent;
  globalThis.window = { localStorage: { setItem: (...args) => saved.push(args) }, dispatchEvent() {} };
  globalThis.CustomEvent = class { constructor(type, options) { Object.assign(this, { type }, options); } };
  t.after(() => { globalThis.window = previousWindow; globalThis.CustomEvent = previousEvent; });
  worldModeService.invalidate();
  const a = projectLauncherService.open_project('first');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(paths, ['first']);
  const skipped = projectLauncherService.open_project('middle');
  const b = projectLauncherService.open_project('second');
  first.resolve();
  assert.equal((await a).status, 'superseded');
  assert.equal((await skipped).status, 'superseded');
  await b;
  assert.deepEqual(paths, ['first', 'second']);
  assert.equal(worldModeService.state.projectPath, 'second');
  assert.equal(worldModeService.opening, false);
  assert.deepEqual(saved, []);
});


function runningApi(stop) {
  return { scripts: {getStatus: async () => ({runId: 'current', snapshotCaptured: true}), stop} };
}

