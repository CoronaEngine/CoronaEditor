import { createSceneReader } from './sceneReader.js';
// Public editor contracts call named native V8 bindings.

export const sceneReader = createSceneReader(async (method, payload) => {
  return method === 'readActive' ? editorApi.scene.readActive()
    : editorApi.scene.readTransforms(payload.archive_session, payload.actors);
});
if (typeof document !== 'undefined') document.addEventListener?.('visibilitychange', () => sceneReader.visibilityChanged());
if (typeof window !== 'undefined') {
  window.addEventListener?.('pagehide', () => sceneReader.pause());
  window.addEventListener?.('pageshow', () => sceneReader.resume());
}

const editorApiStatic = {
  off: callbackToken => sceneReader.off(callbackToken),
  app: {
    closeProcess: () => window.corona.app.closeProcess(),
  },
  files: {
    getFileTree: request => window.corona.files.getFileTree(request),
    createFolder: request => window.corona.files.createFolder(request),
    createActorTemplate: request => window.corona.files.createActorTemplate(request),
    deleteItem: request => window.corona.files.deleteItem(request),
    renameItem: request => window.corona.files.renameItem(request),
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
    getAppVersion: () => window.corona.project.getAppVersion(),
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
    observe: async (kind, callback) => sceneReader.observe(kind, callback),
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
    getStatus: () => window.corona.scripts.getStatus(),
    runFile: (request) => window.corona.scripts.runFile(request),
    getRun: (requestId) => window.corona.scripts.getRun(requestId),
    stop: (runId, restoreState = true, requestId) =>
      window.corona.scripts.stop(runId, restoreState, requestId),
  },
  projectFiles: {
    save: request => window.corona.projectFiles.save(request),
    load: request => window.corona.projectFiles.load(request),
  },
  projectSettings: {
    readProjectDocument: request => window.corona.projectSettings.readProjectDocument(request),
    commitProjectDocument: request => window.corona.projectSettings.commitProjectDocument(request),
    getActiveProjectInfo: () => window.corona.projectSettings.getActiveProjectInfo(),
    saveActiveProjectInfo: settings => window.corona.projectSettings.saveActiveProjectInfo(settings),
  },

};

export const editorApi = editorApiStatic;

// 快捷访问
// LAN transport belongs to C++ NetworkSystem; Web calls native V8 contracts.
