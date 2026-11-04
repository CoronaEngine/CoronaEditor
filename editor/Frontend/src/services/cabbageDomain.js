import { editorApi } from '../api/editorApi.js';
import policy from './aiPolicy.json' with { type: 'json' };
import { worldModeState } from './worldModeService.js';

export function roundScore(value) {
  const floor = Math.floor(value);
  return value - floor === 0.5 ? floor + (floor % 2) : Math.round(value);
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const documentName = 'CabbageAssistant/context.json';
const normalizePath = (value) =>
  String(value || '')
    .replaceAll('\\', '/')
    .replace(/\/+$/, '')
    .toLowerCase();
export function activeProjectPath() {
  return String(window.localStorage?.getItem('corona.activeProjectPath') || '');
}
const unwrap = (response) => response?.data ?? response;
const number = (data, ...keys) => {
  for (const key of keys)
    if (data[key] != null && data[key] !== '' && Number.isFinite(Number(data[key])))
      return Number(data[key]);
  return null;
};
const text = (data, ...keys) => {
  for (const key of keys)
    if (data[key] != null && String(data[key]).trim()) return String(data[key]).trim();
  return '';
};

function fillSlots(context, now) {
  const custom =
    context.worldGoal.source === 'ai' &&
    context.worldGoal.status === 'ready' &&
    [...context.activeTasks, ...context.taskHistory].some((t) => t.type === 'goal');
  if (custom) {
    context.activeTasks = context.activeTasks.filter((t) => t.type !== 'tutorial');
    let visible = 0;
    for (const task of context.activeTasks
      .filter((t) => t.type === 'goal')
      .sort((a, b) => a.order - b.order)) {
      task.status = visible++ < 2 ? 'active' : 'queued';
    }
    return;
  }
  context.activeTasks = context.activeTasks.filter(
    (t) => t.type !== 'goal' && !policy.retiredTutorialKeys.includes(t.taskKey)
  );
  const templates = new Map(policy.tutorialTasks.map((t) => [t.taskKey, t]));
  for (const task of context.taskHistory.filter((t) => t.type === 'tutorial')) {
    if (templates.has(task.taskKey)) Object.assign(task, templates.get(task.taskKey));
  }
  if (context.tutorialSession.status === 'completed') {
    context.activeTasks = context.activeTasks.filter((t) => t.type !== 'tutorial');
    return;
  }
  const completed = new Set(
    context.taskHistory.filter((t) => t.type === 'tutorial').map((t) => t.taskKey)
  );
  const previous = new Map(context.activeTasks.map((t) => [t.taskKey, t]));
  const tasks = policy.tutorialTasks
    .filter((t) => !completed.has(t.taskKey))
    .map((template, i) => ({
      ...template,
      ...previous.get(template.taskKey),
      ...template,
      status: i === 0 ? 'active' : 'queued',
      createdAt: previous.get(template.taskKey)?.createdAt || now,
      updatedAt: previous.get(template.taskKey)?.updatedAt || now,
      completedAt: 0,
      resolvedAt: 0,
    }));
  context.activeTasks = [...context.activeTasks.filter((t) => t.type !== 'tutorial'), ...tasks];
}

export function normalizeContext(raw, projectPath, now = Date.now()) {
  const base = clone(policy.defaultContext);
  base.tutorialSession = clone(policy.defaultSession);
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? clone(raw) : {};
  const context = {
    ...base,
    ...value,
    schemaVersion: 2,
    worldId: projectPath.replaceAll('\\', '/').split('/').filter(Boolean).at(-1),
    projectPathIdentity: projectPath,
    updatedAt: Number(value.updatedAt) || now,
  };
  for (const name of [
    'metrics',
    'profile',
    'tutorialProgress',
    'worldGoal',
    'goalTaskPlan',
    'tutorialSession',
  ]) {
    context[name] = { ...base[name], ...(value[name] || {}) };
  }
  for (const key of [
    'activeTasks',
    'taskHistory',
    'chatMessages',
    'recentOperationEvents',
    'profileHistory',
  ]) {
    context[key] = Array.isArray(value[key])
      ? value[key].filter((v) => v && typeof v === 'object' && !Array.isArray(v))
      : [];
  }
  context.issueMemory =
    value.issueMemory && typeof value.issueMemory === 'object' ? value.issueMemory : {};
  context.goalSignalCounts = Object.fromEntries(
    Object.entries(value.goalSignalCounts || {})
      .filter(([key]) => policy.goalSignals.includes(key))
      .map(([key, value]) => [key, Math.max(0, Number(value) || 0)])
  );
  const rawProfile = value.profile || {};
  context.profile.score = Math.max(
    0,
    Math.min(100, roundScore(Number(rawProfile.score ?? rawProfile.fluencyScore) || 0))
  );
  context.profile.reasonCodes = (rawProfile.reasonCodes || rawProfile.fluencyReasonCodes || [])
    .map(String)
    .slice(0, 12);
  context.profile.lastScoredEventCount =
    Number(rawProfile.lastScoredEventCount ?? rawProfile.lastClassifiedEventCount) || 0;
  normalizeIssueMemory(context);
  context.tutorialSession.bindings = {
    ...base.tutorialSession.bindings,
    ...(value.tutorialSession?.bindings || {}),
  };
  if (!value.tutorialSession?.sessionId) context.tutorialSession.sessionId = crypto.randomUUID();
  context.tutorialSession.startedAt ||= now;
  if (['restoring', 'restore_failed', 'completed'].includes(context.tutorialSession.status)) {
    Object.assign(context.tutorialSession, {
      status: 'completed',
      baseline: {},
      modificationLog: [],
      lastRestoreError: '',
    });
    context.tutorialSession.completedAt ||= now;
  }
  context.profileHistory = context.profileHistory.slice(-50);
  context.recentOperationEvents = context.recentOperationEvents.slice(-200);
  fillSlots(context, now);
  return context;
}

export function projectIdentity(payload = {}) {
  const projectPath = payload.projectPath || activeProjectPath();
  if (payload.projectRevision != null && payload.projectRevision !== worldModeState.revision)
    throw new Error('当前世界已切换');
  if (
    !projectPath ||
    normalizePath(projectPath) !== normalizePath(activeProjectPath()) ||
    (payload.worldId &&
      payload.worldId !== projectPath.replaceAll('\\\\', '/').split('/').filter(Boolean).at(-1))
  )
    throw new Error('当前世界已切换');
  return projectPath;
}

async function documentScope(projectPath) {
  const scene = unwrap(await editorApi.scene.readActive());
  if (!scene?.archive_session || normalizePath(scene.project_path) !== normalizePath(projectPath))
    throw new Error('当前世界已切换');
  return { project_path: projectPath, archive_session: scene.archive_session, document: documentName };
}

export async function readContext(projectPath) {
  projectIdentity({ projectPath });
  const read = unwrap(
    await editorApi.projectSettings.readProjectDocument(await documentScope(projectPath))
  );
  projectIdentity({ projectPath });
  if (!read?.success) throw new Error(read?.error || '读取助手状态失败');
  return { success: true, status: 'ok', context: normalizeContext(read.content, projectPath) };
}

export async function contextTransaction(
  projectPath,
  reducer,
  { signal, revision = worldModeState.revision } = {}
) {
  if (!projectPath || normalizePath(projectPath) !== normalizePath(activeProjectPath()))
    throw new Error('当前世界已切换');
  const request = await documentScope(projectPath);
  for (let attempt = 0; attempt < 12; attempt++) {
    if (signal?.aborted || revision !== worldModeState.revision) throw new Error('当前任务已取消');
    const read = unwrap(await editorApi.projectSettings.readProjectDocument(request));
    if (!read?.success) throw new Error(read?.error || '读取助手状态失败');
    const context = normalizeContext(read.content, projectPath);
    const result = await reducer(context);
    if (normalizePath(projectPath) !== normalizePath(activeProjectPath()))
      throw new Error('当前世界已切换');
    if (signal?.aborted || revision !== worldModeState.revision) throw new Error('当前任务已取消');
    fillSlots(context, Date.now());
    context.updatedAt = Math.max(Date.now(), context.updatedAt + 1);
    const saved = unwrap(
      await editorApi.projectSettings.commitProjectDocument({
        ...request,
        version: read.version,
        content: context,
      })
    );
    if (saved?.success) return { success: true, status: 'ok', context, ...result };
    if (saved?.error !== 'DOCUMENT_CONFLICT') throw new Error(saved?.error || '保存助手状态失败');
  }
  throw new Error('助手状态正在被其他窗口修改，请重试');
}

function completeTask(context, key, now, status = 'completed') {
  const index = context.activeTasks.findIndex((t) => t.taskKey === key);
  if (index < 0) return false;
  const task = context.activeTasks.splice(index, 1)[0];
  context.taskHistory.push({
    ...task,
    status,
    updatedAt: now,
    ...(status === 'completed' ? { completedAt: now } : { resolvedAt: now }),
  });
  return true;
}

function tutorialProgress(context, event) {
  const session = context.tutorialSession;
  if (event.type === 'tutorial_completion_notice_dismissed') {
    session.completionNoticeExpiresAt = 0;
    return [];
  }
  if (event.type === 'tutorial_baseline_captured' && event.success) {
    try {
      session.baseline = {
        ...session.baseline,
        ...JSON.parse(event.details?.baselineJson || '{}'),
      };
    } catch {}
    return [];
  }
  if (!event.success || session.status !== 'active') return [];
  if (
    [
      'model_imported',
      'transform_position',
      'transform_rotation',
      'transform_scale',
      'physics_changed',
      'lighting_changed',
      'node_created',
      'node_connected',
      'block_added',
      'block_parameter_changed',
    ].includes(event.type)
  ) {
    session.modificationLog.push(clone(event));
    session.modificationLog = session.modificationLog.slice(-200);
  }
  const task = context.activeTasks.find((t) => t.type === 'tutorial' && t.status === 'active');
  if (!task) return [];
  const key = task.taskKey.replace('tutorial.basics.', '');
  const d = event.details || {},
    b = session.bindings;
  const type = event.type;
  const observed = type === 'tutorial_node_state_observed' && d.observedTaskKey === task.taskKey;
  const n = text(d, 'nodeId'),
    e = text(d, 'edgeId'),
    block = text(d, 'blockId');
  const actorName = text(d, 'actorName', 'objectName', 'modelActorName');
  const actorId = text(d, 'actorId', 'objectId', 'modelActorId');
  const actorMatches =
    (b.modelActorId && actorId === b.modelActorId) ||
    (b.modelActorName && actorName === b.modelActorName);
  const value = number(d, 'value', 'newValue');
  const delta = number(d, 'actualDelta', 'distance', 'rotationDelta', 'delta') || 0;
  const user = d.source === 'user';
  const blockEvent =
    ['block_added', 'block_connected', 'block_parameter_changed'].includes(type) || observed;
  const field = String(d.fieldName || '').toUpperCase();
  const connected = d.connected === true;
  const close = (a, v) => a !== null && Math.abs(a - v) <= 0.01;
  let matched = false;
  switch (key) {
    case 'viewport_focus':
      matched = type === 'viewport_focused';
      break;
    case 'camera_forward_back':
    case 'camera_left_right':
    case 'camera_up_down': {
      const groups = {
        camera_forward_back: ['forward_back', 'WS'],
        camera_left_right: ['left_right', 'AD'],
        camera_up_down: ['up_down', 'QE'],
      };
      const [group, keys] = groups[key];
      matched =
        type === 'camera_moved' &&
        d.axisGroup === group &&
        keys.includes(String(d.key).toUpperCase()) &&
        Math.abs(delta) > 1e-6;
      break;
    }
    case 'camera_rotate':
      matched =
        type === 'camera_rotated' && d.interaction === 'right_mouse_drag' && Math.abs(delta) > 1e-6;
      break;
    case 'camera_wheel':
      matched = type === 'camera_moved' && d.interaction === 'wheel' && Math.abs(delta) > 1e-6;
      break;
    case 'open_scene_manager':
      matched = type === 'panel_opened' && d.panelId === 'SceneTools' && user;
      break;
    case 'import_model':
      matched = type === 'model_imported' && Boolean(actorName || actorId);
      if (matched)
        Object.assign(b, {
          sceneName: text(d, 'sceneName'),
          modelActorName: actorName,
          modelActorId: actorId,
          modelResourcePath: text(d, 'resourcePath'),
        });
      break;
    case 'select_model':
      matched =
        type === 'actor_selected' &&
        actorMatches &&
        [undefined, '', 'user', 'scene_tree', 'viewport'].includes(d.source);
      break;
    case 'set_position_x':
      matched = type === 'transform_position' && actorMatches && d.axis === 'x' && close(value, 1);
      break;
    case 'set_rotation_y':
      matched =
        type === 'transform_rotation' &&
        actorMatches &&
        d.axis === 'y' &&
        value !== null &&
        Math.abs(value - 45) <= 0.1;
      break;
    case 'set_scale_x':
      matched = type === 'transform_scale' && actorMatches && d.axis === 'x' && close(value, 1.5);
      break;
    case 'enable_physics':
      matched =
        type === 'physics_changed' &&
        actorMatches &&
        d.operation === 'SetPhysicsEnabled' &&
        (d.value ?? d.newValue ?? d.enabled) === true;
      break;
    case 'set_mass':
      matched =
        type === 'physics_changed' && actorMatches && d.operation === 'SetMass' && close(value, 10);
      break;
    case 'set_light_x':
      matched = type === 'lighting_changed' && d.axis === 'x' && close(value, 0.5);
      break;
    case 'open_nodes':
      matched = type === 'panel_opened' && d.panelId === 'NodeGraphPanel' && user;
      break;
    case 'confirm_start_node':
      matched =
        (['node_created', 'node_selected'].includes(type) || observed) &&
        d.nodeType === 'start' &&
        Boolean(n) &&
        (d.uniqueStart === true || d.startNodeCount === 1);
      if (matched)
        Object.assign(b, {
          startNodeId: n,
          startNodeCreatedByTutorial: type === 'node_created' || d.createdByTutorial === true,
        });
      break;
    case 'create_custom_node':
      matched = (type === 'node_created' || observed) && d.nodeType === 'custom' && Boolean(n);
      if (matched) b.customNodeId = n;
      break;
    case 'select_custom_node':
      matched = type === 'node_selected' && n === b.customNodeId && d.mode === 'select' && user;
      break;
    case 'move_custom_node':
      matched =
        type === 'node_moved' &&
        n === b.customNodeId &&
        d.mode === 'select' &&
        user &&
        Math.abs(delta) > 1e-6;
      break;
    case 'create_delete_practice_node':
      matched =
        type === 'node_created' && d.nodeType === 'custom' && Boolean(n) && n !== b.customNodeId;
      if (matched) b.deletePracticeNodeId = n;
      break;
    case 'delete_practice_node':
      matched =
        type === 'node_deleted' && n === b.deletePracticeNodeId && d.mode === 'delete' && user;
      break;
    case 'return_select_tool':
      matched = type === 'node_tool_mode_changed' && d.mode === 'select' && user;
      break;
    case 'connect_nodes':
      matched =
        (type === 'node_connected' || observed) &&
        d.sourceNodeId === b.startNodeId &&
        d.targetNodeId === b.customNodeId &&
        Boolean(e);
      if (matched) b.edgeId = e;
      break;
    case 'open_custom_node':
      matched =
        (type === 'node_selected' || observed) &&
        n === b.customNodeId &&
        [undefined, '', 'user', 'state_observation'].includes(d.source);
      break;
    case 'add_when_enter':
      matched =
        (type === 'block_added' || observed) &&
        n === b.customNodeId &&
        d.blockType === 'node_when_enter' &&
        Boolean(block);
      if (matched) b.whenEnterBlockId = block;
      break;
    case 'add_set_position':
      matched =
        blockEvent &&
        n === b.customNodeId &&
        d.blockType === 'object_set_position' &&
        d.parentBlockType === 'node_when_enter' &&
        connected &&
        Boolean(block);
      if (matched) b.setPositionBlockId = block;
      break;
    case 'set_position_model':
      matched =
        blockEvent &&
        n === b.customNodeId &&
        block === b.setPositionBlockId &&
        d.parentBlockType === 'node_when_enter' &&
        connected &&
        field === 'NAME' &&
        text(d, 'newValue', 'value', 'modelName') === b.modelActorName;
      break;
    case 'set_start_x':
      matched =
        blockEvent &&
        n === b.customNodeId &&
        block === b.setPositionBlockId &&
        d.parentBlockType === 'node_when_enter' &&
        connected &&
        field === 'X' &&
        close(number(d, 'newValue', 'value', 'x'), -3) &&
        d.modelName === b.modelActorName &&
        (d.y == null || close(Number(d.y), 0)) &&
        (d.z == null || close(Number(d.z), 0));
      break;
    case 'add_while_active':
      matched =
        (type === 'block_added' || observed) &&
        n === b.customNodeId &&
        d.blockType === 'node_while_active' &&
        !d.parentBlockType &&
        !connected &&
        Boolean(block);
      if (matched) b.whileActiveBlockId = block;
      break;
    case 'add_move_direction':
      matched =
        blockEvent &&
        n === b.customNodeId &&
        d.blockType === 'object_move_direction' &&
        d.parentBlockType === 'node_while_active' &&
        connected &&
        Boolean(block);
      if (matched) b.moveDirectionBlockId = block;
      break;
    case 'set_move_model':
    case 'set_move_direction':
    case 'set_move_speed':
      matched =
        blockEvent &&
        n === b.customNodeId &&
        block === b.moveDirectionBlockId &&
        d.parentBlockType === 'node_while_active' &&
        connected;
      if (key === 'set_move_model')
        matched &&=
          field === 'NAME' && text(d, 'newValue', 'value', 'modelName') === b.modelActorName;
      if (key === 'set_move_direction')
        matched &&=
          field === 'DIRECTION' &&
          text(d, 'newValue', 'value', 'direction').toUpperCase() === 'RIGHT' &&
          d.modelName === b.modelActorName;
      if (key === 'set_move_speed')
        matched &&=
          field === 'SPEED' &&
          close(number(d, 'newValue', 'value', 'speed'), 2) &&
          d.modelName === b.modelActorName &&
          String(d.direction).toUpperCase() === 'RIGHT';
      break;
    case 'run_graph':
      matched = type === 'run_clicked' && user;
      break;
    case 'focus_ai_composer':
      matched = type === 'ai_composer_focused' && user;
      break;
    case 'ask_ai':
      matched =
        type === 'ai_question_answered' &&
        d.mode === 'ask' &&
        d.responseReceived === true &&
        Boolean(d.prompt);
      break;
    case 'modify_with_ai':
      matched =
        type === 'ai_node_graph_changed' &&
        d.mode === 'modify' &&
        d.operation === 'edit' &&
        d.applied === true &&
        Boolean(d.prompt);
      break;
    case 'generate_with_ai':
      matched =
        type === 'ai_node_graph_changed' &&
        d.mode === 'generate' &&
        d.operation === 'extend' &&
        d.applied === true &&
        Boolean(d.prompt);
      break;
  }
  if (!matched || !completeTask(context, task.taskKey, event.timestamp)) return [];
  if (key === 'generate_with_ai')
    Object.assign(session, {
      status: 'completed',
      completedAt: event.timestamp,
      completionNoticeExpiresAt: event.timestamp + 15000,
      baseline: {},
      modificationLog: [],
      lastRestoreError: '',
    });
  return [task.taskKey];
}

function goalSignals(event) {
  if (!event.success) return [];
  const map = {
    model_imported: 'model_imported',
    actor_created: 'model_imported',
    transform_position: 'object_transformed',
    transform_rotation: 'object_transformed',
    transform_scale: 'object_transformed',
    lighting_changed: 'lighting_adjusted',
    physics_changed: 'physics_adjusted',
    node_created: 'node_created',
    node_moved: 'node_moved',
    block_parameter_changed: 'block_parameter_changed',
  };
  const signals = map[event.type] ? [map[event.type]] : [];
  if (
    event.type === 'node_connected' &&
    event.details.sourceNodeId &&
    event.details.targetNodeId &&
    event.details.sourceNodeId !== event.details.targetNodeId
  )
    signals.push('nodes_connected');
  if (event.type === 'block_added') {
    signals.push('block_added');
    if (event.details.workspaceRole === 'condition') signals.push('transition_condition_set');
  }
  if (['run_started', 'run_succeeded'].includes(event.type)) signals.push('node_graph_run');
  if (event.type === 'run_succeeded') signals.push('run_succeeded');
  return signals;
}

export function applyEvent(context, payload) {
  const event = {
    ...clone(payload),
    timestamp: Number(payload.timestamp) || Date.now(),
    success: payload.success !== false,
    details: payload.details || {},
  };
  context.recentOperationEvents.push(event);
  context.recentOperationEvents = context.recentOperationEvents.slice(-200);
  const metric = policy.metricsByEvent[event.type];
  if (metric && event.success) context.metrics[metric] = (context.metrics[metric] || 0) + 1;
  if (event.success && policy.importantEvents.includes(event.type))
    context.metrics.importantEventCount++;
  context.metrics.firstActivityAt ||= event.timestamp;
  context.metrics.lastActivityAt = event.timestamp;
  if (!event.type || typeof event.type !== 'string') throw new Error('操作事件缺少类型');
  event.eventId ||= crypto.randomUUID();
  const completed = tutorialProgress(context, event);
  const signals = goalSignals(event);
  for (const signal of signals)
    context.goalSignalCounts[signal] = (context.goalSignalCounts[signal] || 0) + 1;
  for (const task of [...context.activeTasks].filter(
    (t) => t.type === 'goal' && ['active', 'pending'].includes(t.status)
  )) {
    if (!signals.includes(task.completionSignal)) continue;
    const required = task.requiredBlockTypes || [];
    if (required.length) {
      if (!required.includes(event.details.blockType)) continue;
      task.observedBlockTypes = [
        ...new Set([...(task.observedBlockTypes || []), event.details.blockType]),
      ];
      if (!required.every((t) => task.observedBlockTypes.includes(t))) continue;
    } else if (context.goalSignalCounts[task.completionSignal] < (task.requiredCount || 1))
      continue;
    if (completeTask(context, task.taskKey, event.timestamp)) completed.push(task.taskKey);
  }
  fillSlots(context, event.timestamp);
  for (const taskKey of completed) {
    const task = context.taskHistory.findLast((t) => t.taskKey === taskKey);
    context.recentOperationEvents.push({
      eventId: crypto.randomUUID(),
      type: task?.type === 'goal' ? 'goal_task_completed' : 'tutorial_completed',
      category: 'assistant',
      success: true,
      timestamp: event.timestamp,
      details: { taskKey, taskType: task?.type },
    });
  }
  context.recentOperationEvents = context.recentOperationEvents.slice(-200);
  return { completedTaskKeys: completed };
}

const patternFields = [
  'blockType',
  'workspaceRole',
  'relationType',
  'missingInput',
  'objectRequirement',
  'edgeId',
];
const pattern = (value) =>
  Object.fromEntries(
    patternFields.filter((k) => value?.[k]).map((k) => [k, String(value[k]).trim().slice(0, 180)])
  );
const memoryDefault = () => ({
  occurrences: 0,
  resolvedCount: 0,
  chatDiscussionCount: 0,
  firstSeenAt: 0,
  lastSeenAt: 0,
  lastDiscussedAt: 0,
  pattern: {},
});
function memoryEntry(context, code) {
  return (context.issueMemory[code || 'logic_issue'] ||= memoryDefault());
}
function normalizeIssueMemory(context) {
  const normalized = {};
  for (const [code, entry] of Object.entries(context.issueMemory || {})) {
    if (!code || !entry || typeof entry !== 'object') continue;
    normalized[code] = { ...memoryDefault(), ...entry, pattern: pattern(entry.pattern) };
  }
  if (!Object.keys(normalized).length) {
    for (const task of [...context.activeTasks, ...context.taskHistory].filter(
      (t) => t.type === 'node-issue'
    )) {
      const code = task.code || task.issueKey || task.taskKey;
      const entry = (normalized[code] ||= memoryDefault());
      entry.occurrences++;
      Object.assign(entry.pattern, pattern(task.pattern));
      const seen = Number(task.firstDetectedAt || task.createdAt) || 0;
      const seenTimes = [entry.firstSeenAt, seen].filter(Boolean);
      entry.firstSeenAt = seenTimes.length ? Math.min(...seenTimes) : 0;
      entry.lastSeenAt = Math.max(entry.lastSeenAt, seen);
      if (task.status === 'resolved' || task.resolvedAt) entry.resolvedCount++;
    }
    for (const message of context.chatMessages.filter((m) => m.role === 'user' && m.issueCode)) {
      const entry = (normalized[message.issueCode] ||= memoryDefault());
      entry.chatDiscussionCount++;
      entry.lastDiscussedAt = Math.max(entry.lastDiscussedAt, Number(message.createdAt) || 0);
    }
  }
  context.issueMemory = Object.fromEntries(
    Object.entries(normalized)
      .sort(
        (a, b) =>
          Math.max(b[1].lastSeenAt, b[1].lastDiscussedAt) -
          Math.max(a[1].lastSeenAt, a[1].lastDiscussedAt)
      )
      .slice(0, 200)
  );
}
function internalEvent(context, type, taskKey, now) {
  context.recentOperationEvents.push({
    eventId: crypto.randomUUID(),
    type,
    category: 'node',
    success: true,
    timestamp: now,
    details: { taskKey },
  });
  context.recentOperationEvents = context.recentOperationEvents.slice(-200);
  context.metrics.importantEventCount++;
  context.metrics.firstActivityAt ||= now;
  context.metrics.lastActivityAt = now;
}
export function appendMessage(context, message) {
  const related = [...context.activeTasks, ...context.taskHistory].findLast(
    (t) => t.taskKey === message.taskKey
  );
  const entry = {
    ...clone(message),
    id: message.id || crypto.randomUUID(),
    role: message.role === 'assistant' ? 'assistant' : 'user',
    createdAt: message.createdAt || Date.now(),
    content: String(message.content || '')
      .trim()
      .slice(0, 12000),
    issueCode: message.issueCode || (related?.type === 'node-issue' ? related.code : ''),
    nodeId: message.nodeId || related?.nodeId || '',
    blockId: message.blockId || related?.blockId || '',
    steps: (Array.isArray(message.steps) ? message.steps : [])
      .map((v) => String(v).trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 8),
  };
  if (!entry.content) throw new Error('包菜消息内容为空');
  const intents = [
    'import_model',
    'transform_model',
    'adjust_lighting',
    'adjust_physics',
    'create_node',
    'move_node',
    'connect_nodes',
    'drag_block',
    'edit_block_parameter',
    'set_transition_condition',
    'run_node_graph',
  ];
  if (!intents.includes(entry.guidanceIntent)) {
    entry.guidanceIntent = '';
    entry.needsShowcase = false;
  }
  if (context.chatMessages.some((m) => m.id === entry.id)) return { message: entry };
  context.chatMessages.push(entry);
  if (entry.role === 'user' && entry.issueCode) {
    const memory = memoryEntry(context, entry.issueCode);
    memory.chatDiscussionCount++;
    memory.lastDiscussedAt = entry.createdAt;
  }
  return { message: entry };
}

export function updateTask(context, payload) {
  const incoming = clone(payload.task || payload);
  const key = String(incoming.taskKey || incoming.issueKey || incoming.code || '')
    .trim()
    .slice(0, 180);
  if (!key) throw new Error('缺少任务标识');
  const action = payload.action || 'upsert',
    now = Date.now();
  const existing = context.activeTasks.find((t) => t.taskKey === key);
  if (['complete', 'resolve', 'cancel'].includes(action)) {
    if (existing) {
      completeTask(
        context,
        key,
        now,
        { complete: 'completed', resolve: 'resolved', cancel: 'cancelled' }[action]
      );
      if (existing.type === 'node-issue' && action === 'resolve') {
        context.metrics.nodeIssueFixes++;
        memoryEntry(context, existing.code).resolvedCount++;
        internalEvent(context, 'node_issue_fixed', key, now);
      }
    }
  } else {
    const next = {
      ...incoming,
      taskKey: key,
      issueKey: key,
      code: incoming.code || key,
      type: incoming.type || 'node-issue',
      pattern: pattern(incoming.pattern),
      status: incoming.status || (action === 'candidate' ? 'candidate' : 'active'),
      updatedAt: now,
      createdAt: existing?.createdAt || incoming.createdAt || now,
      firstDetectedAt:
        existing?.firstDetectedAt || incoming.firstDetectedAt || incoming.createdAt || now,
    };
    if (next.type === 'node-issue') {
      const memory = memoryEntry(context, next.code);
      Object.assign(memory.pattern, next.pattern);
      if (!existing) {
        memory.occurrences++;
        memory.firstSeenAt ||= now;
        memory.lastSeenAt = now;
        context.metrics.nodeErrors++;
        internalEvent(context, 'node_issue_found', key, now);
      }
    }
    if (existing) Object.assign(existing, next);
    else context.activeTasks.push(next);
  }
  fillSlots(context, now);
}
