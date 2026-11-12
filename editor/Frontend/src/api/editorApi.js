// Public editor contracts call named native V8 bindings. The facade is
// import-clean: the scene read chain and its DOM listeners belong to the
// observer runtime (observerRuntime.js), started from main.js.

import { withAutosave } from '../services/autosave.js';

/** Call one Python service through the single transport entry and parse it here. */
const bridgeCall = async (service, method, args = []) => {
  const raw = await window.corona.bridge.call(JSON.stringify({ service, function: method, args }));
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
};

/** Project file operations are owned by the Python archive service. */
const fileOp = (op, request, args) => bridgeCall('ProjectArchive', 'file_manager', [{
  archive_session: request.archive_session,
  project_path: request.project_path,
  op,
  args,
}]);

const editorApiStatic = {
  app: {
    closeProcess: () => window.corona.app.closeProcess(),
  },
  files: {
    getFileTree: async request => ({
      ...await fileOp('get_file_tree', request, [request.path ?? '']),
      project_path: request.project_path,
    }),
    createFolder: request => fileOp('create_folder', request, [request.path, request.name]),
    createActorTemplate: request => fileOp('create_file', request, [request.path, request.name, 'actor']),
    deleteItem: request => fileOp('delete_item', request, [request.path]),
    renameItem: request => fileOp('rename_item', request, [request.path, request.name]),
    // Opening a scene reloads the native scene, so this route stays in C++.
    openFile: request => window.corona.files.openFile(request),
  },
  network: {
    startSession: (instanceName, projectId, port = 27960, role = 'host') =>
      window.corona.network.startSession(instanceName, projectId, port, role),
    stopSession: () => window.corona.network.stopSession(),
    getSessionInfo: () => window.corona.network.getSessionInfo(),
    getDiscoveredPeers: () => window.corona.network.getDiscoveredPeers(),
    clearDiscoveredPeers: () => window.corona.network.clearDiscoveredPeers(),
    searchLan: () => window.corona.network.searchLan(),
    connectToPeer: (ip, port, peerName) => window.corona.network.connectToPeer(ip, port, peerName),
    setProjectRoot: (projectRoot) => window.corona.network.setProjectRoot(projectRoot),
  },
  project: {
    createMultiplayerProject: request => window.corona.project.createMultiplayerProject(request),
    createWorldProject: request => window.corona.project.createWorldProject(request),
    // The version lives in the editor ini, which the archive service owns; the facade asks it
    // through the bridge instead of keeping a native route that only forwarded the answer.
    getAppVersion: async () => {
      const settings = await bridgeCall('ProjectArchive', 'editor_settings',
        [{ section: 'General', key: 'version', fallback: '1.2.0' }]);
      return settings?.value ?? '1.2.0';
    },
    getProjectLoadStatus: () => window.corona.project.getProjectLoadStatus(),
    getRecentProjects: () => window.corona.project.getRecentProjects(),
    openProject: (projectPath, options = {}) =>
      window.corona.project.openProject(projectPath, options),
    openProjectFile: () => window.corona.project.openProjectFile(),
  },
  audio: {
    playResource: (resourceId, loop = false) => window.corona.audio.playResource(resourceId, loop),
    stopResource: (resourceId) => window.corona.audio.stopResource(resourceId),
    playActor: (sceneName, actor, scope, loop = false) =>
      window.corona.audio.playActor(sceneName, actor, { ...(scope || {}), loop }),
    stopActor: (sceneName, actor, scope) => window.corona.audio.stopActor(sceneName, actor, scope),
  },
  scene: {
    readScene: request => window.corona.scene.readScene(request),
    readActorRig: (sceneName, actor, scope) => window.corona.scene.readActorRig(sceneName, actor, scope),
    selectActor: (sceneName, actorType, actorName, context = null) =>
      context ? window.corona.scene.selectActor(sceneName, actorType, actorName, context)
        : window.corona.scene.selectActor(sceneName, actorType, actorName),
    createCamera: (sceneName, options) => window.corona.scene.createCamera(sceneName, options),
    isVisionAvailable: () => window.corona.scene.isVisionAvailable(),
    readActive: () => window.corona.scene.readActive(),
    selectModelFile: (sceneName, fileType = 'model', scope) =>
      window.corona.scene.selectModelFile(sceneName, { ...(scope || {}), file_type: fileType }),
    createActor: (sceneName, path, options) => window.corona.scene.createActor(sceneName, path, options),
    importResourceFile: (sceneName, fileType = 'model', scope) =>
      window.corona.scene.importResourceFile(sceneName, { ...(scope || {}), file_type: fileType }),
    readActorProperties: (sceneName, actor, scope) => window.corona.scene.readActorProperties(sceneName, actor, scope),
    readModelNodes: (sceneName, options) => window.corona.scene.readModelNodes(sceneName, options),
    setModelNodeState: (identity, patch) => window.corona.scene.setModelNodeState(identity, patch),
    setActorIkChains: (sceneName, actor, chains, expectedRevision, scope) => expectedRevision === undefined
      ? window.corona.scene.setActorIkChains(sceneName, actor, chains, scope)
      : window.corona.scene.setActorIkChains(sceneName, actor, chains, expectedRevision, scope),
    readTransforms: (session, actors) => window.corona.scene.readTransforms({ archive_session: session, actors }),
    setActorTransform: (sceneName, actorName, transform) =>
      window.corona.scene.setActorTransform(sceneName, actorName, transform),
    updateActor: (sceneName, actorName, patch) =>
      window.corona.scene.updateActor(sceneName, actorName, patch),
    deleteActor: (sceneName, actor, scope) =>
      window.corona.scene.deleteActor(sceneName, actor, scope),
    rebindActorResource: (sceneName, actorGuid, path, scope) =>
      window.corona.scene.rebindActorResource(sceneName, actorGuid, path, scope),
    save: (sceneName, scope) => window.corona.scene.save(sceneName, scope),
    focusActor: (sceneName, actorName, cameraId, scope) => window.corona.scene.focusActor(sceneName, actorName, cameraId, scope),
    updateCamera: (sceneName, cameraId, patch) => window.corona.scene.updateCamera(sceneName, cameraId, patch),
    setCameraRenderSettings: (sceneName, cameraId, patch) =>
      window.corona.scene.setCameraRenderSettings(sceneName, cameraId, patch),
    readCameraRenderSettings: (sceneName, cameraId, scope) =>
      window.corona.scene.readCameraRenderSettings(sceneName, cameraId, scope),
    deleteCamera: (sceneName, cameraId, scope) =>
      window.corona.scene.deleteCamera(sceneName, cameraId, scope),
    captureScreenshot: (sceneName, cameraId, options) => window.corona.scene.captureScreenshot(sceneName, cameraId, options),
    getEnvironment: (sceneName, scope) => window.corona.scene.getEnvironment(sceneName, scope),
    setEnvironment: (sceneName, patch) => window.corona.scene.setEnvironment(sceneName, patch),
  },
  window: {
    getCurrent: () => window.corona.window.getCurrent(),
    setDragRegions: regions => window.corona.window.setDragRegions(regions),
    close: () => window.corona.window.close(),
    closeTab: tabId => window.corona.window.closeTab(tabId),
    focusTab: tabId => window.corona.window.focusTab(tabId),
    createPanel: options => window.corona.window.createPanel(options),
    setPanelPlacement: options => window.corona.window.setPanelPlacement(options),
    setWindowPresentation: options => window.corona.window.setWindowPresentation(options),
    suspendCameraViews: sceneId => window.corona.window.suspendCameraViews(sceneId),
    closeCameraView: (sceneId, cameraId) => window.corona.window.closeCameraView(sceneId, cameraId),
    resizeCameraView: (width, height, sceneId, cameraId) =>
      window.corona.window.resizeCameraView(width, height, sceneId, cameraId),
    onClosed: callback => window.corona.window.onClosed(callback),
    onCloseRequested: callback => window.corona.window.onCloseRequested(callback),
    canSuspendCameraViews: () => typeof window.corona?.window?.suspendCameraViews === 'function',
    hasWindowBindings: () => Boolean(window.corona?.window),
  },
  viewport: {
    pick: (sceneName, cameraId, options) => window.corona.viewport.pick(sceneName, cameraId, options),
    configure: (sceneName, cameraId, patch) => window.corona.viewport.configure(sceneName, cameraId, patch),
  },
  gizmo: {
    setTarget: (sceneId, cameraId, options) => window.corona.gizmo.setTarget(sceneId, cameraId, options),
    pointer: (sceneId, cameraId, options) => window.corona.gizmo.pointer(sceneId, cameraId, options),
  },
  input: {
    dispatch: (sceneName, cameraId, event) => window.corona.input.dispatch(sceneName, cameraId, event),
  },
  scripts: {
    // The Python file host owns compilation, revision checks and run state.
    getStatus: () => bridgeCall('FileScripts', 'get_script_status', []),
    runFile: request => bridgeCall('FileScripts', 'run_file', [request]),
    getRun: requestId => bridgeCall('FileScripts', 'get_file_run', [{ requestId }]),
    stop: (runId, restoreState = true, requestId) =>
      bridgeCall('FileScripts', 'stop_file', [{ runId, requestId, restore_state: restoreState }]),
  },
  projectFiles: {
    save: request => bridgeCall('ProjectFiles', 'save', [request]),
    load: request => bridgeCall('ProjectFiles', 'load', [request]),
  },
  projectSettings: {
    // Documents are owned by the Python archive service.
    readProjectDocument: request => bridgeCall('ProjectArchive', 'read_document',
      [{ ...request, revision_only: true }]),
    commitProjectDocument: request => bridgeCall('ProjectArchive', 'commit_document',
      [{ ...request, revision_only: true }]),
    // The projection is composed here from the scene primitive plus archive metadata.
    getActiveProjectInfo: async () => {
      const active = await window.corona.scene.readActive();
      if (active.read_only) {
        return { name: active.name, mode: 'creative', project_path: active.project_path,
          read_only: true, source_path: active.project_path, archive_session: active.archive_session };
      }
      const info = await bridgeCall('ProjectArchive', 'project_info', [{ path: active.project_path }]);
      return { ...info, archive_session: active.archive_session, read_only: false };
    },
    // Saving metadata refreshes the native scene cache, so this route stays in C++.
    saveActiveProjectInfo: settings => window.corona.projectSettings.saveActiveProjectInfo(settings),
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
