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
  const native = {
    close: () => Promise.resolve({ closed: 0 }),
  };
  globalThis.window = { corona: { window: native },
    coronaBridge: { dockCommand: () => { throw new Error('legacy Dock transport is forbidden'); } },
    cefQuery: () => { throw new Error('legacy query transport is forbidden'); },
  };
  t.after(() => { getWebMessages(globalThis.window).dispose(); globalThis.window = previous; });
  return { calls, native };
}

test('application window reads call the native V8 function without JSON', async t => {
  const { snapshot } = nativeWindow(t);
  const stringify = JSON.stringify, parse = JSON.parse;
  t.after(() => { JSON.stringify = stringify; JSON.parse = parse; });
  JSON.stringify = JSON.parse = () => { throw new Error('JSON transport is forbidden'); };
  // ImGui owns window dragging, so the facade no longer declares drag regions.
  assert.equal(appService.setDragRegions, undefined);
  assert.equal(appService.setCurrentTabDragRegions, undefined);
});

test('window service preserves native errors without retrying legacy transport', async t => {
  const { native } = nativeWindow(t);
  const failure = Object.assign(new Error('window closed'), { code: 'WINDOW_CLOSED' });
  native.focus = () => Promise.reject(failure);
  await assert.rejects(editorApi.window.focus({ panelId: 'Object' }), error => error === failure);
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
  native.focus = async identity => { calls.push(['focus', identity.panelId]); return true; };
  native.close = async identity => { calls.push(['close', identity]); return true; };
  await appService.setEditorUiEnabled(true);
  calls.length = 0;
  assert.equal(await appService.focusPanelTab('SceneTools'), true);
  assert.equal(await appService.closePanelTab('Object'), true);
  assert.deepEqual(calls, [['focus', 'SceneTools'], ['close', { panelId: 'Object' }]]);
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
  native.close = async identity => { if (identity.panelId) closed.push(identity.panelId); return { closed: 1 }; };
  await appService.setEditorUiEnabled(true);
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: 'graph-archive' }));
  getNodeGraphSaves().register({ getSession: () => 'graph-archive', flush: () => { saves++; return !fail; } });
  const graph = PLUGIN_MANIFEST.find(panel => panel.routePath === '/NodeGraph');
  await appService.openNativePanel({ panelId: graph.id, routePath: graph.routePath });
  await assert.rejects(appService.closePanelTab(graph.id), { code: 'GRAPH_SAVE_FAILED' });
  assert.deepEqual(closed, []);
  await appService.openNativePanel({ panelId: 'Object', routePath: '/Object' });
  await appService.closePanelTab('Object');
  assert.deepEqual(closed, ['Object'], 'another panel must not wait for an unrelated graph save');
  assert.equal(saves, 1);
  fail = false;
  await appService.closePanelTab(graph.id);
  assert.equal(saves, 2);
  assert.deepEqual(closed, ['Object', graph.id]);
});

test('panel creation uses a typed V8 operation and carries no placement', async t => {
  const { native } = nativeWindow(t);
  const calls = [];
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  native.createPanel = async options => { calls.push(options); return { tab_id: 12, panel_id: options.panelId }; };
  await appService.setEditorUiEnabled(true);
  calls.length = 0;
  assert.deepEqual(await appService.openNativePanel({ panelId: 'inspector', routePath: '/Inspector', width: 420 }),
    { tab_id: 12, panel_id: 'inspector' });
  assert.equal(calls[0].panelId, 'inspector');
  assert.equal(calls[0].width, 420);
  assert.match(calls[0].routePath, /uiSession=.*uiWindow=.*uiOwner=/);
  assert.equal('cmd' in calls[0], false, 'native options must not carry legacy command tags');
  // ImGui owns where a panel sits: there is no placement request to send.
  assert.equal('dockingPos' in calls[0], false);
  assert.equal('nativeDocked' in calls[0], false);
  assert.equal('detached' in calls[0], false);
  assert.equal(appService.detachPanel, undefined);
  assert.equal(appService.redockPanel, undefined);
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
  native.close = async identity => { calls.push(identity.sceneId); return { closed: 0 }; };
  await appService.setEditorUiEnabled(true);
  assert.ok(calls.length > 0);
  assert.ok(calls.every(sceneId => sceneId === ''), 'the retirement fence closes no view');
  native.close = async identity => {
    assert.deepEqual(identity, { sceneId: 'scene-opaque-id', cameraId: 'camera-opaque-id' });
    return true;
  };
  assert.equal(await appService.closeCameraView('scene-opaque-id', 'camera-opaque-id'), true);
  let complete;
  native.close = identity => {
    assert.deepEqual(identity, { sceneId: 'scene-opaque-id' });
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

test('camera presentation and main borderless name the state instead of a toggle', async t => {
  const { native } = nativeWindow(t);
  const calls = [];
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  native.setWindowPresentation = async identity => { calls.push(identity); return true; };
  await appService.setEditorUiEnabled(true);
  assert.equal(await appService.cycleThisCameraViewWindowMode('scene', 'camera'), true);
  assert.equal(await appService.setThisCameraViewPresentation('borderless', 'scene', 'camera'), true);
  assert.equal(await appService.resizeThisCameraView(800, 600, 'scene', 'camera'), true);
  assert.equal(await appService.toggleMainWindowBorderless(), true);
  assert.deepEqual(calls, [
    { sceneId: 'scene', cameraId: 'camera', mode: 'toggle' },
    { sceneId: 'scene', cameraId: 'camera', mode: 'borderless' },
    { sceneId: 'scene', cameraId: 'camera', width: 800, height: 600 },
    { target: 'main', mode: 'toggle' },
  ]);
});

test('camera windows use archive and camera identity without reading a Web numeric handle', async t => {
  const { native } = nativeWindow(t);
  const oldWorld = { ...worldModeState };
  t.after(() => { Object.assign(worldModeState, oldWorld); });
  Object.assign(worldModeState, { status: 'ready', mode: 'creative', revision: 1 });
  window.localStorage = memoryStorage(); window.sessionStorage = memoryStorage(); window.location = { hash: '#/' };
  const calls = [];
  native.createPanel = async options => { calls.push(options); return { tab_id: 31, panel_id: '', existing: false }; };
  await appService.setEditorUiEnabled(true);
  const camera = { archive_session: 'archive-opaque-18446744073709551615', scene_id: 'scene.ini', camera_id: 'camera-main',
    view_x: 0, view_y: 0, view_width: 800, view_height: 600,
    get handle() { throw new Error('Web must not read or convert the camera handle'); },
  };
  assert.deepEqual(await appService.createCameraView(camera), { tab_id: 31, panel_id: '', existing: false });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'camera', 'the camera window is the panel kind, not a second method');
  assert.equal(calls[0].archiveSession, camera.archive_session);
  assert.equal(calls[0].sceneId, camera.scene_id);
  assert.equal(calls[0].cameraId, camera.camera_id);
  assert.equal(calls[0].x, 0); assert.equal(calls[0].y, 0);
  assert.equal('cameraHandle' in calls[0], false);
  assert.equal('cmd' in calls[0], false);
  assert.match(calls[0].routePath, /uiSession=.*uiWindow=.*uiOwner=/);
  const failure = Object.assign(new Error('retired scene'), { code: 'PROJECT_CONTEXT_CHANGED' });
  native.createPanel = async () => { throw failure; };
  await assert.rejects(appService.createCameraView(camera), error => error === failure);
});
