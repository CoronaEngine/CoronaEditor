import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { parse, babelParse } from 'vue/compiler-sfc';
import { deferred } from './windowSessionFixtures.mjs';

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
      editorApi: { sceneTools: { listSceneTree: () => pending.promise } },
      archiveSession: { value: '' }, sceneTreeSettlement: { value: null }, sceneImages: { value: [] },
      resolveSceneTreeSnapshot: () => ({ settlement: {}, commit: true, rows: [], retryInMs: 100 }),
      applyCameraList: () => { applied++; }, scheduleSceneTreeSettleRetry: () => { scheduled++; },
      logError: (message, error) => { throw error; },
    };
    const run = new Function('scope', `with (scope) { return (${script.slice(declaration.start, declaration.end)}); }`)(scope);
    const request = run();
    active = false;
    pending.resolve({ data: { archive_session: 'archive', actors: [], cameras: [{}] } });
    await request;
    assert.equal(applied, 0);
    assert.equal(scheduled, 0);
    assert.equal(scope.archiveSession.value, '');
  });
}
