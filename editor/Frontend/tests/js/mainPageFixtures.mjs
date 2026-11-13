import { sceneQueryFixture } from './sceneQueryFixtures.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import * as Vue from 'vue';
import { babelParse, compileScript, parse } from 'vue/compiler-sfc';
import * as constants from '../../src/utils/constants.js';
import * as projectLauncher from '../../src/services/projectLauncherService.js';
import * as visionRenderModes from '../../src/utils/visionRenderModes.js';
import * as viewportCamera from '../../src/utils/viewportCameraController.js';
import * as viewportPick from '../../src/utils/viewportPick.js';
import * as modelHierarchy from '../../src/utils/modelHierarchy.js';
import * as scriptInput from '../../src/utils/scriptInput.js';
import * as viewportGizmo from '../../src/utils/viewportGizmo.js';
import * as viewportUiMode from '../../src/utils/viewportUiMode.js';
import * as viewportCalibration from '../../src/services/viewportCalibrationService.js';
import * as serviceInitialization from '../../src/utils/serviceInitialization.js';
import * as viewLifetime from '../../src/utils/viewLifetime.js';
import * as pluginManifest from '../../src/config/pluginManifest.js';
import * as worldRenderPolicy from '../../src/services/worldRenderPolicy.js';
import { createWebMessages } from '../../src/api/webMessages.js';
import { createViewportControlsService } from '../../src/services/viewportControlsService.js';

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

export function mountMainPage(t, visionMode = 'path_tracing', { nativeCursor = false } = {}) {
  const messages = createWebMessages({ scope: crypto.randomUUID(), role: 'main', documentId: 'main' });
  t.after(() => messages.dispose());
  const records = [], timers = new Map();
  const calls = [], errors = [], mounted = [], unmounted = [], observed = [], creativeActions = {};
  const dock = {
    panels: Vue.reactive({ SceneControls: { open: false }, SceneTools: { open: false } }),
    closePanel(id) { if (this.panels[id]) this.panels[id].open = false; },
  };
  const frames = new Map();
  let sequence = 0;
  const requestFrame = callback => { frames.set(++sequence, callback); return sequence; };
  const cancelFrame = id => frames.delete(id);
  const noop = () => {};
  const asyncNoop = async () => {};
  const bus = new EventEmitter();
  const windowEvents = new EventEmitter();
  const stored = new Map();
  const calibration = viewportUiMode.createViewportUiCalibrationStore({
    storage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) },
  });
  const window = {
    localStorage: { getItem: () => 'D:/fixtures/kitchen/scene_v3.xml' },
    devicePixelRatio: 1,
    addEventListener: windowEvents.on.bind(windowEvents), removeEventListener: windowEvents.off.bind(windowEvents),
    setInterval: () => ++sequence, clearInterval: noop,
    setTimeout: fn => { timers.set(++sequence, fn); return sequence; }, clearTimeout: id => timers.delete(id),
  };
  const document = { hidden: false, addEventListener: noop, removeEventListener: noop };
  const api = {
    viewport: { configure: async (...args) => { calls.push(['viewport', ...args]); return {}; } },
    sceneTools: {},
    app: { isVisionAvailable: async () => ({ available: true }) },
    scene: { ...sceneQueryFixture({ index: async () => ({ archive_session: 'main-archive', scene: 'scene_v3.xml', actors: [] }), cameras: async (scene, scope) => {
      calls.push(['cameras', scene, scope]);
      assert.equal(scene, 'scene_v3.xml');
      assert.deepEqual(scope, { archive_session: 'main-archive' });
      return { archive_session: 'main-archive', scene, active_camera_id: 'camera-1', cameras: [{
        name: 'KitchenCamera', camera_id: 'camera-1', archive_session: 'main-archive', opaque_handle: '42',
        position: [0, 1, -5], forward: [0, 0, 1], world_up: [0, 1, 0], fov: 45,
        render_backend: 'native', vision_render_mode: visionMode,
        vision_accumulation: false, vision_denoise: true, vision_denoiser: 'reblur',
        vision_stable_planes: true, view_open: false,
      }] };
    } }),  observe: async () => -1,
      setCameraRenderSettings: async (scene, camera, patch) => {
        calls.push(['backend', patch.render_backend, scene, camera, patch]);
        assert.equal(scene, 'scene_v3.xml');
        assert.equal(camera, 'camera-1');
        assert.equal(patch.archive_session, 'main-archive');
        return { archive_session: 'main-archive', scene, camera_id: camera, render_backend: patch.render_backend };
      },
      updateCamera: async (...args) => { calls.push(['cameraWrite', ...args]); return {}; },
      readActive: async () => ({ archive_session: 'main-archive', scene: 'scene_v3.xml' }),
      readEnvironment: async (...args) => {
        calls.push(['environmentRead', ...args]);
        return { archive_session: 'main-archive', scene: 'scene_v3.xml', physics: {
          gravity: [1, -8, 2], floor_y: 4, floor_restitution: 0.3, fixed_dt: 0.02,
        } };
      },
      setEnvironment: async (...args) => { calls.push(['environmentWrite', ...args]); return {}; },

       },
    project: { getProjectLoadStatus: async () => ({ active: true, loading: false }) },
    scripts: { getStatus: async () => ({ status: 'stopped', threadAlive: false }) },
    input: { dispatch: asyncNoop },
    scratch: {
      getGamePreviewStatus: async () => ({ status: 'stopped', workerActive: false }),
    },
    events: Object.fromEntries(['onProjectOpened', 'onActorSelectionChanged', 'onActorTransformUpdated']
      .map(name => [name, async () => ++sequence])),
    off: asyncNoop,
  };
  const modules = Object.fromEntries(imports.map(node => [node.source.value, {}]));
  Object.assign(modules, {
    vue: { ...Vue, onMounted: hook => mounted.push(hook), onUnmounted: hook => unmounted.push(hook) },
    'vue-router': { useRouter: () => ({}) },
    'vue-i18n': { useI18n: () => ({ t: text => text }) },
    '@/utils/constants.js': constants,
    '@/services/projectLauncherService.js': projectLauncher,
    '@/utils/visionRenderModes.js': visionRenderModes,
    '@/utils/viewportPick.js': viewportPick,
    '@/utils/modelHierarchy.js': modelHierarchy,
    '@/utils/scriptInput.js': scriptInput,
    '@/utils/viewportGizmo.js': viewportGizmo,
    '@/utils/viewportUiMode.js': { ...viewportUiMode, createViewportUiCalibrationStore: () => calibration,
      isNativeViewportCursorEnabled: () => nativeCursor },
    '@/utils/serviceInitialization.js': serviceInitialization,
    '@/utils/viewLifetime.js': viewLifetime,
    '@/config/pluginManifest.js': pluginManifest,
    '@/utils/viewportCameraController.js': { ...viewportCamera,
      createViewportCameraController: options => viewportCamera.createViewportCameraController({
        ...options, requestFrame, cancelFrame,
      }),
    },
    '@/api/editorApi.js': { editorApi: api },
    '@/api/observerRuntime.js': { getObserverRuntime: () => ({ observe: asyncNoop, off: asyncNoop }) },
    '@/api/webMessages.js': { getWebMessages: () => messages },
    '@/api/webDocument.js': { getWebDocumentIdentity: () => ({ owner: 'main-owner' }) },
    '@/services/viewportCalibrationService.js': viewportCalibration,
    '@/services/worldModeService.js': { worldModeState: { status: 'ready', mode: 'creative', revision: 1 } },
    '@/services/worldRenderPolicy.js': worldRenderPolicy,
    '@/services/projectMessages.js': { subscribeProjectChanged: () => noop },
    '@/services/appService.js': { appService: { crossTabBroadcast: asyncNoop } },
    '@/services/viewportControlsService.js': { viewportControlsService: createViewportControlsService(messages) },
    '@/composables/useErrorHandler.js': { useErrorHandler: () => ({
      error: (...args) => errors.push(args), warn: (...args) => errors.push(args),
    }) },
    '@/stores/dockStore.js': { useDockStore: () => dock },
    '@/stores/cabbageAssistantStore.js': { useCabbageAssistantStore: () => ({
      clearForProjectChange: noop, hydrateContext: noop,
    }) },
    '@/utils/eventBus.js': { coronaEventBus: bus },
    '@/services/nodeGraphReviewService.js': { reviewScopeId: value => value, subscribeNodeGraphReviews: () => noop },
    '@/services/cabbageAssistantContextService.js': {
      cabbageContextService: { loadCurrentWorld: asyncNoop, requestProfileScoreUpdate: asyncNoop, flush: asyncNoop, recordEvent: async event => records.push(event) },
      cancelPendingTransformEvents: noop, publishCabbageAssistantContext: noop,
      readCabbageAssistantContext: noop,
      subscribeCabbageAssistantContext: () => noop,
      subscribeCabbagePreWarnings: () => noop,
    },
    '@/services/nodeGraphGenerationService.js': { cancelActiveNodeGraphGeneration: asyncNoop },
    '@/services/cabbageTutorialSessionService.js': { closeTutorialSessionChannel: noop },
    '@/services/creativePanelState.js': { provideCreativePanelState: (snapshot, actions) => {
      Object.assign(creativeActions, actions);
      assert.doesNotThrow(() => structuredClone(snapshot()), 'Web snapshots must not contain Vue proxies');
    } },
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
  return { page, calls, errors, records, timers, observed, surface, dock, bus, windowEvents, messages, calibration, api, creativeActions,
    cabbageContext: modules['@/services/cabbageAssistantContextService.js'].cabbageContextService,
    worldMode: modules['@/services/worldModeService.js'].worldModeState,
    async mount() { for (const hook of mounted) await hook(); },
    unmount() { for (const hook of unmounted) hook(); },
    flushFrames() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(0);
    },
  };
}

