// Public editor contracts call named native V8 bindings. The facade is
// import-clean: the scene read chain and its DOM listeners belong to the
// observer runtime (observerRuntime.js), started from main.js.

import { withAutosave } from '../services/autosave.js';

/** Call one Python service through the single transport entry and parse it here. */
const bridgeCall = async (service, method, args = []) => {
  const raw = await window.corona.bridge.call(JSON.stringify({ service, function: method, args }));
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
};

/** Project file operations are owned by the Python archive service.
 *
 * The service answers one of its success shapes (true, a tree entry, a list of
 * entries, {status:'success'}); a refusal rejects the Promise with an Error
 * carrying error.code (the bridge raises it on the service side), so callers
 * branch on error.code instead of matching translated message text.
 */
const fileOp = async (op, request, fields) => bridgeCall('project_archive', 'file_manager', [{
  archive_session: request.archive_session,
  project_path: request.project_path,
  op,
  ...fields,
}]);

const editorApiStatic = {
  app: {
    close_process: () => window.corona.app.close_process(),
  },
  files: {
    getFileTree: async request => ({
      ...await fileOp('get_file_tree', request, { path: request.path ?? '' }),
      project_path: request.project_path,
    }),
    createFolder: request => fileOp('create_folder', request, { path: request.path, name: request.name }),
    createActorTemplate: request => fileOp('create_file', request, { path: request.path, name: request.name, file_type: 'actor' }),
    deleteItem: request => fileOp('delete_item', request, { path: request.path }),
    renameItem: request => fileOp('rename_item', request, { path: request.path, name: request.name }),
  },
  network: {
    start_session: (instanceName, projectId, port = 27960, role = 'host') =>
      window.corona.network.start_session(instanceName, projectId, port, role),
    stop_session: () => window.corona.network.stop_session(),
    get_session_info: () => window.corona.network.get_session_info(),
    get_discovered_peers: () => window.corona.network.get_discovered_peers(),
    clear_discovered_peers: () => window.corona.network.clear_discovered_peers(),
    search_lan: () => window.corona.network.search_lan(),
    connect_to_peer: (ip, port, peerName) => window.corona.network.connect_to_peer(ip, port, peerName),
    set_project_root: (projectRoot) => window.corona.network.set_project_root(projectRoot),
  },
  project: {
    create_multiplayer_project: request => window.corona.project.create_multiplayer_project(request),
    create_world_project: request => window.corona.project.create_world_project(request),
    // The version lives in the editor ini, which the archive service owns; the facade asks it
    // through the bridge instead of keeping a native route that only forwarded the answer.
    getAppVersion: async () => {
      const settings = await bridgeCall('project_archive', 'editor_settings',
        [{ section: 'General', key: 'version', fallback: '1.2.0' }]);
      return settings?.value ?? '1.2.0';
    },
    get_project_load_status: () => window.corona.project.get_project_load_status(),
    get_recent_projects: () => window.corona.project.get_recent_projects(),
    open_project: (projectPath, options = {}) =>
      window.corona.project.open_project(projectPath, options),
    open_project_file: () => window.corona.project.open_project_file(),
    // Opening a project document reloads the native scene, so this route stays in C++.
    open_document: request => window.corona.project.open_document(request),
    // Active-project metadata is a project write, not a file-manager operation.
    save_active_project_info: settings => window.corona.project.save_active_project_info(settings),
  },
  audio: {
    // The identity decides what plays: a resource id, or an actor of a scene.
    play: (identity, options = {}) => window.corona.audio.play({ ...identity, ...options }),
    stop: identity => window.corona.audio.stop({ ...identity }),
  },
  input: {
    // The camera is the target; the scene it belongs to is an argument.
    dispatch: (sceneName, cameraId, event) => window.corona.input.dispatch(sceneName, cameraId, event),
  },
  scene: {
    read_scene: request => window.corona.scene.read_scene(request),
    read_actor_rig: (sceneName, actor, scope) => window.corona.scene.read_actor_rig(sceneName, actor, scope),
    select_actor: (sceneName, actorType, actorName, context = null) =>
      context ? window.corona.scene.select_actor(sceneName, actorType, actorName, context)
        : window.corona.scene.select_actor(sceneName, actorType, actorName),
    create_camera: (sceneName, options) => window.corona.scene.create_camera(sceneName, options),
    read_active: () => window.corona.scene.read_active(),
    select_model_file: (sceneName, fileType = 'model', scope) =>
      window.corona.scene.select_model_file(sceneName, { ...(scope || {}), file_type: fileType }),
    create_actor: (sceneName, path, options) => window.corona.scene.create_actor(sceneName, path, options),
    import_resource_file: (sceneName, fileType = 'model', scope) =>
      window.corona.scene.import_resource_file(sceneName, { ...(scope || {}), file_type: fileType }),
    read_actor_properties: (sceneName, actor, scope) => window.corona.scene.read_actor_properties(sceneName, actor, scope),
    read_model_nodes: (sceneName, options) => window.corona.scene.read_model_nodes(sceneName, options),
    set_model_node_state: (identity, patch) => window.corona.scene.set_model_node_state(identity, patch),
    set_actor_ik_chains: (sceneName, actor, chains, expectedRevision, scope) => expectedRevision === undefined
      ? window.corona.scene.set_actor_ik_chains(sceneName, actor, chains, scope)
      : window.corona.scene.set_actor_ik_chains(sceneName, actor, chains, expectedRevision, scope),
    read_transforms: (session, actors) => window.corona.scene.read_transforms({ archive_session: session, actors }),
    set_actor_transform: (sceneName, actorName, transform) =>
      window.corona.scene.set_actor_transform(sceneName, actorName, transform),
    update_actor: (sceneName, actorName, patch) =>
      window.corona.scene.update_actor(sceneName, actorName, patch),
    delete_actor: (sceneName, actor, scope) =>
      window.corona.scene.delete_actor(sceneName, actor, scope),
    rebind_actor_resource: (sceneName, actorGuid, path, scope) =>
      window.corona.scene.rebind_actor_resource(sceneName, actorGuid, path, scope),
    save: (sceneName, scope) => window.corona.scene.save(sceneName, scope),
    focus_actor: (sceneName, actorName, cameraId, scope) => window.corona.scene.focus_actor(sceneName, actorName, cameraId, scope),
    update_camera: (sceneName, cameraId, patch) => window.corona.scene.update_camera(sceneName, cameraId, patch),
    set_camera_render_settings: (sceneName, cameraId, patch) =>
      window.corona.scene.set_camera_render_settings(sceneName, cameraId, patch),
    read_camera_render_settings: (sceneName, cameraId, scope) =>
      window.corona.scene.read_camera_render_settings(sceneName, cameraId, scope),
    delete_camera: (sceneName, cameraId, scope) =>
      window.corona.scene.delete_camera(sceneName, cameraId, scope),
    read_environment: (sceneName, scope) => window.corona.scene.read_environment(sceneName, scope),
    set_environment: (sceneName, patch) => window.corona.scene.set_environment(sceneName, patch),
  },
  window: {
    // One verb for "close a window"; the identity decides which. No argument = this one.
    close: identity => identity === undefined ? window.corona.window.close()
      : window.corona.window.close(identity),
    focus: options => window.corona.window.focus(options),
    create_panel: options => window.corona.window.create_panel(options),
    set_window_presentation: options => window.corona.window.set_window_presentation(options),
    on_closed: callback => window.corona.window.on_closed(callback),
    on_close_requested: callback => window.corona.window.on_close_requested(callback),
    // One probe for "the native window surface is here": the app only uses it to decide
    // whether it may retire windows and subscribe to close requests.
    hasWindowBindings: () => typeof window.corona?.window?.close === 'function'
      && typeof window.corona?.window?.on_close_requested === 'function',
  },
  viewport: {
    configure: (sceneName, cameraId, patch) => window.corona.viewport.configure(sceneName, cameraId, patch),
    // A capture is a viewport operation, not scene state.
    capture_screenshot: (sceneName, cameraId, options) =>
      window.corona.viewport.capture_screenshot(sceneName, cameraId, options),
  },
  projectFiles: {
    save: request => bridgeCall('project_files', 'save', [request]),
    load: request => bridgeCall('project_files', 'load', [request]),
  },
  projectSettings: {
    // Documents are owned by the Python archive service.
    readProjectDocument: request => bridgeCall('project_archive', 'read_document',
      [{ ...request, revision_only: true }]),
    commitProjectDocument: request => bridgeCall('project_archive', 'commit_document',
      [{ ...request, revision_only: true }]),
    // The projection is composed here from the scene primitive plus archive metadata.
    getActiveProjectInfo: async () => {
      const active = await window.corona.scene.read_active();
      if (active.read_only) {
        return { name: active.name, mode: 'creative', project_path: active.project_path,
          read_only: true, source_path: active.project_path, archive_session: active.archive_session };
      }
      const info = await bridgeCall('project_archive', 'project_info', [{ path: active.project_path }]);
      return { ...info, archive_session: active.archive_session, read_only: false };
    },
    // Saving metadata refreshes the native scene cache, so this route stays in C++.
  },
  // Single Web -> Python entry point. The envelope is built here and parsed by
  // Python; C++ only carries it, so JS owns its own request schema.
  bridge: {
    call: (service, method, args = []) =>
      window.corona.bridge.call(JSON.stringify({ service, function: method, args })),
  },

};

// Autosave is a renderer decision: the native bindings are read-only V8 properties, so the
// facade is where a dirty mark can be attached. `editorApi.autosave` exposes flush/state.
export const editorApi = withAutosave(editorApiStatic);

// 快捷访问
// LAN transport belongs to C++ NetworkSystem; Web calls native V8 contracts.
