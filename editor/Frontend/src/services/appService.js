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
import { flushBeforeClose } from './autosave.js';

const windowSessions = new WeakMap();
// Closed 1:1 mapping from the window session's intent vocabulary to the named
// facade bindings. Not a general command router: unknown cmds are rejected.
// Native merged its duplicated window verbs, so the intents below express *what*
// they want (a kind of panel, a window state) rather than the verb that used to
// encode it. Placement is ImGui's: the user docks a panel, not the Web layer.
// The window commands below already carry the wire spelling (snake_case), so each entry
// hands its parameters straight to the binding: there is no translation step, and no
// second vocabulary to keep in sync.
const windowCommandOps = {
  closeThisTab: () => editorApi.window.close(),
  closePanelTab: parameters => editorApi.window.close(parameters),
  focusPanelTab: parameters => editorApi.window.focus(parameters),
  createPanelTab: parameters => editorApi.window.create_panel(parameters),
  // The plural form of close: every camera view of that scene, and the two-turn fence.
  suspendCameraViews: parameters => editorApi.window.close(parameters),
  closeCameraView: parameters => editorApi.window.close(parameters),
  cycleThisCameraViewWindowMode: parameters =>
    editorApi.window.set_window_presentation({ ...parameters, mode: 'toggle' }),
  setThisCameraViewPresentation: parameters => editorApi.window.set_window_presentation(parameters),
  // A size is a presentation too, so it rides the same entry as the modes.
  resizeThisCameraView: parameters => editorApi.window.set_window_presentation(parameters),
  createCameraView: parameters => editorApi.window.create_panel({ ...parameters, kind: 'camera' }),
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
      beforeClose: record => record.panel_id === 'NodeGraphPanel' ? flushActiveNodeGraphs(surface) : undefined,
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
  focusPanelTab: panel_id => openEditorWindow({ cmd: 'focusPanelTab', panel_id }),
  readEditorUiPolicy: async () => { await session().hydrate(); return session().policy(); },
  setEditorUiEnabled: enabled => session().prepare(enabled),
  // The facade hands the native subscription straight through, so the returned
  // unsubscribe is the native one. The payload uses the wire spelling (snake_case),
  // the same one every reply carries.
  onWindowClosed: callback => editorApi.window.on_closed(callback),
  onWindowCloseRequested: callback => editorApi.window.on_close_requested(callback),
  openNativePanel: options => openEditorWindow({ cmd: 'createPanelTab', ...options }),
  closeThisTab: (panel_id) => session().closeThis(panel_id),
  // Panel identity is the stable panel id, not the transient tab id a reply carried.
  closePanelTab: panel_id => session().closeTab(panel_id),
  // Keep all camera controls in the window session so retired surfaces cannot
  // apply their operations against the next creative world.
  cycleThisCameraViewWindowMode: (scene_id = '', camera_id = '') =>
    openEditorWindow({ cmd: 'cycleThisCameraViewWindowMode', scene_id, camera_id }),
  // The camera view tracks its own borderless state, so it can ask for the state
  // it wants instead of flipping an unknown one.
  setThisCameraViewPresentation: (mode, scene_id = '', camera_id = '') =>
    openEditorWindow({ cmd: 'setThisCameraViewPresentation', mode, scene_id, camera_id }),
  toggleMainWindowBorderless: () =>
    editorApi.window.set_window_presentation({ target: 'main', mode: 'toggle' }),
  resizeThisCameraView: (width, height, scene_id = '', camera_id = '') =>
    openEditorWindow({ cmd: 'resizeThisCameraView', width, height, scene_id, camera_id }),
  createCameraView: (camera) =>
    openEditorWindow({
      cmd: 'createCameraView',
      scene_id: camera.scene_id,
      camera_id: camera.camera_id || camera.id,
      archive_session: camera.archive_session,
      route_path: `/CameraView?scene=${encodeURIComponent(camera.scene_id)}&camera=${encodeURIComponent(camera.camera_id || camera.id)}&archive=${encodeURIComponent(camera.archive_session)}`,
      width: camera.view_width ?? 960,
      height: camera.view_height ?? 540,
      x: camera.view_x ?? 120,
      y: camera.view_y ?? 120,
    }),
  closeCameraView: (scene_id, camera_id) =>
    openEditorWindow({ cmd: 'closeCameraView', scene_id, camera_id }),
  suspendCameraViews: (scene_id) => editorApi.window.close({ scene_id }),
  crossTabBroadcast: (event, payload) =>
    session().broadcast(event, payload),
  // The process is about to end: write the scene once before asking native to quit. `saveNow`
  // writes even when the dirty flag is clear, because that flag only knows the facade methods it
  // wraps - the last write before the process ends should not depend on that heuristic.
  close_process: () => flushBeforeClose(
    () => editorApi.autosave.saveNow(),
    () => editorApi.app.close_process()),
};
