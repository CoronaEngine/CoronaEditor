import assert from 'node:assert/strict';
import test from 'node:test';
import { getWebMessages } from '../../src/api/webMessages.js';
import { memoryStorage } from './windowSessionFixtures.mjs';
import { PLUGIN_MANIFEST } from '../../src/config/pluginManifest.js';
import { getNodeGraphSaves } from '../../src/services/nodeGraphSaves.js';

globalThis.window = {};
const { appService } = await import('../../src/services/appService.js');
const { editorApi } = await import('../../src/api/editorApi.js');
const { worldModeState } = await import('../../src/services/worldModeService.js');

function nativeWindow(t) {
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: '' }));
  const previous = globalThis.window;
  const calls = [];
  const snapshot = { browserId: '18446744073709551615', frameId: 'frame', dragRegions: [] };
  const native = {
    getCurrent: () => Promise.resolve(snapshot),
    setDragRegions: regions => { calls.push(regions); return Promise.resolve(snapshot); },
    suspendCameraViews: () => Promise.resolve({ closed: 0 }),
  };
  globalThis.window = { corona: { window: native },
    coronaBridge: { dockCommand: () => { throw new Error('legacy Dock transport is forbidden'); } },
    cefQuery: () => { throw new Error('legacy query transport is forbidden'); },
  };
  t.after(() => { getWebMessages(globalThis.window).dispose(); globalThis.window = previous; });
  return { calls, snapshot, native };
}

test('application window reads and drag updates call native V8 functions without JSON', async t => {
  const { calls, snapshot } = nativeWindow(t);
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON transport is forbidden'); };
  assert.equal(await appService.getCurrentWindow(), snapshot);
  const regions = [{ x: 2, y: 3, w: 40, h: 12 }];
  assert.equal(await appService.setCurrentTabDragRegions(regions), snapshot);
  assert.equal(calls[0], regions);
  await appService.setDragRegions('/ignored', 1, 2, 30, 10);
  assert.deepEqual(calls[1], [{ x: 1, y: 2, w: 30, h: 10 }]);
  await appService.setCurrentTabDragRegions(undefined);
  assert.deepEqual(calls[2], []);
});

test('window service preserves native errors without retrying legacy transport', async t => {
  const { native } = nativeWindow(t);
  const failure = Object.assign(new Error('window closed'), { code: 'WINDOW_CLOSED' });
  native.setDragRegions = () => Promise.reject(failure);
  await assert.rejects(appService.setCurrentTabDragRegions([]), error => error === failure);
});

test('window subscriptions reference the native callbacks and return their unsubscribe functions', t => {
  const { native } = nativeWindow(t);
  const callback = () => {}, stop = () => {};
  native.onClosed = value => { assert.equal(value, callback); return stop; };
  native.onCloseRequested = value => { assert.equal(value, callback); return stop; };
  assert.equal(appService.onWindowClosed(callback), stop);
  assert.equal(appService.onWindowCloseRequested(callback), stop);
});

test('window session invokes native focus and close without old commands or a legacy completion barrier', async t => {
  const { native } = nativeWindow(t);
  const calls = [];
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  native.focusTab = async id => { calls.push(['focus', id]); return true; };
  native.closeTab = async id => { calls.push(['close', id]); return true; };
  await appService.setEditorUiEnabled(true);
  calls.length = 0;
  assert.equal(await appService.focusPanelTab(7), true);
  assert.equal(await appService.closePanelTab(7, 'ignored-panel-name'), true);
  assert.deepEqual(calls, [['focus', 7], ['close', 7]]);
});

test('closing the registered node panel uses the graph save barrier and retains failed state', async t => {
  const { native } = nativeWindow(t);
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  let nextTab = 0, saves = 0, fail = true;
  const closed = [];
  native.createPanel = async () => ({ tab_id: ++nextTab });
  native.closeTab = async id => closed.push(id);
  await appService.setEditorUiEnabled(true);
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: 'graph-archive' }));
  getNodeGraphSaves().register({ getSession: () => 'graph-archive', flush: () => { saves++; return !fail; } });
  const graph = PLUGIN_MANIFEST.find(panel => panel.routePath === '/NodeGraph');
  const node = await appService.openNativePanel({ panelId: graph.id, routePath: graph.routePath });
  await assert.rejects(appService.closePanelTab(node.tab_id, ''), { code: 'GRAPH_SAVE_FAILED' });
  assert.deepEqual(closed, []);
  const other = await appService.openNativePanel({ panelId: 'Object', routePath: '/Object' });
  await appService.closePanelTab(other.tab_id, '');
  assert.deepEqual(closed, [other.tab_id], 'another panel must not wait for an unrelated graph save');
  assert.equal(saves, 1);
  fail = false;
  await appService.closePanelTab(node.tab_id, '');
  assert.equal(saves, 2);
  assert.deepEqual(closed, [other.tab_id, node.tab_id]);
});

test('panel creation and docking use typed V8 operations without legacy completion fences', async t => {
  const { native } = nativeWindow(t);
  const calls = [];
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  native.createPanel = async options => { calls.push(['create', options]); return { tab_id: 12, panel_id: options.panelId }; };
  native.detachPanel = async options => { calls.push(['detach', options]); return true; };
  native.redockPanel = async options => { calls.push(['redock', options]); return false; };
  await appService.setEditorUiEnabled(true);
  calls.length = 0;
  assert.deepEqual(await appService.openNativePanel({ panelId: 'inspector', routePath: '/Inspector', width: 420 }),
    { tab_id: 12, panel_id: 'inspector' });
  assert.equal(calls[0][0], 'create');
  assert.equal(calls[0][1].panelId, 'inspector');
  assert.equal(calls[0][1].width, 420);
  assert.match(calls[0][1].routePath, /uiSession=.*uiWindow=.*uiOwner=/);
  assert.equal('cmd' in calls[0][1], false, 'native options must not carry legacy command tags');
  assert.equal(await appService.detachPanel({ tabId: 12, maximized: true }), true);
  assert.equal(await appService.redockPanel({ tabId: 12 }), false);
  assert.deepEqual(calls.slice(1), [['detach', { tabId: 12, maximized: true }], ['redock', { tabId: 12 }]]);
  const failure = Object.assign(new Error('retired'), { code: 'CONTEXT_CHANGED' });
  native.createPanel = () => Promise.reject(failure);
  await assert.rejects(appService.openNativePanel({ panelId: 'other' }), error => error === failure);
});

test('camera suspension and startup retirement await the native V8 barrier', async t => {
  const { native } = nativeWindow(t);
  const calls = [];
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  native.suspendCameraViews = async sceneId => { calls.push(sceneId); return { closed: 0 }; };
  await appService.setEditorUiEnabled(true);
  assert.ok(calls.length > 0);
  assert.ok(calls.every(sceneId => sceneId === ''));
  native.closeCameraView = async (sceneId, cameraId) => {
    assert.equal(sceneId, 'scene-opaque-id'); assert.equal(cameraId, 'camera-opaque-id');
    return { closed: true };
  };
  assert.deepEqual(await appService.closeCameraView('scene-opaque-id', 'camera-opaque-id'), { closed: true });
  let complete;
  native.suspendCameraViews = sceneId => {
    assert.equal(sceneId, 'scene-opaque-id');
    return new Promise(resolve => { complete = resolve; });
  };
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON transport is forbidden'); };
  const pending = appService.suspendCameraViews('scene-opaque-id');
  let finished = false;
  pending.then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  const result = { closed: 2 };
  complete(result);
  assert.equal(await pending, result);
});

test('camera geometry and main borderless controls use direct V8 without queue fences', async t => {
  const { native } = nativeWindow(t);
  const calls = [];
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  for (const method of ['toggleCameraMaximized', 'cycleCameraWindowMode', 'toggleCameraBorderless', 'resizeCameraView', 'toggleMainBorderless']) {
    native[method] = async (...args) => { calls.push([method, ...args]); return true; };
  }
  await appService.setEditorUiEnabled(true);
  assert.equal(await appService.toggleMaximizeThisCameraView('scene', 'camera'), true);
  assert.equal(await appService.cycleThisCameraViewWindowMode('scene', 'camera'), true);
  assert.equal(await appService.toggleBorderlessThisCameraView('scene', 'camera'), true);
  assert.equal(await appService.resizeThisCameraView(800, 600, 'scene', 'camera'), true);
  assert.equal(await appService.toggleMainWindowBorderless(), true);
  assert.deepEqual(calls, [
    ['toggleCameraMaximized', 'scene', 'camera'], ['cycleCameraWindowMode', 'scene', 'camera'],
    ['toggleCameraBorderless', 'scene', 'camera'], ['resizeCameraView', 800, 600, 'scene', 'camera'],
    ['toggleMainBorderless'],
  ]);
});

test('camera windows use archive and camera identity without reading a Web numeric handle', async t => {
  const { native } = nativeWindow(t);
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  const calls = [];
  native.createCameraView = async options => { calls.push(options); return { tab_id: 31, existing: false }; };
  await appService.setEditorUiEnabled(true);
  const camera = { archive_session: 'archive-opaque-18446744073709551615', scene_id: 'scene.ini', camera_id: 'camera-main',
    view_x: 0, view_y: 0, view_width: 800, view_height: 600,
    get handle() { throw new Error('Web must not read or convert the camera handle'); },
  };
  assert.deepEqual(await appService.createCameraView(camera), { tab_id: 31, existing: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].archiveSession, camera.archive_session);
  assert.equal(calls[0].sceneId, camera.scene_id);
  assert.equal(calls[0].cameraId, camera.camera_id);
  assert.equal(calls[0].x, 0); assert.equal(calls[0].y, 0);
  assert.equal('cameraHandle' in calls[0], false);
  assert.equal('cmd' in calls[0], false);
  assert.match(calls[0].routePath, /uiSession=.*uiWindow=.*uiOwner=/);
  const failure = Object.assign(new Error('retired scene'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.createCameraView = async () => { throw failure; };
  await assert.rejects(appService.createCameraView(camera), error => error === failure);
});
