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
const windowCommandOps = {
  closeThisTab: () => editorApi.window.close(),
  closePanelTab: parameters => editorApi.window.closeTab(parameters.tabId),
  focusPanelTab: parameters => editorApi.window.focusTab(parameters.tabId),
  createPanelTab: parameters => editorApi.window.createPanel(parameters),
  detachPanel: parameters => editorApi.window.detachPanel(parameters),
  redockPanel: parameters => editorApi.window.redockPanel(parameters),
  suspendCameraViews: parameters => editorApi.window.suspendCameraViews(parameters.sceneId),
  closeCameraView: parameters => editorApi.window.closeCameraView(parameters.sceneId, parameters.cameraId),
  toggleMaximizeThisCameraView: parameters =>
    editorApi.window.toggleCameraMaximized(parameters.sceneId, parameters.cameraId),
  cycleThisCameraViewWindowMode: parameters =>
    editorApi.window.cycleCameraWindowMode(parameters.sceneId, parameters.cameraId),
  toggleBorderlessThisCameraView: parameters =>
    editorApi.window.toggleCameraBorderless(parameters.sceneId, parameters.cameraId),
  resizeThisCameraView: parameters =>
    editorApi.window.resizeCameraView(parameters.width, parameters.height, parameters.sceneId, parameters.cameraId),
  createCameraView: parameters => editorApi.window.createCameraView(parameters),
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
  setDragRegions: (_routePath, x, y, w, h) =>
    editorApi.window.setDragRegions([{ x, y, w, h }]),
  setCurrentTabDragRegions: (regions) =>
    editorApi.window.setDragRegions(Array.isArray(regions) ? regions : []),
  openNativePanel: options => openEditorWindow({ cmd: 'createPanelTab', ...options }),
  closeThisTab: (panelId) => session().closeThis(panelId),
  closePanelTab: (tabId, panelId) =>
    session().closeTab(tabId, panelId),
  detachPanel: (opts = {}) => openEditorWindow({ cmd: 'detachPanel', ...opts }),
  redockPanel: (opts = {}) => openEditorWindow({ cmd: 'redockPanel', ...opts }),
  toggleMaximizeThisCameraView: (sceneId = '', cameraId = '') =>
    openEditorWindow({ cmd: 'toggleMaximizeThisCameraView', sceneId, cameraId }),
  cycleThisCameraViewWindowMode: (sceneId = '', cameraId = '') =>
    openEditorWindow({ cmd: 'cycleThisCameraViewWindowMode', sceneId, cameraId }),
  // Keep all camera controls in the window session so retired surfaces cannot
  // apply their operations against the next creative world.
  toggleBorderlessThisCameraView: (sceneId = '', cameraId = '') =>
    openEditorWindow({ cmd: 'toggleBorderlessThisCameraView', sceneId, cameraId }),
  toggleMainWindowBorderless: () =>
    editorApi.window.toggleMainBorderless(),
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
