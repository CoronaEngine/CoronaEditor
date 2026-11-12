/**
 * Canonical application/Dock service for Vue callers.
 *
 * This service assembles Web-owned Dock sessions and uses named V8 window
 * bindings for native window operations.
 */

import { editorApi } from '../api/editorApi.js';
import { editorUiAllowed, worldModeState } from './worldModeService.js';

import { createEditorWindowSession } from './editorWindowSession.js';
import { getWebMessages } from '../api/webMessages.js';
import { getWebDocumentIdentity } from '../api/webDocument.js';
import { createWindowSessionActivities } from './windowSessionActivities.js';
import { createWindowSessionState } from './windowSessionState.js';
import { flushActiveNodeGraphs } from './nodeGraphSaves.js';

const windowSessions = new WeakMap();
// Closed 1:1 mapping from the window session's intent vocabulary to the named
// facade bindings. Not a general command router: unknown cmds are rejected.
// Native merged its duplicated window verbs, so the intents below express *what*
// they want (a kind of panel, a window state) rather than the verb that used to
// encode it. Placement is ImGui's: the user docks a panel, not the Web layer.
const windowCommandOps = {
  closeThisTab: () => editorApi.window.close(),
  closePanelTab: parameters => editorApi.window.closeTab(parameters.tabId),
  focusPanelTab: parameters => editorApi.window.focusTab(parameters.tabId),
  createPanelTab: parameters => editorApi.window.createPanel(parameters),
  suspendCameraViews: parameters => editorApi.window.suspendCameraViews(parameters.sceneId),
  closeCameraView: parameters => editorApi.window.closeCameraView(parameters.sceneId, parameters.cameraId),
  cycleThisCameraViewWindowMode: parameters => editorApi.window.setWindowPresentation({
    sceneId: parameters.sceneId, cameraId: parameters.cameraId, mode: 'toggle' }),
  setThisCameraViewPresentation: parameters => editorApi.window.setWindowPresentation({
    sceneId: parameters.sceneId, cameraId: parameters.cameraId, mode: parameters.mode }),
  resizeThisCameraView: parameters =>
    editorApi.window.resizeCameraView(parameters.width, parameters.height, parameters.sceneId, parameters.cameraId),
  createCameraView: parameters => editorApi.window.createPanel({ ...parameters, kind: 'camera' }),
};
function sendWindowCommand(command) {
  const op = windowCommandOps[command.cmd];
  if (!op) throw Object.assign(new Error(`Unknown window operation: ${command.cmd}`), { code: 'INVALID_OPERATION' });
  const { cmd, ...parameters } = command;
  return op(parameters);
}
function session() {
  let controller = windowSessions.get(window);
  if (!controller) {
    const surface = window;
    const identity = getWebDocumentIdentity(surface);
    const query = new URLSearchParams(identity.query);
    const messages = getWebMessages(surface);
    const main = identity.role === 'main';
    const owner = identity.owner;
    // A Dock must join the tagged generation before its first state request.
    // Its own sessionStorage identifies a different surface, not the main owner.
    const state = createWindowSessionState(messages, { owner, main,
      generation: identity.generation });
    messages.setGeneration(() => state.read().generation);
    controller = createEditorWindowSession({
      owner,
      state,
      activities: createWindowSessionActivities(messages),
      send: sendWindowCommand,
      beforeRetire: () => flushActiveNodeGraphs(surface),
      beforeClose: record => record.panelId === 'NodeGraphPanel' ? flushActiveNodeGraphs(surface) : undefined,
      publish: (topic, payload) => messages.emit(topic, payload),
      getWorld: () => worldModeState,
      getQuery: () => query,
    });
    windowSessions.set(window, controller);
  }
  return controller;
}
export const isCurrentWindowEvent = payload => editorUiAllowed() && session().accepts(payload);
const openEditorWindow = command => session().open(command);

export const appService = {
  focusPanelTab: tabId => openEditorWindow({ cmd: 'focusPanelTab', tabId }),
  readEditorUiPolicy: async () => { await session().hydrate(); return session().policy(); },
  setEditorUiEnabled: enabled => session().prepare(enabled),
  getCurrentWindow: () => editorApi.window.getCurrent(),
  onWindowClosed: callback => editorApi.window.onClosed(callback),
  onWindowCloseRequested: callback => editorApi.window.onCloseRequested(callback),
  openNativePanel: options => openEditorWindow({ cmd: 'createPanelTab', ...options }),
  closeThisTab: (panelId) => session().closeThis(panelId),
  closePanelTab: (tabId, panelId) =>
    session().closeTab(tabId, panelId),
  // Keep all camera controls in the window session so retired surfaces cannot
  // apply their operations against the next creative world.
  cycleThisCameraViewWindowMode: (sceneId = '', cameraId = '') =>
    openEditorWindow({ cmd: 'cycleThisCameraViewWindowMode', sceneId, cameraId }),
  // The camera view tracks its own borderless state, so it can ask for the state
  // it wants instead of flipping an unknown one.
  setThisCameraViewPresentation: (mode, sceneId = '', cameraId = '') =>
    openEditorWindow({ cmd: 'setThisCameraViewPresentation', mode, sceneId, cameraId }),
  toggleMainWindowBorderless: () =>
    editorApi.window.setWindowPresentation({ target: 'main', mode: 'toggle' }),
  resizeThisCameraView: (width, height, sceneId = '', cameraId = '') =>
    openEditorWindow({ cmd: 'resizeThisCameraView', width, height, sceneId, cameraId }),
  createCameraView: (camera) =>
    openEditorWindow({
      cmd: 'createCameraView',
      sceneId: camera.scene_id,
      cameraId: camera.camera_id || camera.id,
      archiveSession: camera.archive_session,
      routePath: `/CameraView?scene=${encodeURIComponent(camera.scene_id)}&camera=${encodeURIComponent(camera.camera_id || camera.id)}&archive=${encodeURIComponent(camera.archive_session)}`,
      width: camera.view_width ?? 960,
      height: camera.view_height ?? 540,
      x: camera.view_x ?? 120,
      y: camera.view_y ?? 120,
    }),
  closeCameraView: (sceneId, cameraId) =>
    openEditorWindow({ cmd: 'closeCameraView', sceneId, cameraId }),
  suspendCameraViews: (sceneId) => editorApi.window.suspendCameraViews(sceneId),
  crossTabBroadcast: (event, payload) =>
    session().broadcast(event, payload),
  closeProcess: () => editorApi.app.closeProcess(),
};
