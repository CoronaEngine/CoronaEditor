import { createSceneReader } from './sceneReader.js';
/**
 * Public editor contracts over native V8 bindings.
 * Manifest-backed methods share the typed editor.invoke entry point.
 */

let editorApiMethodSpecs = null;
let editorApiMethodSpecsByWrapper = null;
let editorApiManifestPromise = null;
let editorApiEventSpecs = null;
let editorApiEventSpecsByWrapper = null;
let editorApiEventManifestPromise = null;
const EDITOR_API_CALLER_CEF = 1;
// Default caller for the manifest-backed resource-search namespace.
const CURRENT_CALLER = 'SceneBar';
// Native pickers wait for a user decision, which has no RPC execution deadline.
const INTERACTIVE_FILE_PICKER_APIS = new Set([
  'ProjectLauncher.open_project_file',
  'ProjectLauncher.browse_folder',
]);

// How long a non-interactive manifest-backed request waits for a native reply before failing.
// Exposed so an embedding host can tune it without reaching into module internals; native CEF
// calls have no built-in deadline, so an unanswered non-interactive request would hang forever.
async function scopedAssetPayload(payload = {}) {
  if (payload?.archive_session) return payload;
  const state = await editorApi.scene.readActive();
  if (!state?.archive_session || state.read_only) throw new Error('没有可写的活动项目');
  return { ...payload, archive_session: state.archive_session };
}

async function callProjectAssetOperation(wrapper, payload = {}, args = []) {
  return call_manifest_editor_api(wrapper, [...args, await scopedAssetPayload(payload)]);
}

async function callProjectFileMutation(wrapper, args, scope) {
  if (scope && !scope.archive_session) throw new Error('项目会话已失效');
  return callProjectAssetOperation(wrapper, scope, args);
}

export const editorApiTransportLimits = {
  responseTimeoutMs: 30_000,
};

export class Bridge {
  // Wrapper-path lookup used to be a linear scan over every manifest entry on each call.
  // Index it once per manifest load instead. First entry wins, matching the scan's order.
  static indexWrappersByName(specs, key) {
    const byWrapper = new Map();
    for (const spec of specs.values()) {
      const wrapperPath = spec?.[key];
      if (typeof wrapperPath === 'string' && !byWrapper.has(wrapperPath)) {
        byWrapper.set(wrapperPath, spec);
      }
    }
    return byWrapper;
  }

  static async ensureEditorApiManifest() {
    if (!editorApiMethodSpecs) {
      if (!editorApiManifestPromise) {
        editorApiManifestPromise = call_editor_api('EditorApi.list_methods', [])
          .then((response) => {
            const methods = response?.data?.methods ?? response?.methods ?? [];
            editorApiMethodSpecs = new Map(
              methods
                .filter((method) => typeof method?.api === 'string')
                .map((method) => [method.api, method]),
            );
            editorApiMethodSpecsByWrapper = Bridge.indexWrappersByName(
              editorApiMethodSpecs,
              'js_wrapper',
            );
            Bridge.validateEditorApiWrapperMethods();
            return editorApiMethodSpecs;
          })
          .finally(() => {
            editorApiManifestPromise = null;
          });
      }
      await editorApiManifestPromise;
    }
    return editorApiMethodSpecs;
  }

  static async ensureEditorApiMethod(apiName) {
    if (apiName === 'EditorApi.list_methods') {
      return null;
    }
    await Bridge.ensureEditorApiManifest();
    const spec = editorApiMethodSpecs?.get(apiName);
    if (!spec) {
      throw new Error(`Editor API method is not defined by C++ manifest: ${apiName}`);
    }
    return spec;
  }

  static editorApiValueMatchesType(value, type) {
    if (type === 'any') return true;
    if (type === 'null') return value === null;
    if (type === 'boolean') return typeof value === 'boolean';
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'string') return typeof value === 'string';
    if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (type === 'array') return Array.isArray(value);
    return false;
  }

  static resolveEditorApiWrapperPath(wrapperPath) {
    if (!wrapperPath || typeof wrapperPath !== 'string') return null;
    return wrapperPath
      .split('.')
      .reduce((current, segment) => (current ? current[segment] : null), editorApi);
  }

  static validateEditorApiWrapperMethods() {
    if (!editorApiMethodSpecs) return;
    const missing = [];
    for (const spec of editorApiMethodSpecs.values()) {
      const wrapperPath = spec?.js_wrapper;
      if (!wrapperPath) continue;
      if (typeof Bridge.resolveEditorApiWrapperPath(wrapperPath) !== 'function') {
        missing.push(`${spec.api} -> ${wrapperPath}`);
      }
    }
    if (missing.length > 0) {
      console.warn(`Frontend wrapper path is not implemented: ${missing.join(', ')}`);
    }
  }

  static validateEditorApiEventWrapperMethods() {
    if (!editorApiEventSpecs) return;
    const missing = [];
    for (const spec of editorApiEventSpecs.values()) {
      const wrapperPath = spec?.js_wrapper;
      if (!wrapperPath) continue;
      if (typeof Bridge.resolveEditorApiWrapperPath(wrapperPath) !== 'function') {
        missing.push(`${spec.event} -> ${wrapperPath}`);
      }
    }
    if (missing.length > 0) {
      console.warn(`Frontend event wrapper path is not implemented: ${missing.join(', ')}`);
    }
  }

  static validateEditorApiWrapperPath(apiName, spec, wrapperPath) {
    if (spec?.js_wrapper && spec.js_wrapper !== wrapperPath) {
      throw new Error(`Frontend wrapper path is not defined by C++ manifest: ${wrapperPath} for ${apiName}`);
    }
  }

  static validateEditorApiCaller(apiName, spec, callerMask, callerName) {
    const allowedCallers = Number(spec?.allowed_callers ?? 0);
    if ((allowedCallers & callerMask) === 0) {
      throw new Error(`Editor API caller is not allowed by C++ manifest: ${callerName} cannot call ${apiName}`);
    }
  }

  static async validateEditorApiArgs(apiName, args) {
    const spec = await Bridge.ensureEditorApiMethod(apiName);
    if (!spec) return null;
    Bridge.validateEditorApiCaller(apiName, spec, EDITOR_API_CALLER_CEF, 'CEF');
    if (!Array.isArray(args)) {
      throw new Error(`Editor API argument schema mismatch for ${apiName}: args must be an array`);
    }
    const params = Array.isArray(spec.params) ? spec.params : [];
    if (args.length > params.length) {
      throw new Error(`Editor API argument schema mismatch for ${apiName}: too many arguments`);
    }
    for (let index = 0; index < params.length; index += 1) {
      const param = params[index] || {};
      const value = args[index];
      if (index >= args.length || value === undefined || value === null) {
        if (param.optional) continue;
        throw new Error(`Editor API argument schema mismatch for ${apiName}: missing ${param.name || index}`);
      }
      if (!Bridge.editorApiValueMatchesType(value, param.type)) {
        throw new Error(`Editor API argument schema mismatch for ${apiName}: ${param.name || index} must be ${param.type}`);
      }
    }
    return spec;
  }

  static validateEditorApiReturn(apiName, data, spec) {
    if (!spec) return;
    const returnType = spec.return || 'any';
    if (!Bridge.editorApiValueMatchesType(data, returnType)) {
      throw new Error(`Editor API return schema mismatch for ${apiName}: data must be ${returnType}`);
    }
  }

  static async ensureEditorApiEventManifest() {
    if (!editorApiEventSpecs) {
      if (!editorApiEventManifestPromise) {
        editorApiEventManifestPromise = call_editor_api('EditorApi.list_events', [])
          .then((response) => {
            const events = response?.data?.events ?? response?.events ?? [];
            editorApiEventSpecs = new Map(
              events
                .filter((event) => typeof event?.event === 'string')
                .map((event) => [event.event, event]),
            );
            editorApiEventSpecsByWrapper = Bridge.indexWrappersByName(
              editorApiEventSpecs,
              'js_wrapper',
            );
            Bridge.validateEditorApiEventWrapperMethods();
            return editorApiEventSpecs;
          })
          .finally(() => {
            editorApiEventManifestPromise = null;
          });
      }
      await editorApiEventManifestPromise;
    }
    return editorApiEventSpecs;
  }

  static async ensureEditorApiEvent(eventName) {
    await Bridge.ensureEditorApiEventManifest();
    const eventSpec = editorApiEventSpecs?.get(eventName);
    if (!eventSpec) {
      throw new Error(`Editor API event is not defined by C++ manifest: ${eventName}`);
    }
    Bridge.validateEditorApiCaller(eventName, eventSpec, EDITOR_API_CALLER_CEF, 'CEF');
    return eventSpec;
  }

  static validateEditorApiEventPayload(eventName, payload, eventSpec) {
    if (!eventSpec) return;
    const payloadType = eventSpec.payload || 'any';
    if (!Bridge.editorApiValueMatchesType(payload, payloadType)) {
      throw new Error(`Editor API event payload schema mismatch for ${eventName}: payload must be ${payloadType}`);
    }
  }
}

const call_editor_api = async (apiName, args) => {
  const normalizedArgs = args || [];
  const spec = await Bridge.validateEditorApiArgs(apiName, normalizedArgs);
  const invoke = Promise.resolve().then(() => window.corona.editor.invoke(apiName, normalizedArgs));
  let timer;
  const response = INTERACTIVE_FILE_PICKER_APIS.has(apiName)
    ? await invoke
    : await Promise.race([
        invoke,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = new Error(
              `Editor API request timed out after ${editorApiTransportLimits.responseTimeoutMs} ms: ` +
                `${apiName} (native execution may still be in progress)`,
            );
            error.code = 'EDITOR_API_TIMEOUT';
            reject(error);
          }, editorApiTransportLimits.responseTimeoutMs);
        }),
      ]).finally(() => clearTimeout(timer));
  Bridge.validateEditorApiReturn(apiName, response?.data, spec);
  return response;
};
const call_typed_editor_api = async (apiName, wrapperPath, args) => {
  const spec = await Bridge.ensureEditorApiMethod(apiName);
  Bridge.validateEditorApiWrapperPath(apiName, spec, wrapperPath);
  return call_editor_api(apiName, args);
};

const register_editor_api_callback = async (eventName, callback) => {
  const eventSpec = await Bridge.ensureEditorApiEvent(eventName);
  const callbackToken = await window.corona.editor.on(eventName, (payload, emittedEvent) => {
    Bridge.validateEditorApiEventPayload(eventName, payload, eventSpec);
    callback(payload, emittedEvent || eventName);
  });
  if (!callbackToken) {
    throw new Error(`Editor API event registration failed: ${eventName}`);
  }
  return callbackToken;
};

const register_typed_editor_api_callback = async (eventName, wrapperName, callback) => {
  const eventSpec = await Bridge.ensureEditorApiEvent(eventName);
  if (eventSpec?.js_wrapper !== wrapperName) {
    throw new Error(`Editor API event wrapper is not defined by C++ manifest: ${wrapperName}`);
  }
  return register_editor_api_callback(eventName, callback);
};

const unregister_callback = (callbackToken) => window.corona.editor.off(callbackToken);

const find_editor_api_method_by_js_wrapper = async (wrapperPath) => {
  await Bridge.ensureEditorApiManifest();
  return editorApiMethodSpecsByWrapper?.get(wrapperPath) ?? null;
};

const find_editor_api_event_by_js_wrapper = async (wrapperPath) => {
  await Bridge.ensureEditorApiEventManifest();
  return editorApiEventSpecsByWrapper?.get(wrapperPath) ?? null;
};

const register_manifest_editor_api_callback = async (wrapperPath, callback) => {
  const eventSpec = await find_editor_api_event_by_js_wrapper(wrapperPath);
  if (!eventSpec?.event) {
    throw new Error(`Editor API event wrapper path is not defined by C++ manifest: ${wrapperPath}`);
  }
  return register_typed_editor_api_callback(eventSpec.event, wrapperPath, callback);
};

const call_manifest_editor_api = async (wrapperPath, args) => {
  const methodSpec = await find_editor_api_method_by_js_wrapper(wrapperPath);
  if (!methodSpec?.api) {
    throw new Error(`Editor API wrapper path is not defined by C++ manifest: ${wrapperPath}`);
  }
  return call_typed_editor_api(methodSpec.api, wrapperPath, args || []);
};

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
  listMethods: () => call_editor_api('EditorApi.list_methods', []),
  listEvents: () => call_editor_api('EditorApi.list_events', []),
  off: async (callbackToken) => callbackToken < 0 ? sceneReader.off(callbackToken) : unregister_callback(callbackToken),
  events: {
    onNetworkActorDeleteSyncBroadcastRequested: (callback) => register_manifest_editor_api_callback('events.onNetworkActorDeleteSyncBroadcastRequested', callback),
    onNetworkActorOwnershipClaimed: (callback) => register_manifest_editor_api_callback('events.onNetworkActorOwnershipClaimed', callback),
    onNetworkActorStateSyncBroadcastRequested: (callback) => register_manifest_editor_api_callback('events.onNetworkActorStateSyncBroadcastRequested', callback),
    onNetworkActorSyncBroadcastRequested: (callback) => register_manifest_editor_api_callback('events.onNetworkActorSyncBroadcastRequested', callback),
    onNetworkActorTransformSyncBroadcastRequested: (callback) => register_manifest_editor_api_callback('events.onNetworkActorTransformSyncBroadcastRequested', callback),
    onNetworkAssetImportCompleted: (callback) => register_manifest_editor_api_callback('events.onNetworkAssetImportCompleted', callback),
    onNetworkFileSyncStatusChanged: (callback) => register_manifest_editor_api_callback('events.onNetworkFileSyncStatusChanged', callback),
    onNetworkSyncPauseRequested: (callback) => register_manifest_editor_api_callback('events.onNetworkSyncPauseRequested', callback),
    onLanChatEvent: (callback) => register_manifest_editor_api_callback('events.onLanChatEvent', callback),
  },
  app: {
    closeProcess: () => call_manifest_editor_api('app.closeProcess', []),
  },
  files: {
    getProjectInfo: () => call_manifest_editor_api('files.getProjectInfo', []),
    getFiles: (relPath = '') => call_manifest_editor_api('files.getFiles', [relPath || '']),
    getFileTree: (relPath = '') => call_manifest_editor_api('files.getFileTree', [relPath || '']),
    createFolder: (path, folderName, scope) =>
      callProjectFileMutation('files.createFolder', [path, folderName], scope),
    createFile: (path, fileName, type, scope) =>
      callProjectFileMutation('files.createFile', [path, fileName, type], scope),
    deleteItem: (path, scope) => callProjectFileMutation('files.deleteItem', [path], scope),
    renameItem: (oldPath, newName, scope) =>
      callProjectFileMutation('files.renameItem', [oldPath, newName], scope),
    openFile: (filePath, fileType) =>
      call_manifest_editor_api('files.openFile', [filePath, fileType]),
  },
  lanChat: {
    startRoom: (payload) => call_manifest_editor_api('lanChat.startRoom', [payload || {}]),
    startLocalRoom: (payload) => call_manifest_editor_api('lanChat.startLocalRoom', [payload || {}]),
    stopRoom: () => call_manifest_editor_api('lanChat.stopRoom', []),
    stopLocalRoom: () => call_manifest_editor_api('lanChat.stopLocalRoom', []),
    joinRoom: (payload) => call_manifest_editor_api('lanChat.joinRoom', [payload || {}]),
    getHistory: () => call_manifest_editor_api('lanChat.getHistory', []),
    listHistoryRooms: () => call_manifest_editor_api('lanChat.listHistoryRooms', []),
    loadHistoryRoom: (room) => call_manifest_editor_api('lanChat.loadHistoryRoom', [{ room }]),
    leaveRoom: () => call_manifest_editor_api('lanChat.leaveRoom', []),
    sendMessage: (text, options = {}) =>
      call_manifest_editor_api('lanChat.sendMessage', [{ text, ...(options || {}) }]),
    sendAgentReply: (payload) =>
      call_manifest_editor_api('lanChat.sendAgentReply', [payload || {}]),
    sendSystemMessage: (payload) =>
      call_manifest_editor_api('lanChat.sendSystemMessage', [payload || {}]),
    sendSystemMessageToHost: (payload) =>
      call_manifest_editor_api('lanChat.sendSystemMessageToHost', [payload || {}]),
    sendSystemMessageToUser: (payload) =>
      call_manifest_editor_api('lanChat.sendSystemMessageToUser', [payload || {}]),
    pollAgentTrigger: () => call_manifest_editor_api('lanChat.pollAgentTrigger', []),
    pollCoordinatorSyncMessage: () =>
      call_manifest_editor_api('lanChat.pollCoordinatorSyncMessage', []),
    pollRoomEvent: () => call_manifest_editor_api('lanChat.pollRoomEvent', []),
    pollSyncEvent: () => call_manifest_editor_api('lanChat.pollSyncEvent', []),
    getLocalIp: () => call_manifest_editor_api('lanChat.getLocalIp', []),
    addAgent: (payload) => call_manifest_editor_api('lanChat.addAgent', [payload || {}]),
    removeAgent: (agentId) => call_manifest_editor_api('lanChat.removeAgent', [{ agent_id: agentId }]),
    listAgents: () => call_manifest_editor_api('lanChat.listAgents', []),
  },
  network: {
    startSession: (instanceName, projectId, port = 27960, role = 'host') =>
      call_manifest_editor_api('network.startSession', [instanceName, projectId, port, role]),
    stopSession: () => call_manifest_editor_api('network.stopSession', []),
    getPeerCount: () => call_manifest_editor_api('network.getPeerCount', []),
    getSessionInfo: () => call_manifest_editor_api('network.getSessionInfo', []),
    getDiscoveredPeers: () => call_manifest_editor_api('network.getDiscoveredPeers', []),
    clearDiscoveredPeers: () => call_manifest_editor_api('network.clearDiscoveredPeers', []),
    searchLan: () => call_manifest_editor_api('network.searchLan', []),
    connectToPeer: (ip, port, peerName) =>
      call_manifest_editor_api('network.connectToPeer', [ip, port, peerName]),
    lockObject: (objectId, userId, operation = 'modify') =>
      call_manifest_editor_api('network.lockObject', [objectId, userId, operation]),
    unlockObject: (objectId, userId) =>
      call_manifest_editor_api('network.unlockObject', [objectId, userId]),
    getLockOwner: (objectId) =>
      call_manifest_editor_api('network.getLockOwner', [objectId]),
    broadcastIntent: (userId, tooltip, position, status = 'placing_object') =>
      call_manifest_editor_api('network.broadcastIntent', [userId, tooltip, position, status]),
    checkPreviewCollision: (userId, position, delta = 0.5) =>
      call_manifest_editor_api('network.checkPreviewCollision', [userId, position, delta]),
    setProjectRoot: (projectRoot) =>
      call_manifest_editor_api('network.setProjectRoot', [projectRoot]),
    broadcastActorCreate: (actorGuid, sceneName, modelPath, actorData) =>
      call_manifest_editor_api('network.broadcastActorCreate', [actorGuid, sceneName, modelPath, actorData]),
    broadcastActorTransform: (actorGuid, sceneName, actorData) =>
      call_manifest_editor_api('network.broadcastActorTransform', [actorGuid, sceneName, actorData]),
    broadcastActorDelete: (actorGuid, sceneName, actorName) =>
      call_manifest_editor_api('network.broadcastActorDelete', [actorGuid, sceneName, actorName]),
    requestSceneSnapshot: (sceneName) =>
      call_manifest_editor_api('network.requestSceneSnapshot', [sceneName]),
    broadcastSceneSnapshot: (sceneName, snapshot) =>
      call_manifest_editor_api('network.broadcastSceneSnapshot', [sceneName, snapshot]),
    broadcastActorStateUpdate: (actorGuid, sceneName, actorData) =>
      call_manifest_editor_api('network.broadcastActorStateUpdate', [actorGuid, sceneName, actorData]),
    pollPendingActorCreate: () => call_manifest_editor_api('network.pollPendingActorCreate', []),
    pollPendingActorTransform: () => call_manifest_editor_api('network.pollPendingActorTransform', []),
    pollPendingActorDelete: () => call_manifest_editor_api('network.pollPendingActorDelete', []),
    pollPendingSceneSnapshotRequest: () =>
      call_manifest_editor_api('network.pollPendingSceneSnapshotRequest', []),
    pollPendingSceneSnapshot: () => call_manifest_editor_api('network.pollPendingSceneSnapshot', []),
    pollPendingActorStateUpdate: () => call_manifest_editor_api('network.pollPendingActorStateUpdate', []),
    setSyncPaused: (paused) => call_manifest_editor_api('network.setSyncPaused', [!!paused]),
    registerActorIdentity: (actorGuid, actorHandle, locallyOwned = true) =>
      call_manifest_editor_api('network.registerActorIdentity', [actorGuid, String(actorHandle || ''), !!locallyOwned]),
    claimActorOwnership: (actorGuid) =>
      call_manifest_editor_api('network.claimActorOwnership', [actorGuid]),
  },
  project: {
    browseFolder: (defaultPath = '') =>
      call_manifest_editor_api('project.browseFolder', defaultPath ? [defaultPath] : []),
    createMultiplayerProject: (projectData) =>
      call_manifest_editor_api('project.createMultiplayerProject', [projectData || {}]),
    createProject: (projectData) =>
      call_manifest_editor_api('project.createProject', [projectData || {}]),
    createWorldProject: (worldData) =>
      call_manifest_editor_api('project.createWorldProject', [worldData || {}]),
    validatePortableScene: (payload) =>
      call_manifest_editor_api('project.validatePortableScene', [payload || {}]),
    importPortableAsset: (payload) =>
      callProjectAssetOperation('project.importPortableAsset', payload),
    cleanupPortableSceneAssets: (payload) =>
      callProjectAssetOperation('project.cleanupPortableSceneAssets', payload),
    getAppVersion: () => call_manifest_editor_api('project.getAppVersion', []),
    getDefaultProjectPath: () => call_manifest_editor_api('project.getDefaultProjectPath', []),
    getProjectLoadStatus: () => call_manifest_editor_api('project.getProjectLoadStatus', []),
    getRecentProjects: () => call_manifest_editor_api('project.getRecentProjects', []),
    openProject: (projectPath, options = {}) =>
      call_manifest_editor_api('project.openProject', [projectPath, options]),
    openProjectFile: () => call_manifest_editor_api('project.openProjectFile', []),
  },
  audio: {
    playResource: (resourceId, loop = false) => window.corona.audio.playResource(resourceId, loop),
    stopResource: (resourceId) => window.corona.audio.stopResource(resourceId),
    playActor: (sceneName, actor, scope, loop = false) =>
      window.corona.audio.playActor(sceneName, actor, { ...(scope || {}), loop }),
    stopActor: (sceneName, actor, scope) => window.corona.audio.stopActor(sceneName, actor, scope),
  },
  scene: {
    selectActor: (sceneName, actorType, actorName, context = null) =>
      context ? window.corona.scene.selectActor(sceneName, actorType, actorName, context)
        : window.corona.scene.selectActor(sceneName, actorType, actorName),
    createCamera: (sceneName, options) => window.corona.scene.createCamera(sceneName, options),
    isVisionAvailable: () => window.corona.scene.isVisionAvailable(),
    observe: async (kind, callback) => sceneReader.observe(kind, callback),
    readTree: (sceneName, scope) => window.corona.scene.readTree(sceneName, scope),
    readActorTree: (sceneName, scope) => window.corona.scene.readActorTree(sceneName, scope),
    readCameras: (sceneName, scope) => window.corona.scene.readCameras(sceneName, scope),
    readActive: () => window.corona.scene.readActive(),
    readActorIndex: (sceneName, scope) => window.corona.scene.readActorIndex(sceneName, scope),
    selectModelFile: (sceneName, fileType = 'model', scope) =>
      window.corona.scene.selectModelFile(sceneName, { ...(scope || {}), file_type: fileType }),
    createActor: (sceneName, path, options) => window.corona.scene.createActor(sceneName, path, options),
    importResourceFile: (sceneName, fileType = 'model', scope) =>
      window.corona.scene.importResourceFile(sceneName, { ...(scope || {}), file_type: fileType }),
    readActorProperties: (sceneName, actor, scope) => window.corona.scene.readActorProperties(sceneName, actor, scope),
    readActorSkeleton: (sceneName, actor, scope) => window.corona.scene.readActorSkeleton(sceneName, actor, scope),
    readActorIkChains: (sceneName, actor, scope) => window.corona.scene.readActorIkChains(sceneName, actor, scope),
    readModelNodes: (sceneName, options) => window.corona.scene.readModelNodes(sceneName, options),
    setModelNodeState: (identity, patch) => window.corona.scene.setModelNodeState(identity, patch),
    setActorIkChains: (sceneName, actor, chains, expectedRevision, scope) => expectedRevision === undefined
      ? window.corona.scene.setActorIkChains(sceneName, actor, chains, scope)
      : window.corona.scene.setActorIkChains(sceneName, actor, chains, expectedRevision, scope),
    readTransforms: (session, actors) => window.corona.scene.readTransforms({ archive_session: session, actors }),
    setActorTransform: (sceneName, actorName, transform) =>
      window.corona.scene.setActorTransform(sceneName, actorName, transform),
    setActorProperties: (sceneName, actorName, patch) =>
      window.corona.scene.setActorProperties(sceneName, actorName, patch),
    renameActor: (sceneName, actor, name, scope) =>
      window.corona.scene.renameActor(sceneName, actor, name, scope),
    deleteActor: (sceneName, actor, scope) =>
      window.corona.scene.deleteActor(sceneName, actor, scope),
    rebindActorResource: (sceneName, actorGuid, path, scope) =>
      window.corona.scene.rebindActorResource(sceneName, actorGuid, path, scope),
    save: (sceneName, scope) => window.corona.scene.save(sceneName, scope),
    focusActor: (sceneName, actorName, cameraId, scope) => window.corona.scene.focusActor(sceneName, actorName, cameraId, scope),
    setCameraProperties: (sceneName, cameraId, patch) => window.corona.scene.setCameraProperties(sceneName, cameraId, patch),
    setCameraRenderSettings: (sceneName, cameraId, patch) =>
      window.corona.scene.setCameraRenderSettings(sceneName, cameraId, patch),
    readCameraRenderSettings: (sceneName, cameraId, scope) =>
      window.corona.scene.readCameraRenderSettings(sceneName, cameraId, scope),
    renameCamera: (sceneName, cameraId, name, scope) =>
      window.corona.scene.renameCamera(sceneName, cameraId, name, scope),
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
    getStatus: () => call_manifest_editor_api('scripts.getStatus', []),
    runFile: (request) => call_manifest_editor_api('scripts.runFile', [request]),
    getRun: (requestId) => call_manifest_editor_api('scripts.getRun', [{ requestId }]),
    stop: (runId, restoreState = true, requestId) =>
      call_manifest_editor_api('scripts.stop', [{ runId, requestId, restore_state: restoreState }]),
  },
  projectFiles: {
    save: request => call_manifest_editor_api('projectFiles.save', [request]),
    load: request => call_manifest_editor_api('projectFiles.load', [request]),
  },
  projectSettings: {
    readProjectDocument: (request) => call_manifest_editor_api('projectSettings.readProjectDocument', [request]),
    commitProjectDocument: (request) => call_manifest_editor_api('projectSettings.commitProjectDocument', [request]),
    getActiveProjectInfo: () => call_manifest_editor_api('projectSettings.getActiveProjectInfo', []),
    saveActiveProjectInfo: (settings) =>
      call_manifest_editor_api('projectSettings.saveActiveProjectInfo', [settings || {}]),
  },
  resourceSearch: {
    prepareIndex: (caller = CURRENT_CALLER) =>
      call_manifest_editor_api('resourceSearch.prepareIndex', [caller]),
    fuzzySearch: (query, topK = 20, typeFilter = null, caller = CURRENT_CALLER) =>
      call_manifest_editor_api('resourceSearch.fuzzySearch', [query, topK, typeFilter, caller]),
    imageSearch: (imageB64, topK = 20, threshold = 10, caller = CURRENT_CALLER) =>
      call_manifest_editor_api('resourceSearch.imageSearch', [imageB64, topK, threshold, caller]),
    listTypes: (caller = CURRENT_CALLER) =>
      call_manifest_editor_api('resourceSearch.listTypes', [caller]),
    rebuildIndex: (caller = CURRENT_CALLER) =>
      call_manifest_editor_api('resourceSearch.rebuildIndex', [caller]),
    getStats: (caller = CURRENT_CALLER) =>
      call_manifest_editor_api('resourceSearch.getStats', [caller]),
    markIndexDirty: (reason = 'frontend', caller = CURRENT_CALLER) =>
      call_manifest_editor_api('resourceSearch.markIndexDirty', [reason, caller]),
  },
};

export const editorApi = editorApiStatic;

// 快捷访问
// LAN transport belongs to C++ NetworkSystem; Web calls native V8 contracts.
// LANChat 主事件由 C++ Editor API registry 定义为 LANChat.event。

// End of manifest-backed editor API definitions.
