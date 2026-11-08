import { watch } from 'vue';
import { editorApi } from '../api/editorApi.js';
import { modelService, completeModel, waitForModel, parseModelJson } from './aiModelService.js';
import {
  activeProjectPath,
  roundScore,
  projectIdentity,
  readContext,
  contextTransaction,
  applyEvent,
  appendMessage,
  updateTask,
} from './cabbageDomain.js';
import { reviewGraph, generateGraph } from './aiGraphDomain.js';
import {
  normalizeGoalPlan,
  scoreEligibility,
  goalMessages,
  scoreMessages,
} from './aiPlanningDomain.js';
import { worldModeState } from './worldModeService.js';
import policy from './aiPolicy.json' with { type: 'json' };

const jobs = new Map();
const keyFor = (path) => path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
function captureProject(payload = {}) {
  return { projectPath: projectIdentity(payload), projectRevision: worldModeState.revision };
}
function jobBelongsToCurrentWorld(job) {
  return job.revision === worldModeState.revision && keyFor(job.project) === keyFor(activeProjectPath());
}
function jobIsCurrent(job) {
  return !job.controller.signal.aborted && jobBelongsToCurrentWorld(job);
}
function assertJob(job) {
  if (!jobIsCurrent(job)) throw new Error('当前任务已取消');
}
watch(
  [() => worldModeState.revision, () => keyFor(activeProjectPath())],
  () => {
    for (const job of jobs.values())
      if (job.status === 'pending' && !jobBelongsToCurrentWorld(job)) {
        job.controller.abort();
        job.status = 'cancelled';
      }
  },
  { flush: 'sync' }
);
function startJob(operation, taskId = crypto.randomUUID(), origin = captureProject()) {
  projectIdentity(origin);
  for (const [key, job] of jobs)
    if (job.status !== 'pending' && (Date.now() - job.updatedAt > 600000 || jobs.size >= 128))
      jobs.delete(key);
  if (jobs.size >= 128) throw new Error('AI 任务过多，请稍后重试');
  const job = {
    taskId,
    status: 'pending',
    controller: new AbortController(),
    project: origin.projectPath,
    revision: origin.projectRevision,
    updatedAt: Date.now(),
  };
  jobs.set(taskId, job);
  Promise.resolve()
    .then(() => {
      assertJob(job);
      return operation(job);
    })
    .then((result) => {
      assertJob(job);
      job.result = result;
      job.status = 'completed';
    })
    .catch((error) => {
      if (!jobIsCurrent(job)) {
        job.status = 'cancelled';
        return;
      }
      job.result = { success: false, status: 'error', message: String(error.message || error) };
      job.status = 'completed';
    })
    .finally(() => {
      job.updatedAt = Date.now();
    });
  return { success: true, status: 'pending', taskId };
}
function status(taskId) {
  const job = jobs.get(taskId);
  if (!job) return { success: false, error: 'TASK_NOT_FOUND' };
  return {
    success: true,
    status: job.status,
    taskId,
    ...(job.status === 'completed' ? { result: job.result } : {}),
  };
}
function cancel(taskId) {
  const job = jobs.get(taskId);
  if (!job) return { success: false, error: 'TASK_NOT_FOUND' };
  if (job.status === 'pending') {
    job.controller.abort();
    job.status = 'cancelled';
    job.updatedAt = Date.now();
  }
  return { success: true, status: job.status, taskId };
}

async function load(payload = {}) {
  const origin = captureProject(payload), path = origin.projectPath;
  const loaded = await contextTransaction(path, () => ({}), { revision: origin.projectRevision });
  projectIdentity(origin);
  const metadata = await editorApi.projectSettings.getActiveProjectInfo();
  projectIdentity(origin);
  const prompt = String(metadata?.world_prompt || metadata?.prompt || '').trim();
  if (
    prompt &&
    (loaded.context.worldGoal.prompt !== prompt ||
      loaded.context.worldGoal.mode !== 'creative' ||
      loaded.context.worldGoal.status !== 'ready')
  ) {
    const planned = await startGoal({
      ...origin,
      prompt,
      mode: 'creative',
    });
    projectIdentity(origin);
    return { ...loaded, goalPlan: planned };
  }
  return loaded;
}

async function startGoal(payload = {}) {
  const origin = captureProject(payload), path = origin.projectPath,
    prompt = String(payload.prompt || '')
      .trim()
      .slice(0, 4000),
    mode = 'creative';
  if (!prompt) {
    const result = await contextTransaction(path, (context) => {
      Object.assign(context.worldGoal, {
        prompt: '',
        mode,
        source: 'default',
        status: 'ready',
        generationId: '',
      });
      context.activeTasks = context.activeTasks.filter((t) => t.type !== 'goal');
      context.goalTaskPlan = { ...policy.defaultContext.goalTaskPlan };
      return { status: 'completed' };
    }, { revision: origin.projectRevision });
    projectIdentity(origin);
    return result;
  }
  const transportSessionId=await modelService.sessionId();
  projectIdentity(origin);
  let generationId = crypto.randomUUID();
  const claim = await contextTransaction(path, (context) => {
    const goal = context.worldGoal;
    const previous = jobs.get(goal.generationId);
    if (
      goal.prompt === prompt &&
      goal.mode === mode &&
      goal.status === 'ready' &&
      context.goalTaskPlan.taskCount
    )
      return { status: 'completed' };
    if (
      goal.prompt === prompt &&
      goal.mode === mode &&
      goal.status === 'generating' && goal.transportSessionId===transportSessionId &&
      (!previous || jobIsCurrent(previous)) &&
      Date.now() - Number(goal.startedAt || 0) < 70000
    )
      return { status: 'pending', taskId: goal.generationId };
    context.worldGoal = {
      prompt,
      mode,
      source: 'ai',
      status: 'generating',
      generationId,
      startedAt: Date.now(),
      transportSessionId,
    };
    return { status: 'pending', taskId: generationId, claimed: true };
  }, { revision: origin.projectRevision });
  projectIdentity(origin);
  if (claim.status === 'completed') return claim;
  if (!claim.claimed) {
    const existing = jobs.get(claim.taskId);
    if ((existing && jobBelongsToCurrentWorld(existing)) || !claim.context?.worldGoal.modelTaskId) return claim;
    generationId = claim.taskId;
  }
  const resumeTaskId = claim.claimed ? '' : claim.context.worldGoal.modelTaskId;
  return startJob(async (job) => {
    try {
      const options = { format: 'json', max_tokens: 3600, temperature: 0.25, timeout: 45 };
      const content = resumeTaskId
        ? await waitForModel(resumeTaskId, options, job.controller.signal)
        : await completeModel(
            goalMessages(prompt, mode),
            options,
            job.controller.signal,
            (taskId) =>
              contextTransaction(
                path,
                (context) => {
                  if (context.worldGoal.generationId !== generationId)
                    throw new Error('世界目标已变化');
                  context.worldGoal.modelTaskId = taskId;
                  return {};
                },
                { signal: job.controller.signal, revision: job.revision }
              )
          );
      const parsed = parseModelJson(content);
      assertJob(job);
      return contextTransaction(
        path,
        (context) => {
          if (context.worldGoal.generationId !== generationId) throw new Error('世界目标已变化');
          if (context.worldGoal.status === 'ready') return {};
          const { tasks, blueprint } = normalizeGoalPlan(parsed, context);
          context.activeTasks = [
            ...context.activeTasks.filter((t) => !['tutorial', 'goal'].includes(t.type)),
            ...tasks,
          ];
          Object.assign(context.worldGoal, {
            status: 'ready',
            generatedAt: Date.now(),
            generationError: '',
          });
          context.goalTaskPlan = {
            schemaVersion: 2,
            generatedAt: Date.now(),
            taskCount: tasks.length,
            nodeTaskCount: tasks.filter((t) => t.phase === 'node-logic').length,
            sceneTaskCount: tasks.filter((t) => t.phase === 'scene-polish').length,
            logicBlueprint: blueprint,
          };
          return {};
        },
        { signal: job.controller.signal, revision: job.revision }
      );
    } catch (error) {
      // Only the owner may mark its own generation failed; an older result cannot overwrite a new plan.
      if (jobIsCurrent(job))
        await contextTransaction(path, (context) => {
          if (
            context.worldGoal.generationId === generationId &&
            context.worldGoal.status !== 'ready'
          )
            Object.assign(context.worldGoal, {
              status: 'error',
              generationError: String(error.message),
            });
          return {};
        }, { signal: job.controller.signal, revision: job.revision }).catch(() => {});
      throw error;
    }
  }, generationId, origin);
}

async function goalStatus(taskId) {
  const origin = captureProject();
  const local = jobs.get(taskId);
  if (local && jobBelongsToCurrentWorld(local)) return status(taskId);
  const loaded = await readContext(origin.projectPath, { revision: origin.projectRevision }),
    goal = loaded.context.worldGoal;
  projectIdentity(origin);
  if (goal.generationId !== taskId) return { success: false, error: 'TASK_NOT_FOUND' };
  if (goal.status === 'generating' && goal.modelTaskId) {
    await startGoal({ ...origin, prompt: goal.prompt, mode: goal.mode });
    projectIdentity(origin);
    const resumed = status(taskId);
    if (resumed.success) return resumed;
  }
  if (goal.status === 'generating' && Date.now() - Number(goal.startedAt || 0) >= 70000) {
    return {
      success: true,
      status: 'completed',
      result: { success: false, message: '任务生成窗口已关闭或请求超时，请重试' },
    };
  }
  return {
    success: true,
    status: goal.status === 'generating' ? 'pending' : 'completed',
    result: goal.status === 'ready' ? loaded : { success: false, message: goal.generationError },
  };
}

async function startScore(payload = {}) {
  const origin = captureProject(payload), path = origin.projectPath;
  const existing = [...jobs.values()].find(
    (j) => j.kind === 'score' && jobIsCurrent(j) && j.status === 'pending'
  );
  if (existing) return { success: true, status: 'pending', taskId: existing.taskId };
  const { context } = await readContext(path, { revision: origin.projectRevision }),
    profile = context.profile,
    metrics = context.metrics;
  projectIdentity(origin);
  const pending = [...jobs.values()].find(
    (j) => j.kind === 'score' && jobIsCurrent(j) && j.status === 'pending'
  );
  if (pending) return { success: true, status: 'pending', taskId: pending.taskId };
  const reason = scoreEligibility(context, payload.force === true);
  if (reason) return { success: true, status: 'skipped', profile, reason };
  const started = startJob(async (job) => {
    const result = parseModelJson(
      await completeModel(
        scoreMessages(context),
        { format: 'json', max_tokens: 1200, temperature: 0.1, timeout: 35 },
        job.controller.signal
      )
    );
    if (!Number.isFinite(Number(result.score ?? result.fluencyScore))) throw new Error('评分无效');
    assertJob(job);
    return contextTransaction(
      path,
      (current) => {
        const score = Math.max(
          0,
          Math.min(100, roundScore(Number(result.score ?? result.fluencyScore)))
        );
        if (current.profile.updatedAt > profile.updatedAt) throw new Error('评分结果已过期');
        if (current.profile.updatedAt) current.profileHistory.push({ ...current.profile });
        current.profileHistory = current.profileHistory.slice(-50);
        current.profile = {
          score: current.profile.updatedAt
            ? roundScore(current.profile.score * 0.35 + score * 0.65)
            : score,
          source: 'deepseek',
          updatedAt: Date.now(),
          reasonCodes: (result.reasonCodes || []).map((v) => String(v).slice(0, 80)).slice(0, 12),
          lastScoredEventCount: metrics.importantEventCount,
        };
        return { profile: current.profile };
      },
      { signal: job.controller.signal, revision: job.revision }
    );
  }, undefined, origin);
  jobs.get(started.taskId).kind = 'score';
  return started;
}

export const aiWorkflows = {
  startReview: (payload) =>
    startJob(async (job) => {
      const result = await reviewGraph(payload, job.controller.signal);
      assertJob(job);
      return result;
    }),
  status,
  cancel,
  startGeneration: (payload) =>
    startJob(async (job) => {
      const result = await generateGraph(payload, job.controller.signal);
      assertJob(job);
      return result;
    }),
  load,
  goalStatus,
  startGoal,
  startScore,
  recordEvent: (payload) =>
    contextTransaction(projectIdentity(payload), (context) => applyEvent(context, payload)),
  updateTask: (payload) =>
    contextTransaction(projectIdentity(payload), (context) => {
      updateTask(context, payload);
      return {};
    }),
  appendMessage: (payload) =>
    contextTransaction(projectIdentity(payload), (context) => appendMessage(context, payload)),
};
