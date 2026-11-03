import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as Vue from 'vue';
import { createPinia, defineStore, storeToRefs } from 'pinia';
import { babelParse, compileScript, parse } from 'vue/compiler-sfc';
import { compile } from '@vue/compiler-ssr';
import { renderToString } from '@vue/server-renderer';
import * as manifests from '../../src/config/pluginManifest.js';
import { createNativePanelHosts } from '../../src/services/nativePanelHosts.js';
import { createDockOverlayStyles } from '../../src/components/dock/dockOverlayLayout.js';

const require = createRequire(import.meta.url);
const source = path => fs.readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8');

// Render the real App, DOM layout and panel shell. Native window/route services
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

async function renderApp({ path = '/', standalone = false } = {}) {
  const worldModeState = Vue.shallowReactive({
    status: 'ready', mode: 'creative', projectPath: 'D:/worlds/kitchen', revision: 1,
  });
  const editorUiAllowed = () => worldModeState.status === 'ready' && worldModeState.mode === 'creative';
  const storeSource = source('stores/dockStore.js').replace(/^import .*;\r?\n/gm, '')
    .replace('export const useDockStore', 'const useDockStore');
  const useDockStore = new Function('defineStore', 'PLUGIN_MANIFEST', 'editorUiAllowed',
    `${storeSource}; return useDockStore;`)(defineStore, manifests.PLUGIN_MANIFEST, editorUiAllowed);
  const pinia = createPinia();
  const store = useDockStore(pinia);
  for (const id of ['SceneControls', 'SceneTools', 'EditorSettings']) store.openPanel(id);

  const window = { coronaBridge: { dockCommand() {} } };
  const noop = () => {};
  const asyncNoop = async () => {};
  const appService = {
    setEditorUiEnabled: asyncNoop,
    readEditorUiPolicy: async () => ({ enabled: true }),
    createDockedPanel: async () => ({ tab_id: 12 }),
    closePanelTab: asyncNoop,
    focusPanelTab: asyncNoop,
  };
  const route = { path, matched: [{}], query: standalone ? { standalone: '1' } : {} };
  const empty = { render: () => null };
  const modules = {
    vue: { ...Vue, onMounted: noop, onUnmounted: noop },
    pinia: { storeToRefs },
    'vue-router': { useRoute: () => route, useRouter: () => ({ replace: asyncNoop }) },
    'vue-i18n': { useI18n: () => ({ t: key => key, locale: Vue.ref('en') }) },
    '@/stores/dockStore.js': { useDockStore: () => useDockStore(pinia) },
    '@/config/pluginManifest.js': manifests,
    '@/services/appService.js': { appService },
    '@/services/nativePanelHosts.js': { createNativePanelHosts },
    '@/services/editorWindowSession.js': { EDITOR_UI_POLICY_KEY: 'policy' },
    '@/services/worldModeService.js': {
      LAUNCHER_ROUTES: new Set(['/StartScreen', '/NewGame', '/JoinGame', '/RecentGames']),
      normalizeProjectPath: value => value,
      editorUiAllowed, worldModeState, worldModeService: { opening: false },
    },
    '@/views/panelRegistry.js': { getPluginComponent: () => empty },
    '@/components/ui/CabbageGuidanceOverlay.vue': { default: empty },
    '@/api/editorApi.js': { editorApi: {} },
    '@/stores/lanchat.js': { default: { finishWorldSession: asyncNoop } },
    '@/services/projectLauncherService.js': { cancelPendingProjectOpen: noop },
    '@/services/worldSessionLifecycle.js': { notifyWorldError: assert.fail },
    '@/utils/eventBus.js': { coronaEventBus: { on: noop, off: noop } },
    './dockOverlayLayout.js': { createDockOverlayStyles },
  };
  const panel = component('components/dock/DockPanel.vue', modules, window);
  modules['./DockPanel.vue'] = { default: panel };
  modules['@/components/dock/DockPanel.vue'] = { default: panel };
  modules['@/components/dock/DockLayout.vue'] = {
    default: component('components/dock/DockLayout.vue', modules, window),
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
  return { html, store, worldModeState, dispose: () => scope.stop() };
}

test('a CEF dockCommand transport still renders DOM sidebars and center settings', async t => {
  const h = await renderApp();
  t.after(h.dispose);
  const { html } = h;
  assert.match(html, /data-dock-zone="left"/);
  assert.match(html, /data-dock-panel-id="SceneControls"/);
  assert.match(html, /data-dock-zone="right"/);
  assert.match(html, /data-dock-panel-id="SceneTools"/);
  assert.match(html, /class="global-center-overlay"/);
  assert.match(html, /data-dock-panel-id="EditorSettings"/);
});

test('standalone panels keep their own route shell and resize handles', async t => {
  const h = await renderApp({ path: '/SceneControls', standalone: true });
  t.after(h.dispose);
  const { html } = h;
  assert.match(html, /class="standalone-route-shell"/);
  assert.equal((html.match(/standalone-resize-handle--/g) || []).length, 7);
  assert.doesNotMatch(html, /data-dock-zone=/);
  assert.doesNotMatch(html, /class="global-center-overlay"/);
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
