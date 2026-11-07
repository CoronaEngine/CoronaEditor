import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import * as Vue from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { babelParse, compileScript, parse } from 'vue/compiler-sfc';
import * as worldMode from '../../src/services/worldModeService.js';

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const { descriptor } = parse(fs.readFileSync(new URL('../../src/App.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'app-world-initialization', genDefaultAs: 'App' });
const imports = babelParse(compiled.content, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'ImportDeclaration');
let source = compiled.content;
for (const node of [...imports].reverse()) {
  const bindings = node.specifiers.map(specifier =>
    `${JSON.stringify(specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name)}: ${specifier.local.name}`);
  source = source.slice(0, node.start) + `const {${bindings}} = modules[${JSON.stringify(node.source.value)}];` + source.slice(node.end);
}
const makeApp = new Function('modules', 'window', 'document', 'setInterval', 'clearInterval', `${source}; return App;`);

for (const first of ['guard', 'observer']) {
  test(`App project sampling and initial route share metadata when ${first} starts first`, async t => {
    const read = deferred();
    let reads = 0, observer;
    const mounted = [], unmounted = [], errors = [];
    const state = Vue.shallowReactive({ status: 'idle', revision: 0 });
    const controller = worldMode.createWorldModeController({
      readProjectInfo: () => { reads++; return read.promise; },
      publish: value => Object.assign(state, value),
    });
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/', component: {} }, { path: '/Object', component: {} },
    ] });
    router.beforeEach(worldMode.createWorldModeRouteGuard({
      controller, closePanel: async () => errors.push('closed'), notify: error => errors.push(error),
    }));
    const noop = () => {};
    const modules = Object.fromEntries(imports.map(node => [node.source.value, {}]));
    Object.assign(modules, {
      vue: { ...Vue, onMounted: hook => mounted.push(hook), onUnmounted: hook => unmounted.push(hook) },
      'vue-router': { useRoute: () => Vue.reactive({
        get path() { return router.currentRoute.value.path; },
        get query() { return router.currentRoute.value.query; },
        get matched() { return router.currentRoute.value.matched; },
      }), useRouter: () => router },
      '@/services/worldModeService.js': { ...worldMode, worldModeService: controller,
        worldModeState: state, editorUiAllowed: () => state.status === 'ready' && state.mode === 'creative' },
      '@/stores/dockStore.js': { useDockStore: () => ({ clearSession: noop }) },
      '@/services/appService.js': { appService: {} },
      '@/api/editorApi.js': { editorApi: {
        scene: { observe: async (_topic, handler) => { observer = handler; return 1; } },
        events: { onLanChatEvent: async () => 2 }, off: async () => {},
      } },
      '@/utils/eventBus.js': { coronaEventBus: { on: noop, off: noop } },
      '@/services/worldSessionLifecycle.js': { notifyWorldError: error => errors.push(error) },
      '@/services/projectMessages.js': { subscribeProjectChanged: () => noop },
      '@/api/webMessages.js': { getWebMessages: () => ({ on: () => noop }) },
      '@/api/webDocument.js': { getWebDocumentIdentity: () => ({ role: 'peer' }) },
      '@/services/windowSessionState.js': { WINDOW_SESSION_POLICY_EVENT: 'windowSession.policyChanged' },
    });
    const host = { addEventListener: noop, removeEventListener: noop };
    const app = makeApp(modules, host, host, () => 1, noop);
    const scope = Vue.effectScope();
    const page = scope.run(() => app.setup({}, { expose: noop }));
    t.after(() => { unmounted.forEach(hook => hook()); scope.stop(); });
    mounted.forEach(hook => hook());
    let navigation;
    if (first === 'guard') {
      navigation = router.push('/Object?standalone=1');
      while (!reads) await new Promise(resolve => setImmediate(resolve));
    }
    observer({ path: 'D:/world', archive_session: 'archive-1' });
    navigation ??= router.push('/Object?standalone=1');
    await new Promise(resolve => setImmediate(resolve));
    read.resolve({ project_path: 'D:/world', mode: 'creative' });
    await navigation;
    await Vue.nextTick();
    assert.equal(router.currentRoute.value.path, '/Object', 'initial navigation must commit');
    assert.equal(page.worldReady.value, true);
    assert.equal(page.mayRenderRoute.value, true);
    assert.equal(reads, 1, 'the initial observation must reuse the route metadata read');
    assert.deepEqual(errors, []);
  });
}
