import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { setImmediate as flush } from 'node:timers/promises';
import { effectScope } from 'vue';
import { getWebMessages } from '../../src/api/webMessages.js';
import { worldModeState } from '../../src/services/worldModeService.js';
import { aiService } from '../../src/services/aiService.js';
import { deferred, memoryStorage } from './windowSessionFixtures.mjs';

registerHooks({
  resolve(specifier, context, next) {
    return next(specifier.startsWith('@/') ? new URL(`../../src/${specifier.slice(2)}`, import.meta.url).href : specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('?raw')) return { format: 'module', shortCircuit: true,
      source: `export default ${JSON.stringify(readFileSync(new URL(url.slice(0, -4)), 'utf8'))}` };
    return next(url, context);
  },
});

async function fixture(t) {
  const previousWindow = globalThis.window, previousWorld = { ...worldModeState };
  const timers = new Map();
  let timerId = 0;
  const main = Object.assign(new EventTarget(), {
    sessionStorage: memoryStorage(), localStorage: memoryStorage(), location: { hash: '#/' },
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  main.sessionStorage.setItem('corona.editorUi.owner', crypto.randomUUID());
  globalThis.window = main;
  Object.assign(worldModeState, { status: 'ready', revision: 1, activeProjectPath: 'D:/worlds/First' });
  const messages = getWebMessages(main);
  const service = await import(`../../src/services/cabbageAssistantContextService.js?score=${crypto.randomUUID()}`);
  const starts = [], polls = [], records = [], loads = [], goals = [], goalPolls = [], warnings = [];
  t.mock.method(aiService, 'startCabbageProfileScoreUpdate', options => {
    const call = { ...deferred(), options }; starts.push(call); return call.promise;
  });
  t.mock.method(aiService, 'getCabbageProfileScoreStatus', taskId => {
    const call = { ...deferred(), taskId }; polls.push(call); return call.promise;
  });
  t.mock.method(aiService, 'recordCabbageEvent', event => {
    const call = { ...deferred(), event }; records.push(call); return call.promise;
  });
  for (const [name, calls] of [['loadCabbageContext', loads], ['startCabbageGoalPlan', goals],
    ['getCabbageGoalPlanStatus', goalPolls]]) {
    t.mock.method(aiService, name, input => {
      const call = { ...deferred(), input }; calls.push(call); return call.promise;
    });
  }
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  function seed(score) { return service.publishCabbageAssistantContext({ profile: { score } }); }
  seed(10);
  function switchWorld({ path = 'D:/worlds/Second', revision = worldModeState.revision + 1, status = 'ready' } = {}) {
    Object.assign(worldModeState, { activeProjectPath: path, revision, status });
    seed(20);
  }
  t.after(async () => {
    worldModeState.status = 'idle';
    worldModeState.revision++;
    for (const call of starts) call.resolve({ success: false });
    for (const call of polls) call.resolve({ success: false });
    for (const call of records) call.resolve({ success: false });
    for (const call of [...loads, ...goals, ...goalPolls]) call.resolve({ success: false });
    await flush();
    timers.clear();
    messages.dispose();
    Object.assign(worldModeState, previousWorld);
    globalThis.window = previousWindow;
  });
  return { service, timers, starts, polls, records, loads, goals, goalPolls, warnings, switchWorld,
    score: () => service.readCabbageAssistantContext()?.profile.score };
}

test('current-world skipped score still updates the context', async t => {
  const f = await fixture(t);
  const request = f.service.requestProfileScoreUpdate({ force: true });
  const response = { success: true, status: 'skipped', profile: { score: 30 } };
  f.starts[0].resolve(response);
  assert.deepEqual(await request, response);
  assert.equal(f.score(), 30);
});

for (const change of ['revision', 'path', 'readiness']) {
  test(`delayed skipped score cannot publish after a world ${change} change`, async t => {
    const f = await fixture(t);
    const request = f.service.requestProfileScoreUpdate();
    if (change === 'revision') f.switchWorld({ path: 'D:/worlds/First' });
    if (change === 'path') f.switchWorld({ revision: 1 });
    if (change === 'readiness') f.switchWorld({ path: 'D:/worlds/First', revision: 1, status: 'loading' });
    f.starts[0].resolve({ success: true, status: 'skipped', profile: { score: 99 } });
    assert.equal(await request, null);
    assert.equal(f.score(), 20);
  });
}

test('a late startup task id never starts polling in the replacement world', async t => {
  const f = await fixture(t);
  const request = f.service.requestProfileScoreUpdate();
  f.switchWorld();
  f.starts[0].resolve({ success: true, taskId: 'old' });
  assert.equal(await request, null);
  assert.equal(f.polls.length, 0);
});

test('concurrent startup requests share one start and one poll', async t => {
  const f = await fixture(t);
  const first = f.service.requestProfileScoreUpdate();
  const second = f.service.requestProfileScoreUpdate();
  f.starts[0].resolve({ success: true, taskId: 'shared' });
  // Resolve any duplicate startup too, so a regression fails without hanging.
  for (const call of f.starts.slice(1)) call.resolve({ success: true, taskId: 'shared' });
  await Promise.all([first, second]);
  assert.equal(f.starts.length, 1);
  assert.equal(f.polls.length, 1);
  assert.deepEqual(await f.service.requestProfileScoreUpdate(), { success: true, status: 'pending', taskId: 'shared' });
});

for (const outcome of ['success', 'failure', 'error']) {
  test(`an old poll ${outcome} cannot retire a replacement task with the same id`, async t => {
    const f = await fixture(t);
    const old = f.service.requestProfileScoreUpdate();
    f.starts[0].resolve({ success: true, taskId: 'reused' });
    await old;
    f.switchWorld();
    const current = f.service.requestProfileScoreUpdate();
    assert.equal(f.starts.length, 2, 'replacement world must be able to start immediately');
    f.starts[1].resolve({ success: true, taskId: 'reused' });
    await current;
    if (outcome === 'error') f.polls[0].reject(new Error('obsolete failure'));
    else f.polls[0].resolve({ success: outcome === 'success', status: 'completed', result: { success: true, profile: { score: 99 } } });
    await flush();
    assert.equal(f.score(), 20);
    assert.equal(f.warnings.length, 0);
    assert.deepEqual(await f.service.requestProfileScoreUpdate(), { success: true, status: 'pending', taskId: 'reused' });
    f.polls[1].resolve({ success: true, status: 'completed', result: { success: true, profile: { score: 40 } } });
    await flush();
    assert.equal(f.score(), 40);
  });
}

test('world retirement cancels the wait and queued old callbacks cannot poll again', async t => {
  const f = await fixture(t);
  const request = f.service.requestProfileScoreUpdate();
  f.starts[0].resolve({ success: true, taskId: 'waiting' });
  await request;
  f.polls[0].resolve({ success: true, status: 'pending' });
  await flush();
  assert.equal(f.timers.size, 1);
  const callback = [...f.timers.values()][0];
  f.switchWorld();
  assert.equal(f.timers.size, 0);
  callback();
  await flush();
  assert.equal(f.polls.length, 1);
});

test('leaving and reentering the same world before startup settles still retires it', async t => {
  const f = await fixture(t);
  const request = f.service.requestProfileScoreUpdate();
  worldModeState.status = 'loading';
  worldModeState.status = 'ready';
  f.starts[0].resolve({ success: true, status: 'skipped', profile: { score: 99 } });
  assert.equal(await request, null);
  assert.equal(f.score(), 10);
});

test('unready worlds do not start score work', async t => {
  const f = await fixture(t);
  worldModeState.status = 'loading';
  const request = f.service.requestProfileScoreUpdate();
  for (const call of f.starts) call.resolve({ success: false });
  assert.equal(await request, null);
  assert.equal(f.starts.length, 0);
});

test('current startup errors still propagate and permit a fresh request', async t => {
  const f = await fixture(t);
  const request = f.service.requestProfileScoreUpdate();
  f.starts[0].reject(new Error('current failure'));
  await assert.rejects(request, /current failure/);
  const retry = f.service.requestProfileScoreUpdate();
  assert.equal(f.starts.length, 2);
  f.starts[1].resolve({ success: false });
  await retry;
});

test('obsolete startup errors settle quietly without touching replacement work', async t => {
  const f = await fixture(t);
  const old = f.service.requestProfileScoreUpdate();
  f.switchWorld();
  const current = f.service.requestProfileScoreUpdate();
  f.starts[1].resolve({ success: true, taskId: 'new' });
  await current;
  f.starts[0].reject(new Error('obsolete failure'));
  assert.equal(await old, null);
  assert.deepEqual(await f.service.requestProfileScoreUpdate(), { success: true, status: 'pending', taskId: 'new' });
});

test('current polling errors report once and permit a fresh request', async t => {
  const f = await fixture(t);
  const request = f.service.requestProfileScoreUpdate();
  f.starts[0].resolve({ success: true, taskId: 'failed' });
  await request;
  f.polls[0].reject(new Error('current poll failure'));
  await flush();
  assert.equal(f.warnings.length, 1);
  const retry = f.service.requestProfileScoreUpdate();
  assert.equal(f.starts.length, 2);
  f.starts[1].resolve({ success: false });
  await retry;
});

test('view unmount keeps world scoring alive but does not detach its retirement guard', async t => {
  const f = await fixture(t);
  const view = effectScope();
  const request = view.run(() => f.service.requestProfileScoreUpdate());
  f.starts[0].resolve({ success: true, taskId: 'world-owned' });
  await request;
  view.stop();
  f.polls[0].resolve({ success: true, status: 'pending' });
  await flush();
  assert.equal(f.timers.size, 1, 'world scoring survives view unmount');
  f.switchWorld();
  assert.equal(f.timers.size, 0, 'world retirement still cancels its timer after view unmount');
});

for (const trigger of ['run_succeeded', 'completedTaskKeys']) {
  for (const change of ['revision', 'path', 'readiness']) {
    test(`late ${trigger} event cannot start scoring after world ${change} changes`, async t => {
      const f = await fixture(t);
      const request = f.service.recordEvent({ type: trigger === 'completedTaskKeys' ? 'panel_opened' : trigger });
      await flush();
      assert.equal(f.records.length, 1);
      if (change === 'revision') f.switchWorld({ path: 'D:/worlds/First' });
      if (change === 'path') f.switchWorld({ revision: 1 });
      if (change === 'readiness') f.switchWorld({ path: 'D:/worlds/First', revision: 1, status: 'loading' });
      const response = { success: true, completedTaskKeys: trigger === 'completedTaskKeys' ? ['task'] : [],
        context: { worldId: 'First', profile: { score: 99 } } };
      f.records[0].resolve(response);
      await request;
      assert.equal(f.starts.length, 0, 'old event must not initiate scoring in a new world');
      assert.equal(f.score(), 20);
    });
  }
}

test('current events still publish their context and start one score update', async t => {
  const f = await fixture(t);
  const request = f.service.recordEvent({ type: 'run_succeeded' });
  await flush();
  f.records[0].resolve({ success: true, context: { worldId: 'First', profile: { score: 30 } } });
  await request;
  assert.equal(f.starts.length, 1);
  assert.equal(f.score(), 30);
});

test('an event queued behind a native reply is retired before reaching the replacement world', async t => {
  const f = await fixture(t);
  const first = f.service.recordEvent({ type: 'panel_opened' });
  await flush();
  const queued = f.service.recordEvent({ type: 'run_succeeded' });
  f.switchWorld();
  f.records[0].resolve({ success: true });
  await first;
  await flush();
  // Settle a regressed dispatch too, so the test fails without leaving live work.
  for (const call of f.records.slice(1)) call.resolve({ success: true });
  await queued;
  assert.equal(f.records.length, 1, 'queued old work must not reach the next world');
  assert.equal(f.starts.length, 0);
});

for (const outcome of ['rejected', 'unsuccessful']) {
  test(`obsolete world context ${outcome} load settles without a new-world error`, async t => {
    const f = await fixture(t);
    const request = f.service.loadCurrentWorld();
    f.switchWorld();
    if (outcome === 'rejected') f.loads[0].reject(new Error('old load failed'));
    else f.loads[0].resolve({ success: false, message: 'old load failed' });
    assert.equal(await request, null);
    assert.equal(f.score(), 20);
  });
}

test('current world load failures remain visible to the caller', async t => {
  const f = await fixture(t);
  const request = f.service.loadCurrentWorld();
  f.loads[0].reject(new Error('current load failed'));
  await assert.rejects(request, /current load failed/);
});

test('obsolete goal startup failures settle without a new-world error', async t => {
  const f = await fixture(t);
  const request = f.service.initializeWorldTasks({ prompt: 'First' });
  f.switchWorld();
  f.goals[0].reject(new Error('old planning failed'));
  assert.equal(await request, null);
});

test('a changed project path retires a goal startup before any status request', async t => {
  const f = await fixture(t);
  const request = f.service.initializeWorldTasks({ prompt: 'First' });
  f.switchWorld({ revision: 1 });
  f.goals[0].resolve({ success: true, taskId: 'old-plan' });
  await flush();
  for (const poll of f.goalPolls) poll.resolve({ success: true, status: 'completed',
    result: { success: true, context: { worldId: 'First' } } });
  assert.equal(await request, null);
  assert.equal(f.goalPolls.length, 0, 'old-world task must not be looked up against the new project');
});

for (const waitForCompletion of [true, false]) {
  test(`obsolete goal poll errors are retired with waitForCompletion=${waitForCompletion}`, async t => {
    const f = await fixture(t);
    const request = f.service.initializeWorldTasks({ prompt: 'First', waitForCompletion });
    f.goals[0].resolve({ success: true, taskId: 'old-plan' });
    await flush();
    assert.equal(f.goalPolls.length, 1);
    f.switchWorld();
    f.goalPolls[0].reject(new Error('old poll failed'));
    const result = await request;
    await flush();
    if (waitForCompletion) assert.equal(result, null);
    else assert.deepEqual(result, { success: true, status: 'pending', taskId: 'old-plan' });
    assert.equal(f.warnings.length, 0, 'retired background errors must not notify the new world');
  });
}

test('same-path reopening starts a new goal poll even when the backend reuses a task id', async t => {
  const f = await fixture(t);
  const first = f.service.initializeWorldTasks({ prompt: 'First' });
  f.goals[0].resolve({ success: true, taskId: 'reused-goal' });
  await flush();
  f.switchWorld({ path: 'D:/worlds/First' });
  const current = f.service.initializeWorldTasks({ prompt: 'Reopened' });
  f.goals[1].resolve({ success: true, taskId: 'reused-goal' });
  await flush();
  const count = f.goalPolls.length;
  f.goalPolls[0].resolve({ success: true, status: 'completed',
    result: { success: true, context: { worldId: 'First', profile: { score: 99 } } } });
  if (f.goalPolls[1]) f.goalPolls[1].resolve({ success: true, status: 'completed',
    result: { success: true, context: { worldId: 'First', profile: { score: 40 } } } });
  await Promise.all([first, current]);
  assert.equal(count, 2);
  assert.equal(f.score(), 40);
});

test('current goal completion still publishes context and returns the active snapshot', async t => {
  const f = await fixture(t);
  const request = f.service.initializeWorldTasks({ prompt: 'First' });
  f.goals[0].resolve({ success: true, taskId: 'current-plan' });
  await flush();
  f.goalPolls[0].resolve({ success: true, status: 'completed',
    result: { success: true, context: { worldId: 'First', profile: { score: 40 } } } });
  assert.equal((await request).profile.score, 40);
  assert.equal(f.score(), 40);
});

test('current goal poll errors remain visible to the caller', async t => {
  const f = await fixture(t);
  const request = f.service.initializeWorldTasks({ prompt: 'First' });
  f.goals[0].resolve({ success: true, taskId: 'current-plan' });
  await flush();
  f.goalPolls[0].reject(new Error('current planning failed'));
  await assert.rejects(request, /current planning failed/);
});
