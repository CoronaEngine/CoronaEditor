import policy from './aiPolicy.json' with { type: 'json' };
import prompts from './aiPrompts.json' with { type: 'json' };

const signalsByPhase = {
  'node-logic': [
    'node_created',
    'node_moved',
    'nodes_connected',
    'block_added',
    'block_parameter_changed',
    'transition_condition_set',
    'node_graph_run',
    'run_succeeded',
  ],
  'scene-polish': ['model_imported', 'object_transformed', 'lighting_adjusted', 'physics_adjusted'],
};
const guidanceBySignal = {
  model_imported: 'import_model',
  object_transformed: 'transform_model',
  lighting_adjusted: 'adjust_lighting',
  physics_adjusted: 'adjust_physics',
  node_created: 'create_node',
  node_moved: 'move_node',
  nodes_connected: 'connect_nodes',
  block_added: 'drag_block',
  block_parameter_changed: 'edit_block_parameter',
  transition_condition_set: 'set_transition_condition',
  node_graph_run: 'run_node_graph',
  run_succeeded: 'run_node_graph',
};
const string = (value, limit) =>
  String(value || '')
    .trim()
    .slice(0, limit);
function blockTypes(value) {
  if (value != null && !Array.isArray(value)) throw new Error('积木类型必须是数组');
  const types = [...new Set((value || []).map((v) => string(v, 180)).filter(Boolean))];
  if (types.some((t) => !policy.catalog[t] || policy.catalog[t].projectUsage !== 'project-safe'))
    throw new Error('计划使用了不支持的积木');
  return types.slice(0, 20);
}
export function normalizeGoalPlan(result, context, now = Date.now()) {
  const raw = result.logicBlueprint;
  if (!raw || !raw.worldSummary || !raw.coreLoop)
    throw new Error('世界玩法蓝图缺少世界概述或核心循环');
  const blueprint = {
    worldSummary: string(raw.worldSummary, 800),
    coreLoop: string(raw.coreLoop, 1200),
    requiredActors: (raw.requiredActors || [])
      .map((v) => string(v, 160))
      .filter(Boolean)
      .slice(0, 30),
    flow: (raw.flow || [])
      .map((v) => string(v, 240))
      .filter(Boolean)
      .slice(0, 20),
    nodeEffects: [],
  };
  const effects = new Set();
  for (const item of (raw.nodeEffects || []).slice(0, 16)) {
    if (
      !item?.effectId ||
      effects.has(item.effectId) ||
      !item.title ||
      !item.description ||
      !item.verification
    )
      throw new Error('节点效果字段不完整或 effectId 重复');
    const recommended = blockTypes(item.recommendedBlockTypes);
    if (!recommended.length) throw new Error('节点效果缺少积木');
    effects.add(item.effectId);
    blueprint.nodeEffects.push({ ...item, recommendedBlockTypes: recommended });
  }
  if (!blueprint.requiredActors.length || blueprint.flow.length < 3 || effects.size < 2)
    throw new Error('世界玩法蓝图不完整');
  if (!Array.isArray(result.tasks)) throw new Error('世界任务缺少 tasks 数组');
  const occurrences = {},
    tasks = [];
  let scene = false;
  for (const [i, rawTask] of result.tasks.slice(0, 10).entries()) {
    const phase = rawTask.phase,
      signal = rawTask.completionSignal;
    if (!signalsByPhase[phase]?.includes(signal)) throw new Error('任务阶段或完成信号无效');
    if (phase === 'scene-polish') scene = true;
    else if (scene) throw new Error('节点任务必须排在场景任务前');
    if (phase === 'node-logic' && !effects.has(rawTask.effectId))
      throw new Error('节点任务没有关联蓝图效果');
    const requiredBlockTypes = blockTypes(rawTask.requiredBlockTypes);
    if (
      ['block_added', 'block_parameter_changed'].includes(signal) !==
      Boolean(requiredBlockTypes.length)
    )
      throw new Error('积木任务与积木要求不匹配');
    const task = {
      taskKey: 'goal.ai.' + String(i + 1).padStart(2, '0'),
      type: 'goal',
      track: 'world-goal',
      phase,
      effectId: phase === 'node-logic' ? rawTask.effectId : '',
      order: i + 1,
      status: 'queued',
      code: 'world_goal_step',
      severity: 'info',
      confidence: 1,
      completionSignal: signal,
      requiredBlockTypes,
      observedBlockTypes: [],
      guidanceIntent: guidanceBySignal[signal],
      requiredCount:
        Number(context.goalSignalCounts[signal] || 0) +
        (occurrences[signal] = (occurrences[signal] || 0) + 1),
      createdAt: now,
      firstDetectedAt: now,
      updatedAt: now,
      completedAt: 0,
      resolvedAt: 0,
    };
    task.issueKey = task.taskKey;
    for (const field of ['title', 'message', 'suggestion', 'completionCriteria']) {
      const limit = field === 'title' ? 160 : field === 'completionCriteria' ? 800 : 1600;
      task[field] = string(rawTask[field], limit);
      if (!task[field]) throw new Error('世界任务缺少 ' + field);
      task[field + 'En'] = string(rawTask[field + 'En'] || task[field], limit);
    }
    tasks.push(task);
  }
  const nodeTasks = tasks.filter((t) => t.phase === 'node-logic');
  if (
    tasks.length < 6 ||
    nodeTasks.length < 5 ||
    nodeTasks.at(-1)?.completionSignal !== 'run_succeeded'
  )
    throw new Error('至少需要五个节点任务，最后一步必须验证成功运行');
  tasks.slice(0, 2).forEach((t) => {
    t.status = 'active';
  });
  return { tasks, blueprint };
}

export function scoreEligibility(context, force, now = Date.now()) {
  if (force) return '';
  const m = context.metrics,
    p = context.profile,
    count = Number(m.importantEventCount) || 0,
    last = Number(p.updatedAt) || 0;
  const high = ['nodeEdits', 'nodeIssueFixes', 'runSuccesses', 'runFailures'].some((k) => m[k] > 0);
  const categories = [
    m.modelImports || m.transformEdits,
    m.lightingEdits,
    m.physicsEdits,
    m.nodeEdits || m.nodeErrors || m.nodeIssueFixes,
    m.runSuccesses || m.runFailures,
  ].filter(Boolean).length;
  if (count < 6 && !high) return 'insufficient_evidence';
  if (categories < 2 && !high) return 'insufficient_categories';
  if (last && now - last < 300000) return 'score_update_cooldown';
  if (last && count <= p.lastScoredEventCount) return 'no_material_change';
  const recentHigh = context.recentOperationEvents.some(
    (e) =>
      e.timestamp > last &&
      [
        'node_edited',
        'node_created',
        'node_connected',
        'block_added',
        'block_parameter_changed',
        'node_issue_fixed',
        'run_succeeded',
        'run_failed',
      ].includes(e.type)
  );
  if (last && count - p.lastScoredEventCount < 5 && !recentHigh) return 'no_material_change';
  return '';
}
export function scoreEvidence(context) {
  const durations = [],
    fixes = [];
  let completed = 0;
  for (const task of context.taskHistory) {
    const created = Number(task.createdAt) || 0,
      detected = Number(task.firstDetectedAt) || created;
    if (task.type === 'tutorial' && task.completedAt > created && created > 0) {
      completed++;
      durations.push((task.completedAt - created) / 1000);
    }
    if (task.type === 'node-issue' && task.resolvedAt > 0 && detected > 0)
      fixes.push((task.resolvedAt - detected) / 1000);
  }
  const median = (values) =>
    values.length
      ? Math.round(values.sort((a, b) => a - b)[Math.floor(values.length / 2)] * 10) / 10
      : null;
  const ratio = (a, b) => (b ? Math.round((a / b) * 1000) / 1000 : null);
  const events = context.recentOperationEvents.slice(-60),
    runs = events.filter((e) => ['run_succeeded', 'run_failed'].includes(e.type)),
    m = context.metrics;
  return {
    completedTutorials: completed,
    medianTutorialSeconds: median(durations),
    medianIssueFixSeconds: median(fixes),
    runSuccessRate: ratio(m.runSuccesses, m.runSuccesses + m.runFailures),
    nodeIssueResolutionRate: ratio(m.nodeIssueFixes, m.nodeErrors),
    recentOperationSuccessRate: ratio(
      events.filter((e) => e.success !== false).length,
      Math.max(1, events.length)
    ),
    recentRunSuccessRate: ratio(runs.filter((e) => e.type === 'run_succeeded').length, runs.length),
    recentFailedOperations: events.filter((e) => e.success === false).length,
    repeatedIssueKinds: Object.values(context.issueMemory).filter((v) => v.occurrences >= 2).length,
    operationCategoryCount: [
      m.modelImports || m.transformEdits,
      m.lightingEdits,
      m.physicsEdits,
      m.nodeEdits || m.nodeErrors || m.nodeIssueFixes,
      m.runSuccesses || m.runFailures,
    ].filter(Boolean).length,
  };
}

export function goalMessages(prompt, mode) {
  const catalog = Object.entries(policy.catalog)
    .filter(([, spec]) => spec.projectUsage === 'project-safe')
    .map(([type, spec]) => ({
      type,
      label: spec.label,
      category: spec.category,
      capabilities: spec.capabilities,
    }));
  return [
    { role: 'system', content: prompts.goalSystem },
    {
      role: 'user',
      content:
        prompts.goalPrefix +
        JSON.stringify({ mode, description: prompt }) +
        '\n可用完成信号：' +
        prompts.goalSignals +
        '\n可用的项目级积木目录：' +
        JSON.stringify(catalog),
    },
  ];
}
export function scoreMessages(context) {
  const evidence = {
    metrics: context.metrics,
    scoreEvidence: scoreEvidence(context),
    tutorialTasks: [...context.activeTasks, ...context.taskHistory]
      .filter((t) => t.type === 'tutorial')
      .map((t) => ({
        title: t.title,
        status: t.status,
        completedAt: t.completedAt || 0,
        createdAt: t.createdAt || 0,
      })),
    recentEvents: context.recentOperationEvents.slice(-60),
    issueMemory: context.issueMemory,
    profileHistory: context.profileHistory.slice(-8),
    currentScore: context.profile.score,
  };
  return [
    {
      role: 'system',
      content: '根据 CoronaEngine 已发生的操作证据评估操作流畅度，必须返回合法 JSON。',
    },
    { role: 'user', content: prompts.scorePrefix + JSON.stringify(evidence) },
  ];
}
