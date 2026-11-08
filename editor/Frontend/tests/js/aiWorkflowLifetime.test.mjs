import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { setImmediate as flush } from 'node:timers/promises';
import { editorApi } from '../../src/api/editorApi.js';
import { modelService } from '../../src/services/aiModelService.js';
import { worldModeState } from '../../src/services/worldModeService.js';
import { deferred, memoryStorage } from './windowSessionFixtures.mjs';

registerHooks({
  load(url, context, next) {
    if (url.endsWith('?raw')) return { format: 'module', shortCircuit: true,
      source: `export default ${JSON.stringify(readFileSync(new URL(url.slice(0, -4)), 'utf8'))}` };
    return next(url, context);
  },
});

async function fixture(t) {
  const previousWindow = globalThis.window, previousWorld = { ...worldModeState };
  globalThis.window = Object.assign(new EventTarget(), { localStorage: memoryStorage(), setTimeout, clearTimeout });
  Object.assign(worldModeState, { activeProjectPath: 'D:/worlds/Workflow', status: 'ready', revision: previousWorld.revision + 1 });
  const { normalizeContext, readContext } = await import('../../src/services/cabbageDomain.js');
  const { aiWorkflows } = await import('../../src/services/aiWorkflows.js');
  let document = normalizeContext(null, worldModeState.activeProjectPath), archive = crypto.randomUUID(), version = 0;
  document.profile = { score: 50, updatedAt: 1000, lastScoredEventCount: 0 };
  document.metrics.nodeEdits = 2;
  const reads = [], commits = [], starts = [], cancels = [], releases = [];
  t.mock.method(editorApi.scene, 'readActive', async () => ({ archive_session: archive, project_path: worldModeState.activeProjectPath }));
  t.mock.method(editorApi.projectSettings, 'readProjectDocument', async request => {
    reads.push(request);
    return { success: true, content: structuredClone(document), revision: String(version) };
  });
  t.mock.method(editorApi.projectSettings, 'commitProjectDocument', async request => {
    if (request.archive_session !== archive) return { success: false, error: 'PROJECT_CONTEXT_CHANGED' };
    if (request.revision !== String(version)) return { success: false, error: 'DOCUMENT_CONFLICT' };
    document = structuredClone(request.content);
    commits.push(structuredClone(request)); version++;
    return { success: true };
  });
  t.mock.method(editorApi.projectSettings, 'getActiveProjectInfo', async () => ({ world_prompt: 'A world goal' }));
  t.mock.method(modelService, 'sessionId', async () => 'workflow-session');
  t.mock.method(modelService, 'start', async payload => {
    const taskId = crypto.randomUUID(); starts.push({ ...payload, taskId }); return { success: true, taskId };
  });
  t.mock.method(modelService, 'status', async () => ({ status: 'completed', content: '{"score":90}' }));
  t.mock.method(modelService, 'cancel', async taskId => { cancels.push(taskId); return { success: true }; });
  function holdOnce(object, name) {
    const original = object[name], started = deferred(), release = deferred();
    let held = false;
    releases.push(release);
    t.mock.method(object, name, async (...args) => {
      const value = await original(...args);
      if (held) return value;
      held = true; started.resolve();
      await release.promise;
      return value;
    });
    return { started: started.promise, release: release.resolve };
  }
  function reopen({ path = worldModeState.activeProjectPath, incrementRevision = true } = {}) {
    archive = crypto.randomUUID();
    Object.assign(worldModeState, { activeProjectPath: path,
      revision: worldModeState.revision + Number(incrementRevision) });
  }
  async function settled(job) {
    for (let index = 0; index < 40; index++) {
      const state = aiWorkflows.status(job.taskId);
      if (state.status !== 'pending') { await flush(); return state; }
      await flush();
    }
    assert.fail('workflow did not settle');
  }
  t.after(async () => {
    worldModeState.revision++;
    for (const release of releases) release.resolve();
    await flush(); await flush();
    Object.assign(worldModeState, previousWorld);
    globalThis.window = previousWindow;
  });
  return { aiWorkflows, readContext, holdOnce, reopen, settled, reads, commits, starts, cancels,
    document: () => document, project: () => worldModeState.activeProjectPath };
}

for (const boundary of ['readActive', 'readProjectDocument']) {
  test(`same-path reopening retires a context read waiting on ${boundary}`, async t => {
    const f = await fixture(t);
    const hold = f.holdOnce(boundary === 'readActive' ? editorApi.scene : editorApi.projectSettings, boundary);
    const request = f.readContext(f.project());
    await hold.started;
    f.reopen(); hold.release();
    await assert.rejects(request, /切换|取消/);
    if (boundary === 'readActive') assert.equal(f.reads.length, 0, 'retired scope must not start a document read');
  });
}

for (const force of [true, false]) {
  test(`a score read cannot become a new-world job or skipped profile (force=${force})`, async t => {
    const f = await fixture(t);
    if (!force) f.document().metrics.nodeEdits = 0;
    const hold = f.holdOnce(editorApi.projectSettings, 'readProjectDocument');
    const request = f.aiWorkflows.startScore({ force });
    await hold.started;
    f.reopen(); hold.release();
    await assert.rejects(request, /切换|取消/);
    assert.equal(f.starts.length, 0);
    assert.equal(f.commits.length, 0);
  });
}

for (const boundary of ['sessionId', 'commitProjectDocument']) {
  test(`goal startup retains its origin while waiting on ${boundary}`, async t => {
    const f = await fixture(t);
    const hold = f.holdOnce(boundary === 'sessionId' ? modelService : editorApi.projectSettings, boundary);
    const request = f.aiWorkflows.startGoal({ prompt: 'A world goal' });
    await hold.started;
    const before = f.commits.length;
    f.reopen(); hold.release();
    await assert.rejects(request, /切换|取消/);
    assert.equal(f.starts.length, 0, 'old startup must not create a model task in the reopened world');
    assert.equal(f.commits.length, before);
  });
}

test('a load awaiting project metadata cannot generate goals after same-path reopening', async t => {
  const f = await fixture(t);
  const hold = f.holdOnce(editorApi.projectSettings, 'getActiveProjectInfo');
  const request = f.aiWorkflows.load();
  await hold.started;
  const before = f.commits.length;
  f.reopen(); hold.release();
  await assert.rejects(request, /切换|取消/);
  assert.equal(f.starts.length, 0);
  assert.equal(f.commits.length, before);
});

test('an old goal model failure cannot write an error into the reopened document', async t => {
  const f = await fixture(t);
  const hold = f.holdOnce(modelService, 'status');
  const job = await f.aiWorkflows.startGoal({ prompt: 'A world goal' });
  await hold.started;
  const before = f.commits.length, goal = structuredClone(f.document().worldGoal);
  f.reopen(); hold.release();
  await f.settled(job);
  assert.equal(f.commits.length, before, 'retired catch must not commit against the reopened archive');
  assert.deepEqual(f.document().worldGoal, goal);
});

test('current goal failures still persist their own error and complete the job', async t => {
  const f = await fixture(t);
  t.mock.method(modelService, 'status', async () => ({ status: 'error', message: 'current provider failed' }));
  const job = await f.aiWorkflows.startGoal({ prompt: 'A world goal' });
  const state = await f.settled(job);
  assert.equal(state.status, 'completed');
  assert.equal(state.result.success, false);
  assert.equal(f.document().worldGoal.status, 'error');
  assert.match(f.document().worldGoal.generationError, /current provider failed/);
});

test('a same-path reopened goal owns a fresh job instead of returning an old cancelled job', async t => {
  const f = await fixture(t);
  const hold = f.holdOnce(modelService, 'status');
  const first = await f.aiWorkflows.startGoal({ prompt: 'A world goal' });
  await hold.started;
  assert.equal(f.document().worldGoal.status, 'generating');
  f.reopen();
  const resumed = await f.aiWorkflows.startGoal({ prompt: 'A world goal' });
  await flush();
  const state = f.aiWorkflows.status(resumed.taskId);
  hold.release();
  await flush();
  assert.notEqual(resumed.taskId, first.taskId);
  assert.notEqual(state.status, 'cancelled', 'new world must own a fresh job for the persisted model');
  assert.equal(f.starts.length, 2, 'the retired provider request has been cancelled');
});

test('goal status cannot return a persisted old-world result after its context read is retired', async t => {
  const f = await fixture(t);
  const goal = f.document().worldGoal;
  Object.assign(goal, { generationId: 'persisted-' + crypto.randomUUID(), status: 'ready' });
  const hold = f.holdOnce(editorApi.projectSettings, 'readProjectDocument');
  const request = f.aiWorkflows.goalStatus(goal.generationId);
  await hold.started;
  f.reopen(); hold.release();
  await assert.rejects(request, /切换|取消/);
});

test('changing the active project path cancels a model wait even before revision publication', async t => {
  const f = await fixture(t);
  const hold = f.holdOnce(modelService, 'status');
  const job = await f.aiWorkflows.startScore({ force: true });
  await hold.started;
  f.reopen({ path: 'D:/other/Workflow', incrementRevision: false });
  assert.equal(f.aiWorkflows.status(job.taskId).status, 'cancelled');
  assert.ok(f.cancels.length > 0);
  hold.release();
});

test('current concurrent scoring still shares one job and preserves smoothing', async t => {
  const f = await fixture(t);
  const [first, second] = await Promise.all([f.aiWorkflows.startScore({ force: true }), f.aiWorkflows.startScore({ force: true })]);
  assert.equal(first.taskId, second.taskId);
  const state = await f.settled(first);
  assert.equal(state.result.success, true);
  assert.equal(f.starts.length, 1);
  assert.equal(f.document().profile.score, 76);
  assert.equal(f.document().profileHistory.length, 1);
});

test('reopening a cancelled goal regenerates it instead of polling its cancelled provider', async t => {
  const f = await fixture(t);
  const plan = {
    logicBlueprint: { worldSummary: 'World', coreLoop: 'Move and check', requiredActors: ['Player'],
      flow: ['Enter', 'Move', 'Verify'], nodeEffects: ['enter', 'move'].map(effectId => ({
        effectId, title: effectId, description: 'Apply effect', verification: 'Visible result', recommendedBlockTypes: ['node_when_enter'],
      })) },
    tasks: ['node_created', 'block_added', 'block_parameter_changed', 'nodes_connected', 'run_succeeded', 'model_imported']
      .map((completionSignal, index) => ({ phase: index < 5 ? 'node-logic' : 'scene-polish',
        effectId: index < 5 ? (index % 2 ? 'enter' : 'move') : '', title: 'Task ' + index,
        message: 'Do it', suggestion: 'Apply', completionCriteria: 'Verify', completionSignal,
        requiredBlockTypes: ['block_added', 'block_parameter_changed'].includes(completionSignal) ? ['node_when_enter'] : [],
      })),
  };
  t.mock.method(modelService, 'status', async taskId => f.cancels.includes(taskId)
    ? { status: 'cancelled' } : { status: 'completed', content: JSON.stringify(plan) });
  const hold = f.holdOnce(modelService, 'status');
  const first = await f.aiWorkflows.startGoal({ prompt: 'A world goal' });
  await hold.started;
  f.reopen();
  const current = await f.aiWorkflows.startGoal({ prompt: 'A world goal' });
  const state = await f.settled(current);
  hold.release(); await flush();
  assert.equal(state.result?.success, true, state.result?.message);
  assert.notEqual(current.taskId, first.taskId);
  assert.equal(f.starts.length, 2);
  assert.equal(f.document().worldGoal.status, 'ready');
  assert.equal(f.document().goalTaskPlan.taskCount, 6);
});
