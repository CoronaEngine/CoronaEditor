// Project replacement retires the native network session as well as Web surfaces.
import { memoryStorage } from './windowSessionFixtures.mjs';
import { getWebMessages, createWebMessages } from '../../src/api/webMessages.js';
import { createWindowSessionState } from '../../src/services/windowSessionState.js';
import { getNodeGraphSaves, createNodeGraphSaves, flushActiveNodeGraphs } from '../../src/services/nodeGraphSaves.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { watch, nextTick } from 'vue';
import { editorApi } from '../../src/api/editorApi.js';

test.beforeEach(t => t.mock.method(editorApi.network, 'stopSession', async () => ({ ok: true })));
import { appService } from '../../src/services/appService.js';
import { projectLauncherService } from '../../src/services/projectLauncherService.js';
import { worldModeService, worldModeState } from '../../src/services/worldModeService.js';

function nativeSurface(t) {
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: '' }));
  t.mock.method(editorApi.scripts, 'getStatus', async () => ({ status: 'idle' }));
  const sent = [], barriers = [];
  const surface = {
    // The plural close is the retirement fence, so it is the one that waits for a reply.
    // Closing a single panel resolves immediately and is only recorded.
    corona: { window: { close: identity => (identity && 'sceneId' in identity)
      ? new Promise((resolve, reject) => barriers.push({ sceneId: identity.sceneId, resolve, reject }))
      : (sent.push(['close', identity]), Promise.resolve(true)),
      onCloseRequested: () => () => {} } },
    localStorage: memoryStorage(), sessionStorage: memoryStorage(), location: { hash: '#/' }, dispatchEvent() {} };
  surface.corona.window.setWindowPresentation = async (...args) => { sent.push(['setWindowPresentation', ...args]); return true; };
  const previous = globalThis.window;
  globalThis.window = surface;
  t.after(() => { getWebMessages(surface).dispose(); globalThis.window = previous; });
  return { sent, surface, barriers,
    barrierReply: (index, error) => error ? barriers[index].reject(new Error(error)) : barriers[index].resolve({ closed: 0 }) };
}

async function waitForBarrier(barriers, index) {
  for (let i = 0; i < 200 && barriers.length <= index; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.ok(barriers[index], `native barrier ${index} must be reached`);
}
test('real Vue watcher and launcher concurrent cleanup opens native project once', async (t) => {
  const { barriers: sent, barrierReply: reply } = nativeSurface(t);
  let nativeOpens = 0;
  t.mock.method(editorApi.project, 'openProject', async path => { nativeOpens++; return { ok: true, path }; });
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => ({ project_path: 'story', mode: 'story' }));
  worldModeService.invalidate();
  const watched = [];
  const stop = watch(() => worldModeState.revision, () => {
    if (worldModeState.status === 'loading') watched.push(appService.setEditorUiEnabled(false));
  });
  t.after(stop);
  const opened = projectLauncherService.openProject('story');
  await nextTick(); await waitForBarrier(sent, 0);
  assert.equal(sent.length, 1); // watcher and launcher share the same retirement
  reply(0); await waitForBarrier(sent, 1);
  assert.equal(sent.length, 2);
  reply(1); await setImmediate();
  let settled = false;
  opened.finally(() => { settled = true; });
  let replied = 2;
  for (let round = 0; round < 40; round++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    while (replied < sent.length) reply(replied++);
  }
  assert.equal(settled, true);
  await opened; await Promise.all(watched);
  assert.equal(nativeOpens, 1);
  assert.equal(worldModeState.mode, 'creative');
  assert.equal(worldModeService.opening, false);
});
test('failed retirement blocks opening but leaves queue available for retry', async (t) => {
  const { barriers: sent, barrierReply: reply } = nativeSurface(t);
  let opens = 0;
  t.mock.method(editorApi.project, 'openProject', async path => { opens++; return { ok: true, path }; });
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => ({ project_path: 'story', mode: 'story' }));
  worldModeService.invalidate();
  const failed = projectLauncherService.openProject('story');
  const rejected = assert.rejects(failed, /retirement failed/);
  await waitForBarrier(sent, 0); reply(0, 'retirement failed'); await rejected;
  assert.equal(opens, 0); assert.equal(worldModeService.opening, false);
  const retry = projectLauncherService.openProject('story');
  await waitForBarrier(sent, 1); reply(1);
  await waitForBarrier(sent, 2); reply(2); await retry;
  assert.equal(opens, 1); assert.equal(worldModeService.opening, false);
});

test('retired camera surfaces cannot queue controls against the next creative world', async (t) => {
  const { sent, surface } = nativeSurface(t);
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => ({ project_path: 'creative', mode: 'creative' }));
  await worldModeService.resolve('creative', { force: true });
  surface.location = { hash: '#/CameraView?standalone=1&uiSession=old&uiOwner=main&uiWindow=camera' };
  const mainMessages = createWebMessages({ scope: 'main', role: 'main', documentId: 'main' });
  const mainState = createWindowSessionState(mainMessages, { owner: 'main', main: true });
  mainState.write({
    enabled: true, owner: 'main', generation: 'new', revision: worldModeState.revision,
    records: [{ owner: 'main', id: 'camera', generation: 'new', status: 'ready', kind: 'camera' }],
  });
  t.after(() => { mainState.dispose(); mainMessages.dispose(); });
  for (const method of ['cycleThisCameraViewWindowMode', 'setThisCameraViewPresentation',
    'resizeThisCameraView', 'closeCameraView']) {
    await assert.rejects(appService[method](), /不允许|CONTEXT_CHANGED/);
  }
  assert.equal(sent.length, 0);
});


test('launcher and watcher save the old archive in every Web document before native retirement or scene replacement', async t => {
  const { surface, barriers, barrierReply } = nativeSurface(t);
  let archive = 'old-archive', release;
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: archive }));
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => ({ project_path: 'old', mode: 'creative' }));
  await worldModeService.resolve('old', { force: true });
  let next = 0;
  const enable = appService.setEditorUiEnabled(true);
  let enabled = false; enable.then(() => { enabled = true; });
  for (let i=0;i<100 && !enabled;i++) { await new Promise(resolve => setTimeout(resolve,5)); while(next<barriers.length) barrierReply(next++); }
  assert.equal(enabled, true); await enable;
  const messages = getWebMessages(surface);
  let generation = (await appService.readEditorUiPolicy()).generation;
  const peer = createWebMessages({ scope: messages.scope || surface.sessionStorage.getItem('corona.editorUi.owner'), documentId: 'node-dock', getGeneration: () => generation });
  const state = createWindowSessionState(peer, {
    owner: surface.sessionStorage.getItem('corona.editorUi.owner'), main: false,
  });
  await state.hydrate();
  generation = state.read().generation;
  const saves = createNodeGraphSaves({ messages: peer });
  let calls = 0, opens = 0;
  saves.register({ getSession: () => 'old-archive', flush: session => {
    assert.equal(session, 'old-archive'); calls++;
    return new Promise(resolve => { release = resolve; });
  } });
  t.after(() => { state.dispose(); peer.dispose(); messages.dispose(); });
  t.mock.method(editorApi.scripts, 'getStatus', async () => ({ status: 'idle' }));
  t.mock.method(editorApi.project, 'openProject', async () => {
    assert.equal(calls, 1); opens++; archive = 'new-archive'; return { ok: true, path: 'new' };
  });
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => ({ project_path: opens ? 'new' : 'old', mode: 'creative' }));
  const watched=[];
  const stop=watch(() => worldModeState.revision, () => {
    if (worldModeState.status === 'loading') watched.push(appService.setEditorUiEnabled(false));
  });
  t.after(stop);
  const barrierCount = barriers.length;
  const opening = projectLauncherService.openProject('new');
  for(let i=0;i<60 && !release;i++) await new Promise(resolve => setTimeout(resolve,5));
  assert.equal(calls, 1, 'the independent Dock must participate through Web messages');
  assert.equal(barriers.length, barrierCount, 'native retirement cannot start before the old archive save finishes');
  assert.equal(opens, 0);
  release(true);
  for(let i=0;i<80;i++) { await new Promise(resolve => setTimeout(resolve,5)); while(next<barriers.length) barrierReply(next++); }
  await opening; await Promise.all(watched);
  assert.equal(opens, 1);
  assert.equal(worldModeState.projectPath, 'new');
  assert.equal(typeof surface.__coronaNodeGraphFlushSave, 'undefined');
  assert.equal(typeof getNodeGraphSaves(surface).flush, 'function');
});

test('launcher blocks on a failed unmounted graph and saves retained state on explicit retry', async t => {
  const { surface, barriers, barrierReply } = nativeSurface(t);
  let archive = 'old-archive', succeed = false, calls = 0, opens = 0;
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: archive }));
  t.mock.method(editorApi.scripts, 'getStatus', async () => ({ status: 'idle' }));
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => ({ project_path: opens ? 'new' : 'old', mode: 'creative' }));
  await worldModeService.resolve('old', { force: true });
  const messages = getWebMessages(surface);
  t.after(() => messages.dispose());
  const registration = getNodeGraphSaves(surface).register({
    getSession: () => 'old-archive', flush: async () => { calls++; return succeed; },
  });
  await assert.rejects(registration.retire(), { code: 'GRAPH_SAVE_FAILED' });
  t.mock.method(editorApi.project, 'openProject', async () => {
    opens++; archive = 'new-archive'; return { ok: true, path: 'new' };
  });
  await assert.rejects(projectLauncherService.openProject('new'), { code: 'GRAPH_SAVE_FAILED' });
  assert.equal(opens, 0);
  assert.equal(barriers.length, 0, 'failed save cannot retire native documents');
  assert.equal(calls, 2);
  succeed = true;
  let settled = false, next = 0;
  const retry = projectLauncherService.openProject('new');
  retry.then(() => { settled = true; }, () => { settled = true; });
  for (let i = 0; i < 400 && !settled; i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
    while (next < barriers.length) barrierReply(next++);
  }
  await retry;
  assert.equal(opens, 1);
  assert.equal(calls, 3);
  assert.deepEqual(await getNodeGraphSaves(surface).flush('old-archive'), []);
});

test('an active native archive change during graph saving rejects the world switch result', async t => {
  const { surface } = nativeSurface(t);
  let archive = 'old-archive', release;
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: archive }));
  const messages = getWebMessages(surface);
  t.after(() => messages.dispose());
  getNodeGraphSaves(surface).register({ getSession: () => 'old-archive',
    flush: () => new Promise(resolve => { release = resolve; }) });
  const flushing = flushActiveNodeGraphs(surface);
  assert.equal(flushActiveNodeGraphs(surface), flushing);
  const rejected = assert.rejects(flushing, { code: 'CONTEXT_CHANGED' });
  for (let i = 0; i < 100 && !release; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(typeof release, 'function');
  archive = 'new-archive'; release(true);
  await rejected;
});
