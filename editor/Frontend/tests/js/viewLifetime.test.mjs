import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { parse, babelParse } from 'vue/compiler-sfc';
import { deferred } from './windowSessionFixtures.mjs';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';

test('CameraView does not resume native initialization after unmount during its first await', async () => {
  const source = fs.readFileSync(new URL('../../src/views/tools/CameraView.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const script = descriptor.scriptSetup.content;
  const ast = babelParse(script, { sourceType: 'module' });
  const call = ast.program.body.find(node => node.type === 'ExpressionStatement'
    && node.expression.callee?.name === 'onMounted').expression;
  const hook = call.arguments[0];
  const pending = deferred();
  let active = true, loads = 0, listeners = 0, timers = 0;
  const noop = () => {};
  const scope = {
    document: { documentElement: { style: {} }, body: { style: {} } },
    viewLifetime: { current: () => active, subscribe: async () => -1 },
    syncDragRegions: () => pending.promise,
    loadCamera: async () => { loads++; }, refreshCameraViewActorPickIndex: async () => true,
    editorApi: { scene: { observe: async () => -1 } },
    window: { addEventListener: () => { listeners++; }, setInterval: () => { timers++; } },
    webMessages: { on: () => noop }, coronaEventBus: { on: () => { listeners++; } },
    errorText: { value: '' }, requestAnimationFrame: () => { timers++; }, pollScriptInputLock: async () => {},
  };
  const fallback = new Proxy(scope, { has: () => true, get: (target, key) => key === Symbol.unscopables ? undefined : target[key] ?? noop });
  const mounted = new Function('scope', `with (scope) { return (${script.slice(hook.start, hook.end)}); }`)(fallback);
  const starting = mounted();
  active = false;
  pending.resolve();
  await starting;
  assert.equal(loads, 0);
  assert.equal(listeners, 0);
  assert.equal(timers, 0);
});

test('a subscription resolving after disposal is removed and cannot deliver callbacks', async () => {
  const { createViewLifetime } = await import('../../src/utils/viewLifetime.js');
  const lifetime = createViewLifetime();
  const pending = deferred();
  let receive, calls = 0;
  const removed = [];
  const registration = lifetime.subscribe(callback => { receive = callback; return pending.promise; },
    () => { calls++; }, async token => removed.push(token));
  lifetime.dispose();
  receive({});
  pending.resolve(-7);
  assert.equal(await registration, null);
  assert.deepEqual(removed, [-7]);
  assert.equal(calls, 0);
});

for (const name of ['OnInitObjTree', 'RefreshCameraListOnly']) {
  test(`SceneBar ${name} discards a native reply received after unmount`, async () => {
    const source = fs.readFileSync(new URL('../../src/views/sidebar/SceneBar.vue', import.meta.url), 'utf8');
    const script = parse(source).descriptor.scriptSetup.content;
    const ast = babelParse(script, { sourceType: 'module' });
    const declaration = ast.program.body.flatMap(node => node.declarations || [])
      .find(node => node.id.name === name).init;
    const pending = deferred();
    let active = true, applied = 0, scheduled = 0;
    const scope = {
      currentSceneName: { value: 'scene' }, sceneTreeRequestSeq: 0,
      cameraListRefreshInFlight: false, viewLifetime: { current: () => active },
      editorApi: { scene: { readTree: () => pending.promise, readCameras: () => pending.promise } },
      archiveSession: { value: 'archive' }, sceneTreeSettlement: { value: null }, sceneImages: { value: [] },
      resolveSceneTreeSnapshot: () => ({ settlement: {}, commit: true, rows: [], retryInMs: 100 }),
      applyCameraList: () => { applied++; }, scheduleSceneTreeSettleRetry: () => { scheduled++; },
      logError: (message, error) => { throw error; },
    };
    const run = new Function('scope', `with (scope) { return (${script.slice(declaration.start, declaration.end)}); }`)(scope);
    const request = run();
    active = false;
    pending.resolve({ archive_session: 'archive', scene: 'scene', actors: [], cameras: [{}] });
    await request;
    assert.equal(applied, 0);
    assert.equal(scheduled, 0);
    assert.equal(scope.archiveSession.value, 'archive');
  });
}

function mountNodeGraphLifecycle(t) {
  const source = fs.readFileSync(new URL('../../src/blockly/components/NodeGraphWorkspace.vue', import.meta.url), 'utf8');
  const script = parse(source).descriptor.scriptSetup.content;
  const ast = babelParse(script, { sourceType: 'module' });
  const hook = name => ast.program.body.find(node => node.type === 'ExpressionStatement'
    && node.expression.callee?.name === name).expression.arguments[0];
  const tree = deferred(), actors = deferred();
  const callbacks = {}, removed = [], delivered = [];
  const noop = () => {};
  const scope = {
    Promise,
    componentMounted: false,
    activeProjectPath: { value: 'world' }, props: { sceneName: 'scene' },
    loadedArchiveSession: 'archive', loadedProjectPath: 'world',
    isFullscreen: { value: false }, isProjectTarget: { value: false },
    window: { addEventListener: noop, removeEventListener: noop, clearTimeout: noop, cancelAnimationFrame: noop },
    getNodeGraphSaves: () => ({ register: () => ({ retire: async () => {} }) }),
    editorApi: { scene: { observe: (kind, callback) => {
      callbacks[kind] = callback;
      return kind === 'selection' ? Promise.resolve(-7) : tree.promise;
    } }, off: async token => { removed.push(token); } },
    onNodeGraphActorChanged: () => delivered.push('selection'),
    onNodeGraphSceneTreeChanged: () => delivered.push('tree'),
    refreshSceneActorOptions: () => actors.promise,
    stopForPanelClose: async () => {},
    ResizeObserver: class { observe() {} disconnect() {} },
    workspaceRootRef: { value: null },
  };
  scope.viewLifetime = createViewLifetime(() => scope.componentMounted);
  const fallback = new Proxy(scope, { has: () => true,
    get: (target, key) => key === Symbol.unscopables ? undefined : key in target ? target[key] : noop });
  const evaluate = name => {
    const value = hook(name);
    return new Function('scope', `with (scope) { return (${script.slice(value.start, value.end)}); }`)(fallback);
  };
  const mounting = evaluate('onMounted')();
  const unmount = evaluate('onBeforeUnmount');
  let retired = false;
  const retire = () => { if (!retired) { retired = true; unmount(); } };
  t.after(async () => { retire(); tree.resolve(-8); actors.resolve(false); await mounting; });
  return { tree, callbacks, removed, delivered, retire };
}

test('NodeGraph owns a completed native subscription while another registration is still pending', async t => {
  const page = mountNodeGraphLifecycle(t);
  await new Promise(resolve => setTimeout(resolve, 0));
  page.retire();
  assert.deepEqual(page.removed, [-7], 'the completed selection subscription must be released without waiting for tree registration');
  page.tree.resolve(-8);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(page.removed, [-7, -8]);
});

test('NodeGraph native callbacks queued before unsubscription cannot deliver after retirement', async t => {
  const page = mountNodeGraphLifecycle(t);
  page.retire();
  page.callbacks.selection({});
  page.callbacks.tree({ archive_session: 'reopened' });
  assert.deepEqual(page.delivered, []);
});

test('NodeGraph retires a subscription between native registration and its consumer continuation', async t => {
  const page = mountNodeGraphLifecycle(t);
  // subscribe resumes first; the consumer continuation is still queued when
  // this await resumes. No token has reached a component field yet.
  await Promise.resolve();
  page.retire();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(page.removed, [-7]);
});

test('view lifetime owns completed registrations and releases each exactly once', async () => {
  const lifetime = createViewLifetime();
  const removed = [];
  await lifetime.subscribe(async () => -7, () => {}, async token => removed.push(token));
  lifetime.dispose();
  lifetime.dispose();
  assert.deepEqual(removed, [-7]);
});

test('view lifetime reports cleanup failures and still releases every other registration', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const lifetime = createViewLifetime();
  const removed = [];
  const syncFailure = new Error('sync cleanup failure'), asyncFailure = new Error('async cleanup failure');
  await lifetime.subscribe(async () => 1, () => {}, () => { throw syncFailure; });
  await lifetime.subscribe(async () => 2, () => {}, async () => { throw asyncFailure; });
  await lifetime.subscribe(async () => -7, () => {}, async token => removed.push(token));
  await lifetime.dispose();
  await lifetime.dispose();
  assert.deepEqual(removed, [-7]);
  assert.deepEqual(warning.mock.calls.map(call => call.arguments[1]), [syncFailure, asyncFailure]);
});

test('retired lifetime never registers new native work', async () => {
  const lifetime = createViewLifetime();
  await lifetime.dispose();
  let registrations = 0;
  assert.equal(await lifetime.subscribe(() => { registrations++; return -7; }, () => {}, () => {}), null);
  assert.equal(registrations, 0);
});
