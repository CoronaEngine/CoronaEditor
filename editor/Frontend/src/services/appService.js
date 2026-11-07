/**
 * Canonical application/Dock service for Vue callers.
 *
 * The manifest transport remains owned by `src/api/editorApi.js`; this service
 * only assembles Dock/window commands and application lifecycle operations.
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
function sendWindowCommand(command) {
  const { cmd, ...parameters } = command;
  switch (cmd) {
    case 'closeThisTab': return window.corona.window.close();
    case 'closePanelTab': return window.corona.window.closeTab(command.tabId);
    case 'focusPanelTab': return window.corona.window.focusTab(command.tabId);
    case 'createPanelTab': return window.corona.window.createPanel(parameters);
    case 'detachPanel': return window.corona.window.detachPanel(parameters);
    case 'redockPanel': return window.corona.window.redockPanel(parameters);
    case 'suspendCameraViews': return window.corona.window.suspendCameraViews(command.sceneId);
    case 'closeCameraView': return window.corona.window.closeCameraView(command.sceneId, command.cameraId);
    case 'toggleMaximizeThisCameraView': return window.corona.window.toggleCameraMaximized(command.sceneId, command.cameraId);
    case 'cycleThisCameraViewWindowMode': return window.corona.window.cycleCameraWindowMode(command.sceneId, command.cameraId);
    case 'toggleBorderlessThisCameraView': return window.corona.window.toggleCameraBorderless(command.sceneId, command.cameraId);
    case 'resizeThisCameraView': return window.corona.window.resizeCameraView(command.width, command.height, command.sceneId, command.cameraId);
    case 'createCameraView': return window.corona.window.createCameraView(parameters);
    default: throw Object.assign(new Error(`Unknown window operation: ${cmd}`), { code: 'INVALID_OPERATION' });
  }
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
  getCurrentWindow: () => window.corona.window.getCurrent(),
  onWindowClosed: callback => window.corona.window.onClosed(callback),
  onWindowCloseRequested: callback => window.corona.window.onCloseRequested(callback),
  setDragRegions: (_routePath, x, y, w, h) =>
    window.corona.window.setDragRegions([{ x, y, w, h }]),
  setCurrentTabDragRegions: (regions) =>
    window.corona.window.setDragRegions(Array.isArray(regions) ? regions : []),
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
    window.corona.window.toggleMainBorderless(),
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
  suspendCameraViews: (sceneId) => window.corona.window.suspendCameraViews(sceneId),
  crossTabBroadcast: (event, payload) =>
    session().broadcast(event, payload),
  closeProcess: () => editorApi.app.closeProcess(),
};
