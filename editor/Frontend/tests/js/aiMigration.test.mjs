import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

registerHooks({
  load(url, context, next) {
    if (url.endsWith('?raw'))
      return {
        format: 'module',
        shortCircuit: true,
        source:
          'export default ' + JSON.stringify(readFileSync(new URL(url.split('?')[0]), 'utf8')),
      };
    return next(url, context);
  },
});
const fixture = (name) =>
  JSON.parse(readFileSync(new URL('../fixtures/' + name, import.meta.url), 'utf8'));
const store = new Map([['corona.activeProjectPath', 'E:/World/FixtureWorld']]);
globalThis.window = {
  localStorage: { getItem: (k) => store.get(k), setItem: (k, v) => store.set(k, v) },
  addEventListener() {},
  setTimeout,
  clearTimeout,
};
const { normalizeContext, applyEvent, appendMessage, updateTask, contextTransaction } =
  await import('../../src/services/cabbageDomain.js');
const { validateGeneratedGraph, validateSemantics, generationRequirements, filterReview } =
  await import('../../src/services/aiGraphDomain.js');
const { buildCabbageChatRequest } = await import('../../src/services/cabbageChatRequest.js');
const { editorApi } = await import('../../src/api/editorApi.js');
const { modelService } = await import('../../src/services/aiModelService.js');
function mockTransport(handler) {
  modelService.sessionId = async () => 'fixture-launch';
  for (const [name, operation] of [
    ['start', 'model.start'],
    ['status', 'model.status'],
    ['cancel', 'model.cancel'],
  ]) {
    modelService[name] = async (value) => {
      const response = await handler(
        name === 'start' ? { operation, payload: value } : { operation, taskId: value }
      );
      return response?.data ?? response;
    };
  }
}

const { aiWorkflows } = await import('../../src/services/aiWorkflows.js');
const { worldModeState } = await import('../../src/services/worldModeService.js');

test('all 39 tutorial steps complete in the legacy order with identical bindings', () => {
  const f = fixture('aiMigration.json'),
    context = normalizeContext(null, 'E:/World/FixtureWorld', 100000);
  for (const step of f.tutorialSteps) {
    assert.equal(
      context.activeTasks.find((t) => t.type === 'tutorial' && t.status === 'active')?.taskKey,
      step.task
    );
    assert.deepEqual(applyEvent(context, step.event).completedTaskKeys, step.completed, step.task);
  }
  assert.deepEqual(context.tutorialSession.bindings, f.tutorialBindings);
  assert.deepEqual(
    context.taskHistory.map((t) => t.taskKey),
    f.tutorialHistory
  );
  assert.equal(context.tutorialSession.status, 'completed');
  assert.equal(
    normalizeContext(context, 'E:/World/FixtureWorld').activeTasks.filter(
      (t) => t.type === 'tutorial'
    ).length,
    0
  );
});
test('59 recorded ordinary-chat inputs retain identical final messages and guidance', () => {
  for (const record of fixture('aiChatMigration.json')) {
    const request = buildCabbageChatRequest(record.input);
    assert.deepEqual(request.modelMessages, record.messages, record.id);
    assert.deepEqual(request.guidance, record.guidance, record.id);
  }
});
for (const [i, record] of fixture('aiGraphMigration.json').requirements.entries()) {
  test('legacy generation requirements ' + i, () =>
    assert.deepEqual(
      generationRequirements(record.instruction, record.project, record.operation),
      record.expected
    )
  );
}
for (const [i, record] of fixture('aiGraphMigration.json').validation.entries()) {
  test('legacy graph validation ' + i + ' ' + record.accepted, () => {
    if (record.accepted)
      assert.deepEqual(
        validateGeneratedGraph(record.result, record.request).workspace,
        record.workspace
      );
    else assert.throws(() => validateGeneratedGraph(record.result, record.request));
  });
}
test('legacy issue memory migrates and discussions remain idempotent', () => {
  const context = normalizeContext(
    {
      profile: { fluencyScore: 65 },
      activeTasks: [
        {
          taskKey: 'i',
          code: 'missing_actor_target',
          type: 'node-issue',
          status: 'active',
          createdAt: 1000,
          pattern: { blockType: 'object_move_direction' },
        },
      ],
    },
    'E:/World/FixtureWorld'
  );
  assert.equal(context.profile.score, 65);
  assert.equal(context.issueMemory.missing_actor_target.occurrences, 1);
  appendMessage(context, { id: 'message', role: 'user', taskKey: 'i', content: 'help' });
  appendMessage(context, { id: 'message', role: 'user', taskKey: 'i', content: 'help' });
  updateTask(context, { action: 'resolve', task: { taskKey: 'i' } });
  assert.equal(context.metrics.nodeIssueFixes, 1);
  assert.equal(context.issueMemory.missing_actor_target.chatDiscussionCount, 1);
  assert.equal(context.issueMemory.missing_actor_target.resolvedCount, 1);
});
test('CAS conflicts replay pure changes on latest state without losing another window edit', async () => {
  let content = null,
    version = '0',
    first = true;
  editorApi.projectSettings.readProjectDocument = async () => ({
    data: { success: true, content: structuredClone(content), version },
  });
  editorApi.projectSettings.commitProjectDocument = async (request) => {
    if (first) {
      first = false;
      content = normalizeContext(null, 'E:/World/FixtureWorld');
      content.metrics.modelImports = 7;
      version = '1';
      return { data: { success: false, error: 'DOCUMENT_CONFLICT' } };
    }
    assert.equal(request.version, version);
    content = request.content;
    version = '2';
    return { data: { success: true } };
  };
  const result = await contextTransaction('E:/World/FixtureWorld', (context) => {
    context.metrics.nodeEdits++;
    return {};
  });
  assert.equal(result.context.metrics.nodeEdits, 1);
  assert.equal(result.context.metrics.modelImports, 7);
});
test('same basename in another project rejects writes and cancelled jobs ignore late data', async () => {
  await assert.rejects(
    contextTransaction('E:/Other/FixtureWorld', () => ({})),
    /世界已切换/
  );
  let resolve;
  mockTransport(async (request) => {
    if (request.operation === 'model.start') return { data: { success: true, taskId: 'late' } };
    if (request.operation === 'model.cancel')
      return { data: { success: true, status: 'cancelled' } };
    return new Promise((r) => {
      resolve = r;
    });
  });
  const job = aiWorkflows.startReview({
    workspace: { nodes: [], edges: [] },
    projectContext: {},
    graphRevision: 'r',
  });
  await new Promise((r) => setTimeout(r, 5));
  aiWorkflows.cancel(job.taskId);
  resolve?.({
    data: {
      success: true,
      status: 'completed',
      content: JSON.stringify({ hasProblems: false, issues: [] }),
    },
  });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(aiWorkflows.status(job.taskId).status, 'cancelled');
  const next = aiWorkflows.startReview({
    workspace: { nodes: [], edges: [] },
    projectContext: {},
    graphRevision: 'r',
  });
  worldModeState.revision++;
  assert.equal(aiWorkflows.status(next.taskId).status, 'cancelled');
});

for (const [i, record] of fixture('aiGraphMigration.json').semantics.entries()) {
  test('legacy requested semantics ' + i + ' ' + record.accepted, () => {
    if (record.accepted)
      assert.doesNotThrow(() => validateSemantics(record.result, record.request));
    else assert.throws(() => validateSemantics(record.result, record.request));
  });
}

for (const [i, record] of fixture('aiReviewMigration.json').entries()) {
  test('legacy review result ' + i, () => {
    if (!record.accepted) {
      assert.throws(() =>
        filterReview(record.result, record.request.workspace, record.request.projectContext)
      );
      return;
    }
    const actual = filterReview(
      record.result,
      record.request.workspace,
      record.request.projectContext
    );
    for (const key of ['hasProblems', 'summary', 'summaryEn', 'issues', 'optimizationTip'])
      assert.deepEqual(actual[key], record.expected[key], key);
  });
}

const { normalizeGoalPlan, scoreEligibility, scoreEvidence } =
  await import('../../src/services/aiPlanningDomain.js');
const { roundScore } = await import('../../src/services/cabbageDomain.js');
const { selectGenerationContract } = await import('../../src/services/aiGraphDomain.js');
const samplePlan = () => ({
  logicBlueprint: {
    worldSummary: '目标',
    coreLoop: '循环',
    requiredActors: ['Player'],
    flow: ['开始', '移动', '验证'],
    nodeEffects: [
      {
        effectId: 'enter',
        title: '进入',
        description: '设置初始状态',
        verification: '可见初始位置',
        recommendedBlockTypes: ['node_when_enter'],
      },
      {
        effectId: 'move',
        title: '移动',
        description: '移动对象',
        verification: '对象移动',
        recommendedBlockTypes: ['object_set_position'],
      },
    ],
  },
  tasks: [
    'node_created',
    'block_added',
    'block_parameter_changed',
    'nodes_connected',
    'run_succeeded',
    'model_imported',
  ].map((signal, i) => ({
    phase: i < 5 ? 'node-logic' : 'scene-polish',
    effectId: i < 5 ? (i % 2 ? 'enter' : 'move') : '',
    title: '任务 ' + i,
    titleEn: 'Task ' + i,
    message: '说明',
    messageEn: 'Description',
    suggestion: '执行',
    suggestionEn: 'Execute',
    completionCriteria: '验证',
    completionCriteriaEn: 'Verify',
    completionSignal: signal,
    requiredBlockTypes: ['block_added', 'block_parameter_changed'].includes(signal)
      ? ['node_when_enter']
      : [],
  })),
});
test('world plans retain blueprint links, five node steps, phase order and signal baselines', () => {
  const context = normalizeContext(null, 'E:/World/FixtureWorld');
  context.goalSignalCounts.node_created = 4;
  const plan = normalizeGoalPlan(samplePlan(), context, 1000);
  assert.equal(plan.tasks[0].requiredCount, 5);
  assert.equal(plan.tasks.filter((t) => t.status === 'active').length, 2);
  const invalid = samplePlan();
  invalid.tasks[0].effectId = 'invented';
  assert.throws(() => normalizeGoalPlan(invalid, context));
  const wrongType = samplePlan();
  wrongType.tasks[1].requiredBlockTypes = ['imaginary_block'];
  assert.throws(() => normalizeGoalPlan(wrongType, context));
  const wrongPhase = samplePlan();
  wrongPhase.tasks.reverse();
  assert.throws(() => normalizeGoalPlan(wrongPhase, context));
});
test('goal completion requires every requested block and successful operation evidence', () => {
  const context = normalizeContext(null, 'E:/World/FixtureWorld');
  context.worldGoal = { source: 'ai', status: 'ready' };
  context.activeTasks = [
    {
      taskKey: 'goal',
      type: 'goal',
      order: 1,
      status: 'active',
      completionSignal: 'block_added',
      requiredBlockTypes: ['node_when_enter', 'object_set_position'],
    },
  ];
  assert.deepEqual(
    applyEvent(context, {
      type: 'block_added',
      success: false,
      details: { blockType: 'node_when_enter' },
    }).completedTaskKeys,
    []
  );
  assert.deepEqual(
    applyEvent(context, { type: 'block_added', details: { blockType: 'node_when_enter' } })
      .completedTaskKeys,
    []
  );
  assert.deepEqual(
    applyEvent(context, { type: 'block_added', details: { blockType: 'object_set_position' } })
      .completedTaskKeys,
    ['goal']
  );
});
test('score evidence, cooldown and rounding match the existing scoring policy', () => {
  const context = normalizeContext(null, 'E:/World/FixtureWorld');
  assert.equal(scoreEligibility(context, false), 'insufficient_evidence');
  context.metrics.nodeEdits = 1;
  context.profile.updatedAt = 1000;
  assert.equal(scoreEligibility(context, false, 1001), 'score_update_cooldown');
  assert.equal(scoreEligibility(context, true, 1001), '');
  context.taskHistory = [
    { type: 'tutorial', createdAt: 1000, completedAt: 4000 },
    { type: 'node-issue', createdAt: 1000, resolvedAt: 7000 },
  ];
  const evidence = scoreEvidence(context);
  assert.equal(evidence.medianTutorialSeconds, 3);
  assert.equal(evidence.medianIssueFixSeconds, 6);
  assert.equal(roundScore(64.5), 64);
  assert.equal(roundScore(65.5), 66);
});
test('contract selection stays bounded for known capabilities and falls back for unknown instructions', () => {
  const workspace = { nodes: [], edges: [], globalVariablesWorkspace: {} };
  const request = { workspace, instruction: '给球添加 WASD 和空格跳跃' };
  const requirements = generationRequirements(request.instruction, {});
  const selected = selectGenerationContract(request, requirements);
  assert.equal(selected.mode, 'filtered');
  assert(selected.selectedTypes.includes('object_third_person_move'));
  assert(selected.selectedTypes.includes('object_arcade_jump'));
  assert(selected.selectedTypes.length < 260);
  assert.equal(
    selectGenerationContract(
      { ...request, instruction: '创造一个全新机制' },
      generationRequirements('创造一个全新机制', {})
    ).mode,
    'full'
  );
});
function documentFixture(initial) {
  let content = initial,
    version = 0;
  editorApi.projectSettings.readProjectDocument = async () => ({
    data: { success: true, content: structuredClone(content), version: String(version) },
  });
  editorApi.projectSettings.commitProjectDocument = async (request) => {
    if (request.version !== String(version))
      return { data: { success: false, error: 'DOCUMENT_CONFLICT' } };
    content = structuredClone(request.content);
    version++;
    return { data: { success: true } };
  };
  return () => content;
}
async function finished(job) {
  for (let i = 0; i < 100; i++) {
    const state = aiWorkflows.status(job.taskId);
    if (state.status === 'completed') return state.result;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail('Web workflow did not complete');
}
test('another panel resumes an active task in the same launch without another model call', async () => {
  const context = normalizeContext(null, 'E:/World/FixtureWorld');
  context.worldGoal = {
    prompt: '世界目标',
    mode: 'creative',
    source: 'ai',
    status: 'generating',
    generationId: 'persisted-goal',
    transportSessionId: 'fixture-launch',
    modelTaskId: 'provider-task',
    startedAt: Date.now(),
  };
  const saved = documentFixture(context);
  mockTransport(async (request) => {
    assert.notEqual(
      request.operation,
      'model.start',
      'resume must reuse the existing transport task'
    );
    return { data: { success: true, status: 'completed', content: JSON.stringify(samplePlan()) } };
  });
  const job = await aiWorkflows.startGoal({ prompt: '世界目标', mode: 'creative' });
  const result = await finished(job);
  assert.equal(result.success, true, result.message);
  assert.equal(saved().worldGoal.status, 'ready');
  assert.equal(saved().goalTaskPlan.taskCount, 6);
  assert.equal(
    (await aiWorkflows.startGoal({ prompt: '世界目标', mode: 'creative' })).status,
    'completed'
  );
});
test('concurrent score requests share a Web job and commit a smoothed result once', async () => {
  const context = normalizeContext(null, 'E:/World/FixtureWorld');
  context.profile = { score: 50, updatedAt: 1000, lastScoredEventCount: 0 };
  context.metrics.nodeEdits = 2;
  const saved = documentFixture(context);
  let starts = 0;
  mockTransport(async (request) => {
    if (request.operation === 'model.start') {
      starts++;
      return { data: { success: true, taskId: 'score-model' } };
    }
    return {
      data: {
        success: true,
        status: 'completed',
        content: '{"score":90,"reasonCodes":["stable_runs"]}',
      },
    };
  });
  const [first, second] = await Promise.all([
    aiWorkflows.startScore({ force: true }),
    aiWorkflows.startScore({ force: true }),
  ]);
  assert.equal(first.taskId, second.taskId);
  const result = await finished(first);
  assert.equal(result.success, true, result.message);
  assert.equal(starts, 1);
  assert.equal(saved().profile.score, 76);
  assert.equal(saved().profileHistory.length, 1);
});

test('chat facade passes final messages unchanged and retains completed guidance across polls', async () => {
  const { aiService } = await import('../../src/services/aiService.js');
  const record = fixture('aiChatMigration.json').find((r) => r.guidance.needsShowcase);
  mockTransport(async (request) => {
    if (request.operation === 'model.start') {
      assert.deepEqual(request.payload.messages, record.messages);
      return { data: { success: true, taskId: 'chat-model', status: 'accepted' } };
    }
    return { data: { success: true, status: 'completed', content: 'answer' } };
  });
  const started = await aiService.startCabbageChat(record.input);
  assert.equal(started.requestId, record.input.requestId);
  for (let i = 0; i < 2; i++) {
    const response = await aiService.getNodeGraphReviewChatStatus(started.taskId);
    for (const key of ['needsShowcase', 'guidanceIntent', 'steps'])
      assert.deepEqual(response[key], record.guidance[key]);
  }
  await aiService.cancelNodeGraphReviewChat(started.taskId);
  assert.equal((await aiService.getNodeGraphReviewChatStatus(started.taskId)).needsShowcase, true);
});

test('review results are cached in Web by revision and scene context', async () => {
  const { reviewGraph } = await import('../../src/services/aiGraphDomain.js');
  let starts = 0;
  mockTransport(async (request) => {
    if (request.operation === 'model.start') {
      starts++;
      return { data: { success: true, taskId: 'review-cache' } };
    }
    return {
      data: {
        success: true,
        status: 'completed',
        content: '{"hasProblems":false,"issues":[],"summary":""}',
      },
    };
  });
  const payload = {
    graphRevision: 'cache-rev',
    projectScopeId: 'cache-world',
    workspace: { nodes: [], edges: [] },
    projectContext: {},
  };
  await reviewGraph(payload);
  await reviewGraph(payload);
  assert.equal(starts, 1);
  await reviewGraph({ ...payload, projectContext: { actors: [], actorContextAvailable: true } });
  assert.equal(starts, 2);
});

test('generation request assembly keeps scene semantics and trims rendering payloads in Web', async () => {
  const { normalizeGenerationRequest } = await import('../../src/services/aiGraphDomain.js');
  const payload = {
    requestId: 'request',
    projectScopeId: 'scope',
    baseGraphRevision: 'rev',
    operation: ' EDIT ',
    instruction: ' 修改物体 ',
    workspace: { nodes: [], edges: [], globalVariablesWorkspace: {} },
    projectContext: {
      sceneName: 'Scene',
      unrelated: 'drop',
      actors: [
        {
          name: ' Player ',
          semanticRole: 'controller',
          tags: ['hero'],
          aliases: ['主角'],
          transform: { position: [1, 2, 3] },
          mesh: { positions: Array(1000).fill(0) },
          gpu: 'drop',
        },
      ],
    },
  };
  const request = normalizeGenerationRequest(payload);
  assert.equal(request.operation, 'edit');
  assert.equal(request.responseLanguage, 'zh-CN');
  assert.equal(request.projectContext.actors[0].name, 'Player');
  assert.deepEqual(request.projectContext.actors[0].transform, { position: [1, 2, 3] });
  assert(!('mesh' in request.projectContext.actors[0]));
  assert(!('unrelated' in request.projectContext));
  assert.equal(payload.projectContext.actors[0].name, ' Player ');
  assert.throws(
    () => normalizeGenerationRequest({ ...payload, baseGraphRevision: '' }),
    /baseGraphRevision/
  );
});

test('a pending plan from another editor launch is regenerated instead of polling an old request', async () => {
  const context = normalizeContext(null, 'E:/World/FixtureWorld');
  context.worldGoal = {
    prompt: '上次启动的目标',
    mode: 'creative',
    source: 'ai',
    status: 'generating',
    generationId: 'previous-plan',
    modelTaskId: 'previous-model',
    transportSessionId: 'previous-launch',
    startedAt: Date.now(),
  };
  const saved = documentFixture(context);
  let calls = 0;
  mockTransport(async (request) => {
    if (request.operation === 'model.start') {
      calls++;
      return { data: { success: true, taskId: 'current-launch-model' } };
    }
    assert.notEqual(request.taskId, 'previous-model');
    return { data: { success: true, status: 'completed', content: JSON.stringify(samplePlan()) } };
  });
  const job = await aiWorkflows.startGoal({ prompt: '上次启动的目标', mode: 'creative' });
  const result = await finished(job);
  assert.equal(result.success, true, result.message);
  assert.equal(calls, 1);
  assert.equal(saved().worldGoal.transportSessionId, 'fixture-launch');
});
