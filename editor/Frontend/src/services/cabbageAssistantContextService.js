import { effectScope, watch } from 'vue';
import { getWebMessages } from '../api/webMessages.js';
import { cloneWebDto } from '../utils/cloneWebDto.js';
import { getWebDocumentIdentity } from '../api/webDocument.js';
import { worldModeState, editorUiAllowed, normalizeProjectPath } from './worldModeService.js';
import { trackWorldSessionWork } from './worldSessionLifecycle.js';
import { aiService } from '@/services/aiService.js';
import { editorApi } from '../api/editorApi.js';
import { AI_SETTINGS_CHANGED } from './aiSessionService.js';
import { createServiceResponseError } from '@/utils/serviceInitialization.js';

const STORAGE_KEY = 'corona.cabbageAssistantContext.v2';
const CONTEXT_MESSAGE_TYPE = 'cabbage-assistant-context';
const CONTEXT_UPDATE_MESSAGE_TYPE = 'cabbage-assistant-context.update';
const PRE_WARNING_MESSAGE_TYPE = 'cabbage-pre-warning';
const TRANSFORM_DEBOUNCE_MS = 650;
const PROFILE_POLL_MS = 1200;
const GOAL_PLAN_POLL_MS = 1000;
const GOAL_PLAN_TIMEOUT_MS = 60000;

let sceneSavedMessages = null;
let contextOwnerHandlerMessages = null;
let contextOwnerHandlerUnsubscribe = null;
let contextOwnerStorage = null;
let latestSnapshot = null;
let latestSnapshotOwnerEpoch = null;
let latestBackendClock = null;
let writeChain = Promise.resolve();
let activeScoreUpdate = null;
const activeGoalPlanPolls = new Map();
const pendingTransforms = new Map();
const pendingActorEvents = [];

function getMessages() {
  const messages = getWebMessages();
  if (messages.role === 'main' && contextOwnerHandlerMessages !== messages) {
    contextOwnerHandlerUnsubscribe?.();
    contextOwnerHandlerMessages = messages;
    contextOwnerStorage = window.localStorage;
    contextOwnerHandlerUnsubscribe = messages.handle('cabbage-assistant-context.read', ({ projectScopeId = '' } = {}) => {
      return readCabbageAssistantContext(projectScopeId);
    });
    messages.on(CONTEXT_UPDATE_MESSAGE_TYPE, (snapshot) => {
      const normalized = normalizeSnapshot(snapshot);
      if (normalized?.projectScopeId === currentScopeId()) publishSnapshot(normalized, { owner: true });
    });
  }
  if (sceneSavedMessages !== messages) {
    sceneSavedMessages = messages;
    messages.on('cabbage.scene-saved', projectPath => flushActorEvents(projectPath));
  }
  return messages;
}

function clone(value, fallback) {
  try { return cloneWebDto(value); } catch (_) { return fallback; }
}

function currentProjectPath() {
  return String(worldModeState.activeProjectPath || '')
    .trim().replace(/\\/g, '/').replace(/\/+$/, '');
}

function currentWorldId() {
  const path = currentProjectPath();
  if (!path) return '';
  const parts = path.split('/').filter(Boolean);
  return String(parts[parts.length - 1] || '');
}

function currentScopeId() {
  const path = currentProjectPath().toLocaleLowerCase('en-US');
  let hash = 2166136261;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeTask(task) {
  if (!task || typeof task !== 'object') return null;
  const taskKey = String(task.taskKey || task.issueKey || task.code || '').trim();
  if (!taskKey) return null;
  return { ...clone(task, {}), taskKey, issueKey: taskKey };
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const context = value.context && typeof value.context === 'object' ? value.context : value;
  const activeTasks = (Array.isArray(context.activeTasks) ? context.activeTasks : []).map(normalizeTask).filter(Boolean);
  const taskHistory = (Array.isArray(context.taskHistory) ? context.taskHistory : []).map(normalizeTask).filter(Boolean);
  const selectedTaskKey = String(value.selectedTaskKey || context.selectedTaskKey || '');
  return {
    schemaVersion: Number(context.schemaVersion) || 2,
    worldId: String(context.worldId || ''),
    projectScopeId: String(value.projectScopeId || context.projectScopeId || currentScopeId()),
    graphRevision: String(value.graphRevision || context.graphRevision || ''),
    graphExcerpt: clone(value.graphExcerpt || context.graphExcerpt || {}, {}),
    projectContext: clone(value.projectContext || context.projectContext || {}, {}),
    profile: clone(context.profile || {}, {}),
    profileHistory: clone(context.profileHistory || [], []),
    issueMemory: clone(context.issueMemory || {}, {}),
    metrics: clone(context.metrics || {}, {}),
    worldGoal: clone(context.worldGoal || {}, {}),
    goalTaskPlan: clone(context.goalTaskPlan || {}, {}),
    goalSignalCounts: clone(context.goalSignalCounts || {}, {}),
    tutorialSession: clone(context.tutorialSession || {}, {}),
    activeTasks,
    taskHistory,
    chatMessages: clone(context.chatMessages || [], []),
    recentOperationEvents: clone(context.recentOperationEvents || [], []),
    selectedTaskKey: [...activeTasks, ...taskHistory].some((task) => task.taskKey === selectedTaskKey)
      ? selectedTaskKey
      : '',
    updatedAt: Number(context.updatedAt || value.updatedAt) || Date.now(),
  };
}

function normalizePreWarningEnvelope(value) {
  if (!value || typeof value !== 'object') return null;
  const warning = clone(value.warning && typeof value.warning === 'object' ? value.warning : value, {});
  const code = String(warning.code || '').trim();
  const graphRevision = String(warning.graphRevision || '').trim();
  if (!code || !graphRevision) return null;
  return {
    projectScopeId: String(value.projectScopeId || warning.projectScopeId || currentScopeId()),
    worldId: String(value.worldId || warning.worldId || currentWorldId()),
    publishedAt: Number(value.publishedAt) || Date.now(),
    warning: {
      ...warning,
      code,
      graphRevision,
    },
  };
}

function publishSnapshot(snapshot, { owner = false } = {}) {
  const normalized = normalizeSnapshot(snapshot);
  if (!normalized) return null;
  const messages = getMessages();
  latestSnapshot = normalized;
  latestSnapshotOwnerEpoch = messages.ownerEpoch;
  if (messages.role !== 'main' && !owner) {
    void messages.emit(CONTEXT_MESSAGE_TYPE, normalized).catch(error => console.warn('[CabbageContext]', error.message));
    void messages.emit(CONTEXT_UPDATE_MESSAGE_TYPE, normalized, { target: 'main' })
      .catch(error => console.warn('[CabbageContext]', error.message));
    return normalized;
  }
  try { contextOwnerStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch (_) {}
  void messages.emit(CONTEXT_MESSAGE_TYPE, normalized).catch(error => console.warn('[CabbageContext]', error.message));
  return normalized;
}

function enqueue(operation) {
  const run = () => Promise.resolve().then(operation);
  const pending = writeChain.then(run, run);
  writeChain = pending.catch((error) => {
    console.warn('[CabbageContext]', error?.message || error);
  });
  return pending;
}

function responseContext(response) {
  if (response?.success === true && response?.context) return response.context;
  return null;
}

function publishBackendContext(context) {
  const scope = currentScopeId();
  const ownerEpoch = getMessages().ownerEpoch;
  const revision = worldModeState.revision;
  const current = readCabbageAssistantContext(scope);
  const backendUpdatedAt = Number(context?.updatedAt) || 0;
  if (latestBackendClock?.scope === scope && latestBackendClock.ownerEpoch === ownerEpoch
    && latestBackendClock.revision === revision
    && backendUpdatedAt < latestBackendClock.updatedAt) return current;
  latestBackendClock = { scope, ownerEpoch, revision, updatedAt: backendUpdatedAt };
  return publishSnapshot({
    // A successful scoped backend read is a new activity snapshot even when
    // the persisted document has not changed since an earlier application run.
    context: { ...context, updatedAt: Math.max(Date.now(), backendUpdatedAt,
      (Number(current?.updatedAt) || 0) + 1) },
    projectScopeId: scope,
    graphRevision: current?.graphRevision || '',
    graphExcerpt: current?.graphExcerpt || {},
    projectContext: current?.projectContext || {},
    selectedTaskKey: current?.selectedTaskKey || '',
  });
}

function transformKey(event) {
  const details = event?.details || {};
  return [event.type, details.sceneName || '', details.actorName || details.actor || ''].join(':');
}

async function sendEvent(event) {
  const isCurrent = () => editorUiAllowed() && event.projectRevision === worldModeState.revision
    && normalizeProjectPath(event.projectPath) === normalizeProjectPath(worldModeState.activeProjectPath);
  if (!isCurrent()) return null;
  const response = await aiService.recordCabbageEvent({
    ...event,
    worldId: String(event?.worldId || latestSnapshot?.worldId || ''),
    timestamp: Number(event?.timestamp) || Date.now(),
  });
  if (!isCurrent()) return response;
  const context = responseContext(response);
  if (context) publishBackendContext(context);
  if (response?.success === true && (
    Array.isArray(response.completedTaskKeys) && response.completedTaskKeys.length
    || ['run_started', 'run_succeeded', 'run_failed', 'node_issue_found', 'node_issue_fixed'].includes(event?.type)
  )) {
    void requestProfileScoreUpdate().catch(() => {});
  }
  return response;
}

export function createCabbageAssistantContext(source = {}) {
  return normalizeSnapshot({
    ...source,
    activeTasks: source.activeTasks || source.tasks,
    chatMessages: source.chatMessages || source.messages,
    updatedAt: Date.now(),
  });
}

export function publishCabbageAssistantContext(source = {}) {
  return publishSnapshot(createCabbageAssistantContext(source));
}

function sameSerializableValue(left, right) {
  try { return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {}); } catch (_) { return false; }
}

export function publishCabbageProjectContext(projectContext = {}, projectScopeId = '') {
  const scope = String(projectScopeId || currentScopeId());
  const current = readCabbageAssistantContext(scope);
  // A secondary CEF page (for example the node window) must never create a
  // task-less assistant snapshot before the main page has loaded the world context.
  if (!current) return null;

  const nextProjectContext = clone(projectContext, {});
  if (sameSerializableValue(current.projectContext, nextProjectContext)) return current;

  return publishSnapshot({
    ...current,
    projectScopeId: scope,
    projectContext: nextProjectContext,
    updatedAt: Math.max(Date.now(), Number(current.updatedAt || 0) + 1),
  });
}

export function readCabbageAssistantContext(projectScopeId = '') {
  const expectedScope = String(projectScopeId || '');
  const messages = getMessages();
  let snapshot = latestSnapshotOwnerEpoch === messages.ownerEpoch ? latestSnapshot : null;
  if (messages.role === 'main' && (!snapshot || (expectedScope && snapshot.projectScopeId !== expectedScope))) {
    try { snapshot = normalizeSnapshot(JSON.parse(contextOwnerStorage?.getItem(STORAGE_KEY) || 'null')); } catch (_) { snapshot = null; }
  }
  if (!snapshot) return null;
  if (expectedScope && snapshot.projectScopeId !== expectedScope) return null;
  return clone(snapshot, null);
}

async function requestCabbageAssistantContext(projectScopeId = '') {
  const expectedScope = String(projectScopeId || '');
  if (getMessages().role === 'main') return readCabbageAssistantContext(expectedScope);
  try {
    const snapshot = await getMessages().request('main', 'cabbage-assistant-context.read', {
      projectScopeId: expectedScope,
    }, { waitForHandler: true });
    return normalizeSnapshot(snapshot);
  } catch (_) {
    return null;
  }
}

export async function loadCurrentWorld() {
  cancelPendingTransformEvents();
  const expectedWorldId = currentWorldId();
  const expectedPath=currentProjectPath(),revision=worldModeState.revision;
  const isCurrent = () => revision === worldModeState.revision && expectedPath === currentProjectPath();
  let response;
  try {
    response = await aiService.loadCabbageContext({ worldId: expectedWorldId,projectPath:expectedPath,projectRevision:revision });
  } catch (error) {
    if (!isCurrent()) return null;
    throw error;
  }
  if (!isCurrent()) return null;
  if (response?.success !== true || !response?.context) {
    throw createServiceResponseError(response, '加载当前世界的包菜上下文失败');
  }
  const loadedWorldId = String(response.context.worldId || '');
  if (expectedWorldId && loadedWorldId !== expectedWorldId) {
    throw new Error(`后端返回了其他世界的上下文（${loadedWorldId || '未知'}），已拒绝加载`);
  }
  return publishBackendContext(response.context);
}

function goalPlanError(response, fallback) {
  const result = response?.result;
  return new Error(
    result?.message || response?.message || fallback || '生成当前世界的专属任务失败',
  );
}

async function pollGoalPlan(taskId, expectedScopeId, revision) {
  const deadline = Date.now() + GOAL_PLAN_TIMEOUT_MS;
  const isCurrent = () => revision === worldModeState.revision && editorUiAllowed()
    && currentScopeId() === expectedScopeId;
  try {
    while (Date.now() < deadline) {
      if (!isCurrent()) return null;
      const response = await aiService.getCabbageGoalPlanStatus(taskId);
      if (!isCurrent()) return null;
      if (response?.success !== true) throw goalPlanError(response);
      if (response.status === 'completed') {
        const result = response.result || {};
        if (result?.success !== true || !result?.context) throw goalPlanError(response);
        publishBackendContext(result.context);
        return readCabbageAssistantContext(expectedScopeId);
      }
      await new Promise((resolve) => window.setTimeout(resolve, GOAL_PLAN_POLL_MS));
    }
    if (!isCurrent()) return null;
    throw new Error('生成当前世界的专属任务超时，请进入世界后稍后重试');
  } catch (error) {
    if (!isCurrent()) return null;
    throw error;
  }
}

function trackGoalPlan(taskId, expectedScopeId, revision) {
  const key = `${revision}:${taskId}:${expectedScopeId}`;
  const existing = activeGoalPlanPolls.get(key);
  if (existing) return existing;
  const pending = pollGoalPlan(taskId, expectedScopeId, revision).finally(() => {
    if (activeGoalPlanPolls.get(key) === pending) activeGoalPlanPolls.delete(key);
  });
  activeGoalPlanPolls.set(key, pending);
  return pending;
}

export function initializeWorldTasks(options = {}) {
  if (!editorUiAllowed()) return Promise.resolve(null);
  return trackWorldSessionWork(initializeWorldTasksNow(options));
}

async function initializeWorldTasksNow({ prompt = '', waitForCompletion = true } = {}) {
  const expectedScopeId = currentScopeId();
  const revision = worldModeState.revision;
  const isCurrent = () => revision === worldModeState.revision && editorUiAllowed()
    && currentScopeId() === expectedScopeId;
  let response;
  try {
    response = await aiService.startCabbageGoalPlan({
      worldId: currentWorldId(),
      prompt: String(prompt || '').trim(),
      mode: 'creative',
    });
  } catch (error) {
    if (!isCurrent()) return null;
    throw error;
  }
  if (!isCurrent()) return null;
  if (response?.success !== true) throw goalPlanError(response);
  if (response.status === 'completed' && response.context) {
    return currentScopeId() === expectedScopeId ? publishBackendContext(response.context) : null;
  }
  const taskId = String(response.taskId || '');
  if (!taskId) throw new Error('世界任务生成请求没有返回任务编号');
  if (!waitForCompletion) {
    void trackGoalPlan(taskId, expectedScopeId, revision).catch((error) => {
      if (isCurrent()) console.warn('[CabbageContext] 世界专属任务后台生成失败：', error?.message || error);
    });
    return { success: true, status: 'pending', taskId };
  }
  return trackGoalPlan(taskId, expectedScopeId, revision);
}

function flushActorEvents(projectPath) {
  if (projectPath.toLowerCase() !== currentProjectPath().toLowerCase()) return;
  const events = pendingActorEvents.splice(0).filter(event =>
    event.projectPath === currentProjectPath() && event.projectRevision === worldModeState.revision);
  for (const event of events) enqueue(() => sendEvent(event));
}

function notifySceneSaved(filepath) {
  if (!filepath) return;
  const projectPath = filepath.replaceAll('\\', '/').replace(/\/[^/]+$/, '');
  void getMessages().emit('cabbage.scene-saved', projectPath).catch(error => console.warn('[CabbageContext]', error.message));
}

export function recordEvent(event = {}, { onSceneSave = false } = {}) {
  const normalized = { ...clone(event, {}),projectPath:currentProjectPath(),projectRevision:worldModeState.revision, timestamp: Number(event.timestamp) || Date.now() };
  if (onSceneSave) {
    // Actor edits and trial runs must not modify the project's assistant document.
    getMessages();
    pendingActorEvents.push(normalized);
    if (pendingActorEvents.length > 200) pendingActorEvents.shift();
    return Promise.resolve({ success: true, status: 'queued' });
  }
  if (['transform_position', 'transform_rotation', 'transform_scale'].includes(normalized.type)) {
    const key = transformKey(normalized);
    const previous = pendingTransforms.get(key);
    if (previous?.timer) window.clearTimeout(previous.timer);
    const entry = {
      event: normalized,
      timer: window.setTimeout(() => {
        pendingTransforms.delete(key);
        enqueue(() => sendEvent(entry.event));
      }, TRANSFORM_DEBOUNCE_MS),
    };
    pendingTransforms.set(key, entry);
    return Promise.resolve({ success: true, status: 'queued' });
  }
  return enqueue(() => sendEvent(normalized));
}

export function updateTask(payload = {}) {
  payload={...payload,projectPath:currentProjectPath(),projectRevision:worldModeState.revision};
  return enqueue(async () => {
    const response = await aiService.updateCabbageTask({
      ...payload,
      worldId: String(payload?.worldId || latestSnapshot?.worldId || ''),
    });
    const context = responseContext(response);
    if (context && payload.projectPath===currentProjectPath() && payload.projectRevision===worldModeState.revision) publishBackendContext(context);
    return response;
  });
}

export function appendMessage(message = {}) {
  message={...message,projectPath:currentProjectPath(),projectRevision:worldModeState.revision};
  return enqueue(async () => {
    const response = await aiService.appendCabbageMessage({
      ...message,
      worldId: String(message?.worldId || latestSnapshot?.worldId || ''),
    });
    const context = responseContext(response);
    if (context && message.projectPath===currentProjectPath() && message.projectRevision===worldModeState.revision) publishBackendContext(context);
    return response;
  });
}

function scoreUpdateIsCurrent(operation) {
  return activeScoreUpdate === operation && editorUiAllowed()
    && operation.revision === worldModeState.revision
    && operation.projectPath === normalizeProjectPath(worldModeState.activeProjectPath);
}

function retireScoreUpdate(operation) {
  if (activeScoreUpdate === operation) activeScoreUpdate = null;
  operation.lifetime.stop();
  operation.cancelWait?.();
}

function publishScoreProfile(operation, profile) {
  if (!scoreUpdateIsCurrent(operation)) return;
  const snapshot = readCabbageAssistantContext(operation.scope) || {};
  publishSnapshot({ ...snapshot, projectScopeId: operation.scope, profile, updatedAt: Date.now() });
}

async function pollScoreUpdate(operation) {
  try {
    while (scoreUpdateIsCurrent(operation)) {
      const response = await aiService.getCabbageProfileScoreStatus(operation.taskId);
      if (!scoreUpdateIsCurrent(operation) || response?.success !== true) return;
      if (response.status === 'completed') {
        if (response.result?.success === true && response.result.profile) {
          publishScoreProfile(operation, response.result.profile);
        }
        return;
      }
      await new Promise((resolve) => {
        const timerWindow = window;
        const timer = timerWindow.setTimeout(() => {
          operation.cancelWait = null;
          resolve();
        }, PROFILE_POLL_MS);
        operation.cancelWait = () => {
          timerWindow.clearTimeout(timer);
          operation.cancelWait = null;
          resolve();
        };
      });
    }
  } catch (error) {
    if (scoreUpdateIsCurrent(operation)) {
      console.warn('[CabbageContext] profile score update failed', error?.message || error);
    }
  } finally {
    retireScoreUpdate(operation);
  }
}

export async function requestProfileScoreUpdate(options = {}) {
  if (!editorUiAllowed()) return null;
  if (activeScoreUpdate && !scoreUpdateIsCurrent(activeScoreUpdate)) retireScoreUpdate(activeScoreUpdate);
  if (activeScoreUpdate) {
    return activeScoreUpdate.taskId
      ? { success: true, status: 'pending', taskId: activeScoreUpdate.taskId }
      : activeScoreUpdate.start;
  }
  // Identity belongs to this world operation, even if the backend reuses a task id.
  const operation = { scope: currentScopeId(), revision: worldModeState.revision,
    projectPath: normalizeProjectPath(worldModeState.activeProjectPath), taskId: '', lifetime: effectScope(true) };
  activeScoreUpdate = operation;
  // A route unmount must not remove the world service's retirement guard.
  operation.lifetime.run(() => watch(
    () => [worldModeState.revision, normalizeProjectPath(worldModeState.activeProjectPath), editorUiAllowed()],
    () => { if (!scoreUpdateIsCurrent(operation)) retireScoreUpdate(operation); },
    { flush: 'sync' },
  ));
  operation.start = (async () => {
    try {
      const response = await aiService.startCabbageProfileScoreUpdate(options);
      if (!scoreUpdateIsCurrent(operation)) return null;
      if (response?.status === 'skipped' && response.profile) {
        publishScoreProfile(operation, response.profile);
      } else if (response?.success === true && response.taskId) {
        operation.taskId = String(response.taskId);
        void pollScoreUpdate(operation);
      }
      return response;
    } catch (error) {
      if (scoreUpdateIsCurrent(operation)) throw error;
      return null;
    } finally {
      if (!operation.taskId) retireScoreUpdate(operation);
    }
  })();
  return operation.start;
}

export function subscribeCabbageAssistantContext(listener, { projectScopeId = '', emitCurrent = true } = {}) {
  let disposed = false;
  let latestUpdatedAt = 0;
  let latestProjectScopeId = null;
  let latestOwnerEpoch = null;
  const messages = getMessages();
  const getExpectedScope = () => String(typeof projectScopeId === 'function' ? projectScopeId() : projectScopeId || '');
  const accept = (value) => {
    if (disposed) return;
    const snapshot = normalizeSnapshot(value);
    if (!snapshot) return;
    const expected = getExpectedScope();
    if (expected && snapshot.projectScopeId !== expected) return;
    if (snapshot.projectScopeId === latestProjectScopeId && messages.ownerEpoch === latestOwnerEpoch
      && snapshot.updatedAt < latestUpdatedAt) return;
    latestProjectScopeId = snapshot.projectScopeId;
    latestOwnerEpoch = messages.ownerEpoch;
    latestUpdatedAt = snapshot.updatedAt;
    latestSnapshot = snapshot;
    latestSnapshotOwnerEpoch = latestOwnerEpoch;
    listener(clone(snapshot, snapshot), { ownerEpoch: latestOwnerEpoch });
  };
  const unsubscribe = messages.on(CONTEXT_MESSAGE_TYPE, accept);
  if (emitCurrent) {
    const current = readCabbageAssistantContext(getExpectedScope());
    if (current) accept(current);
    else if (getMessages().role !== 'main') {
      void requestCabbageAssistantContext(getExpectedScope()).then(accept);
    }
  }
  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
  };
}

// Repeated-issue warnings are intentionally transient. They travel between the
// node graph window and the main task board, but are never written to localStorage
// or the world's CabbageAssistant/context.json.
export function publishCabbagePreWarning(warning = {}) {
  const envelope = normalizePreWarningEnvelope(warning);
  if (!envelope) return null;
  void getMessages().emit(PRE_WARNING_MESSAGE_TYPE, envelope).catch(error => console.warn('[CabbageContext]', error.message));
  return clone(envelope.warning, envelope.warning);
}

export function subscribeCabbagePreWarnings(listener, { projectScopeId = '', worldId = '' } = {}) {
  const getExpectedScope = () => String(typeof projectScopeId === 'function' ? projectScopeId() : projectScopeId || '');
  const getExpectedWorld = () => String(typeof worldId === 'function' ? worldId() : worldId || '');
  const accept = (value) => {
    const envelope = normalizePreWarningEnvelope(value);
    if (!envelope) return;
    const expectedScope = getExpectedScope();
    const expectedWorld = getExpectedWorld();
    if (expectedScope && envelope.projectScopeId !== expectedScope) return;
    if (expectedWorld && envelope.worldId && envelope.worldId !== expectedWorld) return;
    listener(clone(envelope.warning, envelope.warning), clone(envelope, envelope));
  };
  return getMessages().on(PRE_WARNING_MESSAGE_TYPE, accept);
}

export function cancelPendingTransformEvents() {
  for (const entry of pendingTransforms.values()) {
    if (entry.timer) window.clearTimeout(entry.timer);
  }
  pendingTransforms.clear();
}

export async function flush() {
  const entries = Array.from(pendingTransforms.values());
  pendingTransforms.clear();
  for (const entry of entries) {
    if (entry.timer) window.clearTimeout(entry.timer);
    enqueue(() => sendEvent(entry.event));
  }
  await writeChain;
}

export const cabbageContextService = {
  loadCurrentWorld,
  initializeWorldTasks,
  recordEvent,
  notifySceneSaved,
  updateTask,
  appendMessage,
  requestProfileScoreUpdate,
  publishPreWarning: publishCabbagePreWarning,
  subscribePreWarnings: subscribeCabbagePreWarnings,
  flush,
};

// Configuring a session key after entering a world retries an earlier unconfigured plan.
window.addEventListener(AI_SETTINGS_CHANGED,()=>{
  if(!editorUiAllowed())return;
  if(getWebDocumentIdentity().role !== 'main')return;
  const revision=worldModeState.revision;
  void editorApi.projectSettings.getActiveProjectInfo().then(response=>{
    if(revision!==worldModeState.revision||!editorUiAllowed())return;
    const info=response;
    const prompt=String(info?.world_prompt||info?.prompt||'').trim();
    if(prompt)return initializeWorldTasks({prompt,mode:info.mode||'creative',waitForCompletion:false});
  }).catch(error=>console.warn('[CabbageContext] session planning retry failed',error?.message||error));
});
