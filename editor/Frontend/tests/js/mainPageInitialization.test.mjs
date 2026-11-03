import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as Vue from 'vue';
import { babelParse, compileScript, parse } from 'vue/compiler-sfc';
import * as constants from '../../src/utils/constants.js';
import * as projectSceneLifecycle from '../../src/utils/projectSceneLifecycle.js';
import * as visionRenderModes from '../../src/utils/visionRenderModes.js';
import * as viewportCamera from '../../src/utils/viewportCameraController.js';
import * as viewportPick from '../../src/utils/viewportPick.js';
import * as viewportGizmo from '../../src/utils/viewportGizmo.js';
import * as viewportUiMode from '../../src/utils/viewportUiMode.js';
import * as serviceInitialization from '../../src/utils/serviceInitialization.js';
import * as pluginManifest from '../../src/config/pluginManifest.js';
import * as worldRenderPolicy from '../../src/services/worldRenderPolicy.js';

// Execute the complete production setup and mounted hook. Only host/service
// boundaries are injected; scene selection, backend policy and binding stay real.
const { descriptor } = parse(fs.readFileSync(new URL('../../src/views/layout/MainPage.vue', import.meta.url), 'utf8'));
const compiled = compileScript(descriptor, { id: 'main-page-initialization', genDefaultAs: 'MainPage' });
const imports = babelParse(compiled.content, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'ImportDeclaration');
let setupSource = compiled.content;
for (const node of [...imports].reverse()) {
  const bindings = node.specifiers.map(specifier => {
    const key = specifier.type === 'ImportDefaultSpecifier' ? 'default' : specifier.imported.name;
    return `${JSON.stringify(key)}: ${specifier.local.name}`;
  }).join(', ');
  setupSource = setupSource.slice(0, node.start)
    + `const { ${bindings} } = modules[${JSON.stringify(node.source.value)}];`
    + setupSource.slice(node.end);
}
const makeComponent = new Function('modules', 'window', 'document', 'requestAnimationFrame',
  'cancelAnimationFrame', 'ResizeObserver', `${setupSource}; return MainPage;`);

function mountMainPage(t, visionMode = 'path_tracing') {
  const calls = [], errors = [], mounted = [], unmounted = [], observed = [];
  const dock = {
    panels: { SceneControls: { open: true, mode: 'docked' }, SceneTools: { open: true, mode: 'docked' } },
    initDefaultLayout() {},
    closePanel(id) { if (this.panels[id]) this.panels[id].open = false; },
  };
  const frames = new Map();
  let sequence = 0;
  const requestFrame = callback => { frames.set(++sequence, callback); return sequence; };
  const cancelFrame = id => frames.delete(id);
  const noop = () => {};
  const asyncNoop = async () => {};
  const window = {
    localStorage: { getItem: () => 'D:/fixtures/kitchen/scene_v3.xml' },
    devicePixelRatio: 1,
    addEventListener: noop, removeEventListener: noop,
    setInterval: () => ++sequence, clearInterval: noop,
    setTimeout: () => ++sequence, clearTimeout: noop,
    coronaBridge: {
      cameraMove: () => true,
      setCameraViewport: (...args) => { calls.push(['viewport', ...args]); return true; },
      setViewportUiMode: () => true,
      setViewportGizmoTarget: () => true,
      setViewportSystemCursorHidden: () => true,
    },
  };
  const document = { hidden: false, addEventListener: noop, removeEventListener: noop };
  const api = {
    main: { onInit: async () => ({ data: { scene: { path: 'scene_v3.xml' } } }) },
    sceneTools: {
      setRenderBackend: async (mode, scene, camera) => {
        calls.push(['backend', mode, scene, camera]);
        if (scene !== 'scene_v3.xml') throw new Error(`Request does not identify the current scene: ${scene}`);
        return { data: { mode } };
      },
      isVisionAvailable: async () => ({ data: { available: true } }),
      listCameraViews: async () => ({ data: { cameras: [] } }),
    },
    scene: { getSnapshot: async scene => {
      calls.push(['snapshot', scene]);
      assert.equal(scene, 'scene_v3.xml');
      return { data: { scene, active_camera_name: 'KitchenCamera', actors: [], cameras: [{
        name: 'KitchenCamera', camera_id: 'camera-1', handle: 42,
        position: [0, 1, -5], forward: [0, 0, 1], world_up: [0, 1, 0], fov: 45,
        render_backend: 'native', vision_render_mode: visionMode,
        vision_accumulation: false, vision_denoise: true, vision_denoiser: 'reblur',
        vision_stable_planes: true, view_open: false,
      }] } };
    } },
    project: { getProjectLoadStatus: async () => ({ active: true, loading: false }) },
    scratch: {
      getScriptStatus: async () => ({ status: 'stopped', threadAlive: false }),
      getGamePreviewStatus: async () => ({ status: 'stopped', workerActive: false }),
    },
    events: Object.fromEntries(['onProjectOpened', 'onActorSelectionChanged', 'onActorTransformUpdated',
      'onActorPickResult', 'onViewportGizmoPointerResult'].map(name => [name, async () => ++sequence])),
    off: asyncNoop,
  };
  const modules = Object.fromEntries(imports.map(node => [node.source.value, {}]));
  Object.assign(modules, {
    vue: { ...Vue, onMounted: hook => mounted.push(hook), onUnmounted: hook => unmounted.push(hook) },
    'vue-router': { useRouter: () => ({}) },
    'vue-i18n': { useI18n: () => ({ t: text => text }) },
    '@/utils/constants.js': constants,
    '@/utils/projectSceneLifecycle.js': projectSceneLifecycle,
    '@/utils/visionRenderModes.js': visionRenderModes,
    '@/utils/viewportPick.js': viewportPick,
    '@/utils/viewportGizmo.js': viewportGizmo,
    '@/utils/viewportUiMode.js': viewportUiMode,
    '@/utils/serviceInitialization.js': serviceInitialization,
    '@/config/pluginManifest.js': pluginManifest,
    '@/utils/viewportCameraController.js': { ...viewportCamera,
      createViewportCameraController: options => viewportCamera.createViewportCameraController({
        ...options, requestFrame, cancelFrame,
      }),
    },
    '@/api/editorApi.js': { editorApi: api },
    '@/services/worldModeService.js': { worldModeState: { mode: 'creative', revision: 1 } },
    '@/services/worldRenderPolicy.js': worldRenderPolicy,
    '@/services/appService.js': { appService: { crossTabBroadcast: asyncNoop } },
    '@/composables/useErrorHandler.js': { useErrorHandler: () => ({
      error: (...args) => errors.push(args), warn: (...args) => errors.push(args),
    }) },
    '@/stores/dockStore.js': { useDockStore: () => dock },
    '@/stores/cabbageAssistantStore.js': { useCabbageAssistantStore: () => ({
      clearForProjectChange: noop, hydrateContext: noop,
    }) },
    '@/utils/eventBus.js': { coronaEventBus: { on: noop, off: noop } },
    '@/services/nodeGraphReviewService.js': { reviewScopeId: value => value, subscribeNodeGraphReviews: () => noop },
    '@/services/cabbageAssistantContextService.js': {
      cabbageContextService: { loadCurrentWorld: asyncNoop, requestProfileScoreUpdate: asyncNoop, flush: asyncNoop },
      cancelPendingTransformEvents: noop, publishCabbageAssistantContext: noop,
      readCabbageAssistantContext: noop, subscribeCabbageAssistantContext: () => noop,
      subscribeCabbagePreWarnings: () => noop,
    },
    '@/services/nodeGraphGenerationService.js': { cancelActiveNodeGraphGeneration: asyncNoop },
    '@/services/cabbageTutorialSessionService.js': { closeTutorialSessionChannel: noop },
    '@/services/creativePanelState.js': { provideCreativePanelState: noop },
  });
  class ResizeObserver {
    observe(element) { observed.push(element); }
    disconnect() {}
  }
  const component = makeComponent(modules, window, document, requestFrame, cancelFrame, ResizeObserver);
  const page = component.setup({}, { expose() {} });
  const surface = {
    contains: target => target === surface,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1536, height: 825 }),
  };
  page.viewportPickSurfaceRef.value = surface;
  t.after(() => { for (const hook of unmounted) hook(); });
  return { page, calls, errors, observed, surface, dock,
    async mount() { for (const hook of mounted) await hook(); },
    flushFrames() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
    },
  };
}

test('world entry retains the initialized scene controls and scene manager', async t => {
  const h = mountMainPage(t);
  await h.mount();
  assert.equal(h.dock.panels.SceneControls.open, true);
  assert.equal(h.dock.panels.SceneTools.open, true);
  assert.deepEqual(h.errors, []);
});

test('right dragging a DOM panel does not rotate the viewport camera', async t => {
  const h = mountMainPage(t);
  await h.mount();
  const forward = [...h.page.cameraState.value.forward];
  h.page.onMouseDown({ target: {}, button: 2, clientX: 10, clientY: 10 });
  h.page.onMouseMove({ buttons: 2, clientX: 80, clientY: 40 });
  assert.deepEqual(h.page.cameraState.value.forward, forward);
});

test('right dragging from the viewport still rotates the camera', async t => {
  const h = mountMainPage(t);
  await h.mount();
  const forward = [...h.page.cameraState.value.forward];
  h.page.onMouseDown({ target: h.surface, button: 2, clientX: 10, clientY: 10 });
  h.page.onMouseMove({ buttons: 2, clientX: 80, clientY: 40 });
  assert.notDeepEqual(h.page.cameraState.value.forward, forward);
});

for (const visionMode of ['path_tracing', 'restir']) {
test(`external scene entry defaults to Vision and preserves saved ${visionMode}`, async t => {
  const h = mountMainPage(t, visionMode);
  assert.equal(h.page.currentMainSceneId(), 'scene.ini', 'the unopened page starts at the default scene');
  assert.equal(h.page.cameraBindingState.value.cameraHandle, null);
  await h.mount();

  assert.deepEqual(h.calls[0], ['backend', 'vision', 'scene_v3.xml', null]);
  assert.deepEqual(h.calls[1], ['snapshot', 'scene_v3.xml'], 'backend selection must precede snapshot binding');
  assert.equal(h.page.cameraBindingState.value.sceneId, 'scene_v3.xml');
  assert.equal(h.page.cameraBindingState.value.cameraHandle, 42);
  assert.equal(h.page.mainRenderBackend.value, 'vision');
  assert.equal(h.page.mainVisionRenderMode.value, visionMode);
  assert.deepEqual(h.observed, [h.surface]);
  h.flushFrames();
  assert.ok(h.calls.some(call => call[0] === 'viewport' && call[1] === 42
    && call[4] === 1536 && call[5] === 825), 'the mounted page must send camera viewport bounds');
  assert.deepEqual(h.errors, []);
});
}
