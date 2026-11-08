import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers';
import * as Vue from 'vue';
import { createPinia, defineStore } from 'pinia';
import { babelParse, compileScript, parse } from 'vue/compiler-sfc';
import { compile } from '@vue/compiler-ssr';
import { renderToString } from '@vue/server-renderer';
import * as manifests from '../../src/config/pluginManifest.js';
import { createNativePanelHosts } from '../../src/services/nativePanelHosts.js';
import { createViewLifetime } from '../../src/utils/viewLifetime.js';

const require = createRequire(import.meta.url);
const source = path => fs.readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');

// Render the real App and native panel host. Native window/route services
// are injected because this test runs without a CEF process or graphics device.
function component(path, modules, window) {
  const { descriptor } = parse(source(path));
  const script = compileScript(descriptor, { id: path, genDefaultAs: 'Component' });
  const imports = babelParse(script.content, { sourceType: 'module' }).program.body
    .filter(node => node.type === 'ImportDeclaration');
  let setup = script.content;
  for (const node of [...imports].reverse()) {
    const bindings = node.specifiers.map(specifier => {
      const name = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name;
      return `${JSON.stringify(name)}: ${specifier.local.name}`;
    }).join(', ');
    setup = setup.slice(0, node.start)
      + `const { ${bindings} } = modules[${JSON.stringify(node.source.value)}];`
      + setup.slice(node.end);
  }
  const result = new Function('modules', 'window', `${setup}; return Component;`)(modules, window);
  const { code } = compile(descriptor.template.content, { mode: 'function', bindingMetadata: script.bindings });
  result.ssrRender = new Function('require', code)(require);
  return result;
}

async function renderApp({ path = '/', standalone = false, mode = 'creative' } = {}) {
  const worldModeState = Vue.shallowReactive({
    status: 'ready', mode, projectPath: 'D:/worlds/kitchen', revision: 1,
  });
  const editorUiAllowed = () => worldModeState.status === 'ready';
  const storeSource = source('stores/dockStore.js').replace(/^import .*;\r?\n/gm, '')
    .replace('export const useDockStore', 'const useDockStore');
  const useDockStore = new Function('defineStore', 'PLUGIN_MANIFEST', 'editorUiAllowed',
    `${storeSource}; return useDockStore;`)(defineStore, manifests.PLUGIN_MANIFEST, editorUiAllowed);
  const pinia = createPinia();
  const store = useDockStore(pinia);
  for (const id of ['SceneControls', 'SceneTools', 'EditorSettings', 'NodeGraphPanel']) store.openPanel(id);
  const opened = [];

  const window = { corona: { window: { suspendCameraViews() {} } } };
  const noop = () => {};
  const asyncNoop = async () => {};
  const appService = {
    onWindowClosed: () => noop,
    openNativePanel: async options => ({ tab_id: opened.push(options) }),
    setEditorUiEnabled: asyncNoop,
    readEditorUiPolicy: async () => ({ enabled: true }),
  };
  const route = { path, matched: [{}], query: standalone ? { standalone: '1' } : {} };
  const empty = { render: () => null };
  const modules = {
    vue: { ...Vue, onMounted: noop, onUnmounted: noop },
    'vue-router': { useRoute: () => route, useRouter: () => ({ replace: asyncNoop }) },
    'vue-i18n': { useI18n: () => ({ t: key => key, locale: Vue.ref('en') }) },
    '@/stores/dockStore.js': { useDockStore: () => useDockStore(pinia) },
    '@/config/pluginManifest.js': manifests,
    '@/services/appService.js': { appService },
    '@/api/webMessages.js': { getWebMessages: () => ({ on: () => noop }) },
    '@/api/webDocument.js': { getWebDocumentIdentity: () => ({ role: standalone ? 'peer' : 'main' }) },
    '@/services/windowSessionState.js': { WINDOW_SESSION_POLICY_EVENT: 'windowSession.policyChanged' },
    '@/services/worldModeService.js': {
      LAUNCHER_ROUTES: new Set(['/StartScreen', '/NewGame', '/JoinGame', '/RecentGames']),
      normalizeProjectPath: value => value,
      editorUiAllowed, worldModeState, worldModeService: { opening: false },
    },
    '@/components/ui/CabbageGuidanceOverlay.vue': { default: empty },
    '@/api/editorApi.js': { editorApi: {} },
    '@/services/projectLauncherService.js': { cancelPendingProjectOpen: noop },
    '@/services/projectMessages.js': { subscribeProjectChanged: () => noop },
    '@/services/worldSessionLifecycle.js': { notifyWorldError: assert.fail },
    '@/utils/eventBus.js': { coronaEventBus: { on: noop, off: noop } },
    '@/services/nativePanelHosts.js': { createNativePanelHosts },
    '@/utils/viewLifetime.js': { createViewLifetime },
  };
  modules['@/components/dock/NativeDockLayout.vue'] = {
    default: component('components/dock/NativeDockLayout.vue', modules, window),
  };
  const App = component('App.vue', modules, window);
  const scope = Vue.effectScope();
  const state = scope.run(() => App.setup({}, { expose: noop }));
  await Vue.nextTick();
  App.setup = () => state;
  const app = Vue.createSSRApp(App);
  app.use(pinia);
  app.component('RouterView', empty);
  const errors = [];
  app.config.errorHandler = error => errors.push(error);
  const html = await renderToString(app);
  assert.deepEqual(errors, []);
  await new Promise(resolve => setImmediate(resolve));
  return { html, store, opened, worldModeState, dispose: () => scope.stop() };
}

test('each requested creative panel gets a native window, including center and floating panels', async t => {
  const h = await renderApp();
  t.after(h.dispose);
  assert.doesNotMatch(h.html, /data-dock-zone=|global-center-overlay|standalone-resize-handle/);
  assert.deepEqual(h.opened.map(({ panelId, dockingPos, nativeDocked }) => [panelId, dockingPos, nativeDocked]), [
    ['SceneControls', 'left', true], ['SceneTools', 'right', true],
    ['NodeGraphPanel', 'center', false], ['EditorSettings', 'center', true],
  ]);
});

test('a standalone panel renders its route without hosting more windows', async t => {
  const h = await renderApp({ path: '/SceneControls', standalone: true });
  t.after(h.dispose);
  assert.match(h.html, /class="standalone-route-shell"/);
  assert.doesNotMatch(h.html, /data-dock-zone=|standalone-resize-handle/);
  assert.deepEqual(h.opened, []);
});

test('legacy story projects mount the normal native editor and retain requested panels', async t => {
  const h = await renderApp({ mode: 'story' });
  t.after(h.dispose);
  assert.equal(h.opened.length, 4);
  assert.equal(h.store.panels.SceneTools.open, true);
});

test('refreshing metadata for the current project preserves open and user-closed panels', async t => {
  const h = await renderApp();
  t.after(h.dispose);
  h.store.closePanel('SceneControls');
  Object.assign(h.worldModeState, { status: 'loading', mode: null, revision: 2 });
  await Vue.nextTick();
  assert.equal(h.store.panels.SceneTools.open, true);
  assert.equal(h.store.panels.SceneControls.open, false);
  Object.assign(h.worldModeState, { status: 'ready', mode: 'creative' });
  await Vue.nextTick();
  assert.equal(h.store.panels.SceneTools.open, true);
  assert.equal(h.store.panels.SceneControls.open, false);
});
