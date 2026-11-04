<template>
  <div class="relative flex flex-col flex-1 min-h-0 h-full w-full" tabindex="0">
    <div
      ref="viewportPickSurfaceRef"
      tabindex="0"
      class="relative flex-1 min-h-0 w-full"
      :class="{ 'viewport-cursor-hidden': nativeViewportCursorEnabled && viewportUiMode === 'stereo3d' }"
      :style="nativeViewportCursorEnabled && viewportUiMode === 'stereo3d' ? { cursor: 'none' } : null"
      data-viewport-pick-surface
      data-guidance="main-viewport"
      @focus="handleViewportFocus"
      @pointermove="handleViewportPointer"
      @pointerdown="handleViewportPointerDown"
      @pointerup="handleViewportPointer"
      @pointercancel="handleViewportPointerCancel"
      @pointerleave="handleViewportPointerLeave"
      @click="handleViewportClick"
      @wheel.prevent="handleWheel"
    ></div>

    <div
      v-if="projectResourceLoadStatus?.loading"
      class="fixed left-1/2 top-14 z-[90] w-[360px] max-w-[calc(100vw-2rem)] -translate-x-1/2 pointer-events-none rounded-lg border border-[#8a7440]/40 bg-[#151a16]/90 px-4 py-3 shadow-xl backdrop-blur-sm"
    >
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="text-[#d9e6cf]">场景已打开，资源后台加载中</span>
        <span class="font-mono text-[#9fc276]">
          {{ Math.round(projectResourceLoadStatus.progress || 0) }}%
        </span>
      </div>
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
        <div
          class="h-full rounded-full bg-[#8a7440] transition-all duration-300"
          :style="{ width: `${projectResourceLoadStatus.progress || 0}%` }"
        ></div>
      </div>
      <div class="mt-1.5 text-[11px] text-[#8f9b8a]">
        已就绪 {{ projectResourceLoadStatus.ready || 0 }} /
        {{ projectResourceLoadStatus.total || 0 }}
      </div>
    </div>

    <div
      v-if="importProgress"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]"
    >
      <div class="bg-[#263126] rounded-lg p-6 min-w-[300px] border border-[#b3995d]/30 shadow-2xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-6 h-6 animate-spin">
            <svg
              class="w-full h-full text-[#b3995d]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              ></path>
            </svg>
          </div>
          <span class="text-[#e8ede3] font-medium">加载中</span>
        </div>
        <div class="text-sm text-[#8d9e85] mb-2">{{ importProgress.message }}</div>
        <div v-if="importProgress.progress > 0" class="w-full bg-[#18221a] rounded-full h-2 mt-4">
          <div
            class="bg-[#b3995d] h-full rounded-full transition-all duration-300"
            :style="{ width: importProgress.progress + '%' }"
          ></div>
        </div>
        <div v-if="importProgress.progress > 0" class="text-xs text-[#b3995d] text-center mt-2">
          {{ Math.round(importProgress.progress) }}%
        </div>
      </div>
    </div>

    <nav class="dock-shortcut-bar" aria-label="Dock 开关">
      <button
        v-for="shortcut in dockShortcuts"
        :key="shortcut.id"
        type="button"
        class="dock-shortcut-button"
        :class="{
          active: isShortcutOpen(shortcut.id),
        }"
        :data-guidance="shortcut.guidance || (shortcut.id === 'SceneTools' ? 'scene-shortcut' : 'node-shortcut')"
        :title="`${isShortcutOpen(shortcut.id) ? '关闭' : '打开'}${shortcut.label}`"
        @click.stop="toggleDockShortcut(shortcut.id, { source: 'user' })"
      >
        <span class="dock-shortcut-icon">{{ shortcut.icon }}</span>
        <span>{{ shortcut.label }}</span>
      </button>
    </nav>


  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, reactive, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { DEFAULT_SCENE_NAME } from '@/utils/constants.js';
import {
  normalizeVisionRenderMode, visionAccumulationFromCamera, visionDenoiseFromCamera, visionStablePlanesFromCamera, visionRenderModes,
  visionDenoisers, visionDenoiserFromCamera,
} from '@/utils/visionRenderModes.js';
import {
  Bridge,
  editorApi,
} from '@/api/editorApi.js';
import { appService, isCurrentWindowEvent } from '@/services/appService.js';
import { worldModeState } from '@/services/worldModeService.js';
import { initializeWorldRenderBackend } from '@/services/worldRenderPolicy.js';
import { projectLauncherService, resolveOpenedProjectScene } from '@/services/projectLauncherService.js';
import { useErrorHandler } from '@/composables/useErrorHandler.js';
import { useDockStore } from '@/stores/dockStore.js';
import { PLUGIN_MANIFEST } from '@/config/pluginManifest.js';
import { pickedNodeIdentity } from '@/utils/modelHierarchy.js';
import { coronaEventBus } from '@/utils/eventBus.js';
import { createViewportPickController, indexActorsByHandle } from '@/utils/viewportPick.js';
import { cameraMovementKey, createViewportCameraController } from '@/utils/viewportCameraController.js';
import {
  createViewportGizmoController,
  isViewportGizmoSelectionOwner,
  resolveViewportGizmoTarget,
} from '@/utils/viewportGizmo.js';
import {
  createViewportUiModeStore,
  createViewportUiCalibrationStore,
  createViewportUiPointerController,
  isNativeViewportCursorEnabled,
} from '@/utils/viewportUiMode.js';
import { createServiceInitializationRetry } from '@/utils/serviceInitialization.js';
import { reviewScopeId, subscribeNodeGraphReviews } from '@/services/nodeGraphReviewService.js';
import { useCabbageAssistantStore } from '@/stores/cabbageAssistantStore.js';
import {
  cabbageContextService,
  cancelPendingTransformEvents,
  initializeWorldTasks,
  publishCabbageAssistantContext,
  readCabbageAssistantContext,
  subscribeCabbageAssistantContext,
  subscribeCabbagePreWarnings,
} from '@/services/cabbageAssistantContextService.js';
import { cancelActiveNodeGraphGeneration } from '@/services/nodeGraphGenerationService.js';
import { setActorContext } from '@/blockly/composables/useActorContext.js';
import { closeTutorialSessionChannel } from '@/services/cabbageTutorialSessionService.js';
import { provideCreativePanelState } from '@/services/creativePanelState.js';

const { error: logError, warn: logWarn } = useErrorHandler('MainPage');

// Every asynchronous continuation belongs to the world instance that mounted it.
const worldRevision = worldModeState.revision;
let viewDisposed = false;
const viewCurrent = () => !viewDisposed && worldModeState.revision === worldRevision;
async function subscribeWhileCurrent(register, handler) {
  const token = await register((...args) => { if (viewCurrent()) handler(...args); });
  if (viewCurrent()) return token;
  await editorApi.off(token).catch(() => {});
  return null;
}

const { t: translate } = useI18n();
const dockStore = useDockStore();
const cabbageAssistant = useCabbageAssistantStore();
const dockShortcuts = [
  { id: 'SceneControls', label: '场景控制', icon: '控', guidance: 'controls-shortcut' },
  { id: 'CabbageTasks', label: 'AI 任务', icon: '任', guidance: 'tasks-shortcut' },
  { id: 'CabbageChatPanel', label: 'AI 对话', icon: 'AI', guidance: 'chat-shortcut' },
  { id: 'SceneTools', label: '场景管理', icon: '景' },
  { id: 'NodeGraphPanel', label: '节点', icon: '点' },
];
const isShortcutOpen = (id) => Boolean(dockStore.panels[id]?.open);
const recordPanelOpened = (id, source = 'user') => cabbageContextService.recordEvent({
  type: 'panel_opened',
  category: 'panel',
  success: true,
  details: { panelId: id, source },
});

const handleCreativePanelOpen = async payload => {
  if (!viewCurrent() || (payload?.uiGeneration !== undefined && !isCurrentWindowEvent(payload))) return;
  if (!PLUGIN_MANIFEST.some(panel => panel.id === payload.panelId)) return;
  dockStore.openPanel(payload.panelId);
  await nextTick();
  if (viewCurrent()) coronaEventBus.emit('native-panel-focus', payload.panelId);
};

const toggleDockShortcut = (id, { source = 'user' } = {}) => {
  dockStore.togglePanel(id);
  if (dockStore.panels[id]?.open) void recordPanelOpened(id, source);
};

const handleNodeGraphPanelOpenRequest = () => handleCreativePanelOpen({ panelId: 'NodeGraphPanel' });



const importProgress = ref(null);
const projectResourceLoadStatus = ref(null);
let projectResourceLoadPollTimer = null;

const currentSceneId = ref(DEFAULT_SCENE_NAME);

const cameraState = ref({
  position: [0.0, 5.0, 10.0],
  forward: [0.0, 1.5, 0.0],
  up: [0.0, 1.0, 0.0],
  fov: 45.0,
});

const cameraBindingState = ref({
  sceneId: null,
  cameraId: null,
  cameraName: null,
  cameraHandle: null,
});
let actorPickIndex = new Map();
let actorPickResultCallbackToken = null;
let actorSelectionCallbackToken = null;
let gizmoPointerResultCallbackToken = null;
let actorTransformCallbackToken = null;
let projectOpenedCallbackToken = null;
const actorTransformBaselines = new Map();
const ACTOR_TRANSFORM_EPSILON = 1e-5;
let gizmoDownRequestId = '';
let gizmoDownPointerId = null;
let gizmoDownConsumed = false;
let gizmoClickTimer = 0;
const viewportPickSurfaceRef = ref(null);
const viewportLayoutVersion = ref(0);
const viewportUiMode = ref('flat2d');
const viewportUiModeStore = createViewportUiModeStore();
const nativeViewportCursorEnabled = isNativeViewportCursorEnabled();
const viewportUiModeItems = [
  { mode: 'flat2d', label: '2D UI', title: '普通屏幕 UI' },
  { mode: 'stereo3d', label: '3D UI', title: '光场屏立体 UI' },
];

// 光场 3D UI 标定：标定面板通过共享存储同步修改，这里用活动相机句柄下发；
// 切到 stereo3d 自动打开标定 dock 面板并推送当前值，切回 flat2d 关闭。
const viewportUiCalibrationStore = createViewportUiCalibrationStore();
const VIEWPORT_UI_CALIBRATION_PANEL = 'LightFieldCalibration';
const applyViewportUiCalibration = () => {
  viewportUiCalibrationStore.applyToBridge({
    bridge: window.coronaBridge,
    cameraHandle: cameraBindingState.value.cameraHandle,
    calibration: viewportUiCalibrationStore.get({}),
  });
};
const syncViewportUiCalibrationPanel = (mode) => {
  if (mode === 'stereo3d') {
    dockStore.openPanel(VIEWPORT_UI_CALIBRATION_PANEL);
    applyViewportUiCalibration();
  } else {
    dockStore.closePanel(VIEWPORT_UI_CALIBRATION_PANEL);
  }
};

// 摄像头移动速度（可调节）
const cameraSpeed = ref(0.2);
const sceneGridEnabled = ref(true);
const sceneLightSettings = reactive({
  enabled: true,
  direction: { x: 1, y: 1, z: 1 },
});
const sceneLightBusy = ref(false);
const mouseSensitivity = ref(0.15);

// Only interaction analytics stay in the host; input state belongs to the controller.
let mouseRotateStartForward = null;
let mouseRotateMoved = false;
const cameraMovementGestures = new Map();
const movementAxisGroups = Object.freeze({
  w: 'forward_back',
  s: 'forward_back',
  a: 'left_right',
  d: 'left_right',
  q: 'up_down',
  e: 'up_down',
});

const MAX_CAMERA_VIEWPORT_RENDER_PIXELS = 1920 * 1080;

const computeCameraViewportRenderSize = (width, height, scale) => {
  const physicalWidth = Math.max(Math.round(width * scale), 1);
  const physicalHeight = Math.max(Math.round(height * scale), 1);
  const pixels = physicalWidth * physicalHeight;
  if (pixels <= MAX_CAMERA_VIEWPORT_RENDER_PIXELS) {
    return { width: physicalWidth, height: physicalHeight };
  }

  const ratio = Math.sqrt(MAX_CAMERA_VIEWPORT_RENDER_PIXELS / pixels);
  return {
    width: Math.max(Math.floor(physicalWidth * ratio), 1),
    height: Math.max(Math.floor(physicalHeight * ratio), 1),
  };
};

const getViewportHitRect = () => viewportPickSurfaceRef.value?.getBoundingClientRect?.() ?? null;

const getViewportRenderRect = () => {
  const rect = getViewportHitRect();
  const width = Math.max(Number(rect?.width || 0), 0);
  const height = Math.max(Number(rect?.height || 0), 0);
  const scale = Math.max(Number(window.devicePixelRatio || 1), 0.01);
  const renderSize = computeCameraViewportRenderSize(width, height, scale);
  return {
    left: Number(rect?.left || 0),
    top: Number(rect?.top || 0),
    width,
    height,
    renderWidth: renderSize.width,
    renderHeight: renderSize.height,
  };
};

const currentViewportUiDescriptor = () => ({
  scope: 'main',
  sceneId: cameraBindingState.value.sceneId || currentSceneId.value || DEFAULT_SCENE_NAME,
  cameraHandle: cameraBindingState.value.cameraHandle || '',
});

const normalizeTransformVector = (value, fallback = { x: 0, y: 0, z: 0 }) => ({
  x: Number(value?.x ?? value?.[0] ?? fallback.x) || 0,
  y: Number(value?.y ?? value?.[1] ?? fallback.y) || 0,
  z: Number(value?.z ?? value?.[2] ?? fallback.z) || 0,
});

const actorTransformKey = (sceneId, actorName) => `${String(sceneId || '')}::${String(actorName || '')}`;

const normalizeActorTransform = (source = {}, fallback = {}) => ({
  position: normalizeTransformVector(source.position, fallback.position || { x: 0, y: 0, z: 0 }),
  rotation: normalizeTransformVector(source.rotation, fallback.rotation || { x: 0, y: 0, z: 0 }),
  scale: normalizeTransformVector(source.scale, fallback.scale || { x: 1, y: 1, z: 1 }),
});

const transformVectorChanged = (previous, next) => ['x', 'y', 'z'].some((axis) => (
  Math.abs(Number(previous?.[axis] || 0) - Number(next?.[axis] || 0)) > ACTOR_TRANSFORM_EPSILON
));

const seedActorTransformBaseline = async (sceneId, actorName) => {
  const scene = String(sceneId || '').trim();
  const actor = String(actorName || '').trim();
  if (!scene || !actor) return;
  try {
    const result = await editorApi.scene.getActor(scene, actor);
    const data = result?.data ?? result ?? {};
    if (!data || data.status === 'error') return;
    actorTransformBaselines.set(
      actorTransformKey(scene, actor),
      normalizeActorTransform(data.geometry || {}),
    );
  } catch (_) {
    // Selection should still open the Object Dock when a baseline cannot be read.
  }
};

const handleActorTransformForCabbage = (payload = {}) => {
  const sceneId = String(payload?.scene || payload?.scene_id || '').trim();
  const actorName = String(payload?.actor || payload?.actor_name || '').trim();
  if (!sceneId || !actorName) return;
  const key = actorTransformKey(sceneId, actorName);
  const previous = actorTransformBaselines.get(key);
  const next = normalizeActorTransform(payload, previous || {});
  actorTransformBaselines.set(key, next);
  // The first callback may be an initial state echo. Only compare after a baseline exists.
  if (!previous) return;

  for (const transformKey of ['position', 'rotation', 'scale']) {
    if (!transformVectorChanged(previous[transformKey], next[transformKey])) continue;
    void cabbageContextService.recordEvent({
      type: transformKey === 'position'
        ? 'transform_position'
        : transformKey === 'rotation'
          ? 'transform_rotation'
          : 'transform_scale',
      category: 'scene',
      success: true,
      details: {
        sceneName: sceneId,
        actorName,
        source: 'viewport',
      },
    });
  }
};

const emitActorChangeFast = (type, sceneId, actorName, nodeContext = {}) => {
  editorApi.sceneTools.selectActor(sceneId, type, actorName, {
    ...nodeContext,
    sourceViewport: 'main',
    sourceCameraHandle: Number(cameraBindingState.value.cameraHandle || 0),
  }).catch((error) => {
    logError('Failed to publish actor selection', error);
  });
};

const handleActorSelectionForObjectDock = async (payload = {}, maybeSceneId = '', maybeActorName = '') => {
  coronaEventBus.modelNodeSelection = pickedNodeIdentity(payload);
  coronaEventBus.emit('model-node-selection', coronaEventBus.modelNodeSelection);
  const actorType = String(payload?.actor_type || payload?.type || '').trim().toLowerCase();
  const sceneId = String(payload?.scene || payload?.scene_id || maybeSceneId || '').trim();
  const actorName = String(payload?.actor || payload?.actor_name || maybeActorName || '').trim();
  if (!actorName || actorType === 'scene') {
    viewportGizmoController.clearTarget();
    return;
  }

  const resolvedSceneId = sceneId || currentSceneId.value || DEFAULT_SCENE_NAME;
  setActorContext(resolvedSceneId, actorName);
  void seedActorTransformBaseline(resolvedSceneId, actorName);
  const ownsGizmo = isViewportGizmoSelectionOwner({
    viewportScope: 'main',
    cameraHandle: cameraBindingState.value.cameraHandle,
    selection: payload,
  });
  if (ownsGizmo) {
    await syncMainViewportGizmoSelection({
      ...payload,
      scene: resolvedSceneId,
      actor: actorName,
      actor_type: actorType,
    });
  } else {
    viewportGizmoController.clearTarget();
  }
  if (!dockStore.panels.Object?.open) {
    dockStore.openPanel('Object');
  }
};

const viewportPickController = createViewportPickController({
  getBridge: () => window.coronaBridge,
  getCameraBinding: () => cameraBindingState.value,
  getHitRect: getViewportHitRect,
  getRenderRect: getViewportRenderRect,
  getActorIndex: () => actorPickIndex,
  emitActorChange: (type, sceneId, actorName, nodeContext) => emitActorChangeFast(type, sceneId, actorName, nodeContext),
});

const viewportGizmoController = createViewportGizmoController({
  getBridge: () => window.coronaBridge,
  getCameraBinding: () => cameraBindingState.value,
  getHitRect: getViewportHitRect,
  getRenderRect: getViewportRenderRect,
});

const handleModelNodeGizmoSelection = (identity) => { if (identity) viewportGizmoController.clearTarget(); };
const syncMainViewportGizmoSelection = async (selection = {}, pickResult = null) => {
  if (coronaEventBus.modelNodeSelection) { viewportGizmoController.clearTarget(); return; }
  const sceneId =
    String(cameraBindingState.value.sceneId || currentSceneId.value || '').trim();
  let target = resolveViewportGizmoTarget({
    sceneId,
    selection,
    pickResult,
    actorIndex: actorPickIndex,
  });
  if (!target && selection?.actor && String(selection.actor_type || selection.type) !== 'scene') {
    await refreshActorPickIndex(sceneId).catch(() => false);
    target = resolveViewportGizmoTarget({
      sceneId,
      selection,
      pickResult,
      actorIndex: actorPickIndex,
    });
  }
  if (target && !coronaEventBus.modelNodeSelection) {
    viewportGizmoController.setTarget(target);
  } else {
    viewportGizmoController.clearTarget();
  }
  return target;
};

const viewportUiPointerController = createViewportUiPointerController({
  getBridge: () => window.coronaBridge,
  getCameraHandle: () => cameraBindingState.value.cameraHandle,
  getEnabled: () => viewportUiMode.value === 'stereo3d',
  getNativeCursorEnabled: () => nativeViewportCursorEnabled,
  getHitRect: getViewportHitRect,
  getRenderRect: getViewportRenderRect,
});

let cameraViewportSyncRafId = null;
let cameraViewportResizeObserver = null;
let lastCameraViewportSignature = '';

const syncCameraViewportRect = () => {
  if (!viewCurrent()) return false;
  const bridge = window.coronaBridge;
  const cameraHandle = Number(cameraBindingState.value.cameraHandle || 0);
  const rect = getViewportHitRect();
  if (!bridge || typeof bridge.setCameraViewport !== 'function' || !cameraHandle || !rect) {
    return false;
  }

  const scale = Math.max(Number(window.devicePixelRatio || 1), 0.01);
  const x = Math.max(Math.round(Number(rect.left || 0) * scale), 0);
  const y = Math.max(Math.round(Number(rect.top || 0) * scale), 0);
  const width = Math.max(Math.round(Number(rect.width || 0) * scale), 1);
  const height = Math.max(Math.round(Number(rect.height || 0) * scale), 1);
  const renderSize = computeCameraViewportRenderSize(
    Math.max(Number(rect.width || 0), 0),
    Math.max(Number(rect.height || 0), 0),
    scale,
  );
  const signature = `${cameraHandle}:${x}:${y}:${width}:${height}:${renderSize.width}:${renderSize.height}`;
  if (signature === lastCameraViewportSignature) {
    return true;
  }

  if (bridge.setCameraViewport(
    cameraHandle,
    x,
    y,
    width,
    height,
    renderSize.width,
    renderSize.height,
  )) {
    lastCameraViewportSignature = signature;
    return true;
  }
  return false;
};

const scheduleCameraViewportSync = () => {
  if (!viewCurrent()) return;
  if (cameraViewportSyncRafId != null) return;
  cameraViewportSyncRafId = requestAnimationFrame(() => {
    cameraViewportSyncRafId = null;
    syncCameraViewportRect();
  });
};

const handleViewportLayoutChange = () => {
  viewportLayoutVersion.value += 1;
  scheduleCameraViewportSync();
};

const syncViewportUiMode = () => {
  const mode = viewportUiModeStore.get(currentViewportUiDescriptor());
  viewportUiMode.value = mode;
  viewportUiModeStore.applyToBridge({
    bridge: window.coronaBridge,
    cameraHandle: cameraBindingState.value.cameraHandle,
    mode,
  });
  if (mode !== 'stereo3d') {
    viewportUiPointerController.hide();
  }
  syncViewportUiCalibrationPanel(mode);
};

const selectViewportUiMode = (mode) => {
  viewportUiMode.value = viewportUiModeStore.set(currentViewportUiDescriptor(), mode);
  viewportUiModeStore.applyToBridge({
    bridge: window.coronaBridge,
    cameraHandle: cameraBindingState.value.cameraHandle,
    mode: viewportUiMode.value,
  });
  if (viewportUiMode.value !== 'stereo3d') {
    viewportUiPointerController.hide();
  }
  syncViewportUiCalibrationPanel(viewportUiMode.value);
};

const cameraControls = createViewportCameraController({
  getPose: () => cameraBindingState.value.cameraHandle ? cameraState.value : null,
  setPose: (pose) => { cameraState.value = pose; },
  getSpeed: () => cameraSpeed.value,
  setSpeed: (speed) => { cameraSpeed.value = speed; },
  getSensitivity: () => mouseSensitivity.value,
  isCurrent: viewCurrent,
  isInputLocked: () => document.hidden || isEditorInputLocked(),
  submitPose: () => {
    if (!sendCameraUpdateFast()) {
      const sceneId = currentSceneId.value || DEFAULT_SCENE_NAME;
      void syncSceneCameraBinding(sceneId);
    }
  },
});
const isRealtimeCameraInputActive = cameraControls.isInputActive;
const scheduleCameraUpdate = cameraControls.scheduleUpdate;

const visionAvailable = ref(false);
const creativeRenderDefaultsBusy = ref(true);
const creativeRenderDefaultsError = ref('');
const mainRenderBackend = ref('vision');
const mainVisionRenderMode = ref('path_tracing');
const mainVisionAccumulation = ref(false);
const mainVisionAccumulationBusy = ref(false);
const mainVisionAccumulationError = ref('');
const mainVisionDenoise = ref(true);
const mainVisionDenoiseBusy = ref(false);
const mainVisionDenoiseError = ref('');
const mainVisionDenoiser = ref('reblur');
const mainVisionDenoiserBusy = ref(false);
const mainVisionDenoiserError = ref('');
const mainVisionStablePlanes = ref(true);
const mainVisionStablePlanesBusy = ref(false);
const mainVisionStablePlanesError = ref('');
const currentMainCamera = ref(null);
window.__coronaEditorInputLocks = window.__coronaEditorInputLocks instanceof Set
  ? window.__coronaEditorInputLocks
  : new Set();
const EDITOR_CONTROLS_KEY = '__coronaEditorControls';

// 物理参数状态
const physicsParams = ref({
  gravityX: 0.0,
  gravityY: -9.8,
  gravityZ: 0.0,
  floorY: 0.0,
  floorRestitution: 0.6,
  fixedDt: 1.0 / 60.0,
});

const mainRenderModeOptions = [
  { value: 'native', backend: 'native', label: 'Native' },
  ...visionRenderModes,
];
const mainRenderModeLabel = computed(() => {
  if (mainRenderBackend.value !== 'vision') {
    return 'Native';
  }
  return mainRenderModeOptions.find((mode) => mode.value === mainVisionRenderMode.value)?.label
    || 'Vision PT';
});
let pendingMainRenderSelection = null;
let pendingMainAccumulationSelection = null;
let pendingMainDenoiseSelection = null;
let pendingMainDenoiserSelection = null;
let pendingMainStablePlanesSelection = null;
const currentMainCameraId = () =>
  cameraBindingState.value.cameraId || cameraBindingState.value.cameraName || null;
const currentMainSceneId = () =>
  cameraBindingState.value.sceneId || currentSceneId.value || DEFAULT_SCENE_NAME;

// Cabbage assistant: world-scoped tutorial and node-logic tasks.
let unsubscribeNodeGraphReview = null;
let unsubscribeCabbageContext = null;
let unsubscribeCabbagePreWarnings = null;
let cabbageCandidateTimer = null;
let cabbageWorldLoadGeneration = 0;
const cabbageWorldInitializationRetry = createServiceInitializationRetry();
const ACTIVE_PROJECT_PATH_KEY = 'corona.activeProjectPath';

function normalizeActiveProjectPath(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

function readActiveProjectPath() {
  return String(window.localStorage?.getItem(ACTIVE_PROJECT_PATH_KEY) || '').trim();
}

let activeProjectPathSnapshot = normalizeActiveProjectPath(readActiveProjectPath());

function currentProjectReviewScopeId() {
  return reviewScopeId(readActiveProjectPath());
}

async function persistCabbageTaskActions(actions = []) {
  const validActions = Array.isArray(actions) ? actions.filter((item) => item?.task) : [];
  for (const action of validActions) {
    try {
      await cabbageContextService.updateTask(action);
    } catch (error) {
      console.warn('[CabbageContext] failed to persist task', error?.message || error);
    }
  }
  if (validActions.length) {
    void cabbageContextService.requestProfileScoreUpdate().catch(() => {});
  }
}

async function loadCabbageWorldContext({ reset = true } = {}) {
  if (!viewCurrent()) return null;
  const generation = ++cabbageWorldLoadGeneration;
  const expectedProjectPath = normalizeActiveProjectPath(readActiveProjectPath());
  const scopeId = currentProjectReviewScopeId();
  // Keep the last snapshot for this same world while the backend context is loading.
  // Publishing an empty reset here used to overwrite the cached task list, which made
  // the task board disappear whenever loading was slow or temporarily failed.
  const cachedSnapshot = readCabbageAssistantContext(scopeId);
  if (reset) {
    cabbageWorldInitializationRetry.cancel();
    cabbageAssistant.clearForProjectChange(scopeId);
    if (cachedSnapshot) cabbageAssistant.hydrateContext(cachedSnapshot);
    publishCabbageAssistantContext(cabbageAssistant);
  }
  try {
    const snapshot = await cabbageContextService.loadCurrentWorld();
    if (!viewCurrent() || generation !== cabbageWorldLoadGeneration
      || normalizeActiveProjectPath(readActiveProjectPath()) !== expectedProjectPath) {
      return null;
    }
    cabbageWorldInitializationRetry.cancel();
    cabbageAssistant.hydrateContext(snapshot);
    void cabbageContextService.requestProfileScoreUpdate().catch(() => {});
    const goal = snapshot?.worldGoal || {};
    if (goal.source === 'ai'
      && goal.status === 'generating'
      && String(goal.prompt || '').trim()) {
      void initializeWorldTasks({
        prompt: String(goal.prompt || '').trim(),
        mode: String(goal.mode || 'story'),
        waitForCompletion: false,
      }).catch((error) => {
        console.warn(
          '[CabbageContext] failed to resume world task generation',
          error?.message || error,
        );
      });
    }
    return snapshot;
  } catch (error) {
    if (viewCurrent() && generation === cabbageWorldLoadGeneration) {
      if (cachedSnapshot) cabbageAssistant.hydrateContext(cachedSnapshot);
      if (error?.retryable) {
        cabbageWorldInitializationRetry.schedule(() => {
          if (generation !== cabbageWorldLoadGeneration) return;
          void loadCabbageWorldContext({ reset: false });
        });
      } else {
        console.warn('[CabbageContext] failed to load world context', error?.message || error);
      }
    }
  }
  return null;
}

function clearNodeReviewForProjectChange() {
  actorTransformBaselines.clear();
  cancelPendingTransformEvents();
  void loadCabbageWorldContext({ reset: true });
}

function refreshCameraAfterProjectChange() {
  window.setTimeout(() => {
    void refreshSceneCameraBinding({
      force: true,
      preservePose: false,
    });
  }, 0);
}

function applyActualProjectChange(projectPath, { refreshCamera = true } = {}) {
  if (!viewCurrent()) return false;
  const normalizedPath = normalizeActiveProjectPath(projectPath);
  if (normalizedPath === activeProjectPathSnapshot) return false;

  activeProjectPathSnapshot = normalizedPath;
  // A node-generation request belongs to the world where it started. Cancel it
  // before loading the next world's context so a late DeepSeek response cannot
  // modify the newly opened world's node graph.
  void cancelActiveNodeGraphGeneration();
  clearNodeReviewForProjectChange();
  clearKnownEditorCameraInputLocks();
  void reconcileEditorCameraInputLocks();
  if (refreshCamera) refreshCameraAfterProjectChange();
  return true;
}

function onActiveProjectChanged(event) {
  const detail = event?.detail;
  const projectPath = typeof detail === 'string'
    ? detail
    : detail?.projectPath || detail?.path || readActiveProjectPath();
  applyActualProjectChange(projectPath);
}

function onEditorStorageChanged(event) {
  if (event?.key === viewportUiCalibrationStore.keyFor({}) && viewportUiMode.value === 'stereo3d') {
    applyViewportUiCalibration();
    return;
  }
  if (event?.key !== ACTIVE_PROJECT_PATH_KEY) return;
  applyActualProjectChange(event?.newValue);
}

async function handleNodeGraphReview(result) {
  if (result?.projectScopeId && result.projectScopeId !== currentProjectReviewScopeId()) return;
  if (result?.success !== true || result?.status !== 'ok') {
    if (result?.error) console.warn('[NodeGraphReview]', result.error);
    return;
  }
  const actions = cabbageAssistant.applyReview(result);
  publishCabbageAssistantContext(cabbageAssistant);
  await persistCabbageTaskActions(actions);
}

function promoteDueCabbageTasks(options = {}) {
  const promoted = cabbageAssistant.promoteDueCandidates(options);
  if (!promoted.length) return;
  publishCabbageAssistantContext(cabbageAssistant);
  void persistCabbageTaskActions(promoted.map((task) => ({ action: 'upsert', task })));
}

function onCabbageRunFailed(event) {
  promoteDueCabbageTasks({ runtimeFailed: true });
  if (event?.detail?.contextRecorded) return;
  void cabbageContextService.recordEvent({
    type: 'run_failed',
    category: 'runtime',
    success: false,
    details: {
      source: String(event?.detail?.source || 'editor'),
      error: String(event?.detail?.error || '').slice(0, 500),
    },
  });
}

// Assistant state has been initialized above.

// Apply Vision both before first binding and after restoring camera windows,
// which can recreate the camera from an archive that still remembers Native.
const initializeCreativeRenderMode = async () => {
  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  const cameraHandle = cameraBindingState.value.cameraHandle;
  const current = () => viewCurrent() && worldModeState.mode === 'creative'
    && currentMainSceneId() === sceneId && currentMainCameraId() === cameraId
    && cameraBindingState.value.cameraHandle === cameraHandle;
  creativeRenderDefaultsBusy.value = true;
  creativeRenderDefaultsError.value = '';
  try {
    if (!await initializeWorldRenderBackend({ api: editorApi, sceneId, cameraId, isCurrent: current })) return false;
    pendingMainRenderSelection = { sceneId, cameraId, backend: 'vision',
      visionMode: mainVisionRenderMode.value, expiresAt: Date.now() + 3000 };
    mainRenderBackend.value = 'vision';
    await syncSceneCameraBinding(sceneId, { preservePose: true });
    return true;
  } catch (error) {
    if (current()) {
      creativeRenderDefaultsError.value = `初始化创造模式渲染设置失败：${error.message}`;
      logError('Failed to initialize creative viewport rendering', error);
    }
    return false;
  } finally {
    creativeRenderDefaultsBusy.value = false;
  }
};

const selectMainRenderMode = async (mode) => {
  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  const previousBackend = mainRenderBackend.value;
  const previousMode = mainVisionRenderMode.value;

  try {
    if (mode === 'native') {
      pendingMainRenderSelection = {
        sceneId,
        cameraId,
        backend: 'native',
        visionMode: mainVisionRenderMode.value,
        expiresAt: Date.now() + 3000,
      };
      mainRenderBackend.value = 'native';
      const result = unwrapBridgeData(
        await editorApi.sceneTools.setRenderBackend('native', sceneId, cameraId),
      );
      mainRenderBackend.value = result?.mode || 'native';
      await syncSceneCameraBinding(sceneId);
      return true;
    }

    pendingMainRenderSelection = {
      sceneId,
      cameraId,
      backend: 'vision',
      visionMode: mode,
      expiresAt: Date.now() + 3000,
    };
    mainRenderBackend.value = 'vision';
    mainVisionRenderMode.value = mode;

    const modeResult = unwrapBridgeData(
      await editorApi.sceneTools.setVisionRenderMode(sceneId, cameraId, mode),
    );
    mainVisionRenderMode.value = modeResult?.pending ? mode : modeResult?.mode || mode;

    await editorApi.sceneTools.setOutputMode(sceneId, cameraId, 'final_color');

    const backendResult = unwrapBridgeData(
      await editorApi.sceneTools.setRenderBackend('vision', sceneId, cameraId),
    );
    mainRenderBackend.value = backendResult?.mode || 'native';
    if (mainRenderBackend.value !== 'vision') {
      pendingMainRenderSelection = null;
      return false;
    }
    await syncSceneCameraBinding(sceneId);
    return true;
  } catch (error) {
    pendingMainRenderSelection = null;
    mainRenderBackend.value = previousBackend;
    mainVisionRenderMode.value = previousMode;
    logError('Failed to set main viewport render mode', error);
    return false;
  }
};

const toggleMainVisionAccumulation = async () => {
  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  if (mainRenderBackend.value !== 'vision' || mainVisionRenderMode.value === 'ssat'
    || mainVisionAccumulationBusy.value || !cameraId) return false;
  const previous = mainVisionAccumulation.value;
  const previousSelection = pendingMainAccumulationSelection;
  const selection = { sceneId, cameraId, enabled: !previous };
  const isCurrent = () => currentMainSceneId() === sceneId && currentMainCameraId() === cameraId;
  pendingMainAccumulationSelection = selection;
  mainVisionAccumulationBusy.value = true;
  mainVisionAccumulation.value = selection.enabled;
  mainVisionAccumulationError.value = '';
  try {
    const result = unwrapBridgeData(
      await editorApi.sceneTools.setVisionAccumulation(sceneId, cameraId, selection.enabled),
    );
    if (isCurrent()) {
      selection.enabled = result?.pending || typeof result?.enabled !== 'boolean'
        ? selection.enabled : result.enabled;
      mainVisionAccumulation.value = selection.enabled;
      if (currentMainCamera.value) currentMainCamera.value.vision_accumulation = selection.enabled;
    }
    return true;
  } catch (error) {
    if (isCurrent()) {
      pendingMainAccumulationSelection = previousSelection;
      mainVisionAccumulation.value = previous;
      if (currentMainCamera.value) currentMainCamera.value.vision_accumulation = previous;
      mainVisionAccumulationError.value = error.message;
    }
    logError('Failed to set main viewport sample accumulation', error);
    return false;
  } finally {
    mainVisionAccumulationBusy.value = false;
  }
};

const toggleMainVisionDenoise = async () => {
  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  if (mainRenderBackend.value !== 'vision' || mainVisionRenderMode.value === 'ssat'
    || mainVisionDenoiseBusy.value || !cameraId) return false;
  const previous = mainVisionDenoise.value;
  const previousSelection = pendingMainDenoiseSelection;
  const selection = { sceneId, cameraId, enabled: !previous };
  const isCurrent = () => currentMainSceneId() === sceneId && currentMainCameraId() === cameraId;
  pendingMainDenoiseSelection = selection;
  mainVisionDenoiseBusy.value = true;
  mainVisionDenoise.value = selection.enabled;
  mainVisionDenoiseError.value = '';
  try {
    const result = unwrapBridgeData(
      await editorApi.sceneTools.setVisionDenoise(sceneId, cameraId, selection.enabled),
    );
    if (isCurrent()) {
      selection.enabled = result?.pending || typeof result?.enabled !== 'boolean'
        ? selection.enabled : result.enabled;
      mainVisionDenoise.value = selection.enabled;
      if (currentMainCamera.value) currentMainCamera.value.vision_denoise = selection.enabled;
    }
    return true;
  } catch (error) {
    if (isCurrent()) {
      pendingMainDenoiseSelection = previousSelection;
      mainVisionDenoise.value = previous;
      if (currentMainCamera.value) currentMainCamera.value.vision_denoise = previous;
      mainVisionDenoiseError.value = error.message;
    }
    logError('Failed to set main viewport denoising', error);
    return false;
  } finally {
    mainVisionDenoiseBusy.value = false;
  }
};

const selectMainVisionDenoiser = async (type) => {

  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  if (mainRenderBackend.value !== 'vision' || mainVisionRenderMode.value === 'ssat'
    || mainVisionDenoiserBusy.value || !cameraId) return false;
  const previous = mainVisionDenoiser.value;
  const previousSelection = pendingMainDenoiserSelection;
  const selection = { sceneId, cameraId, type };
  const isCurrent = () => currentMainSceneId() === sceneId && currentMainCameraId() === cameraId;
  pendingMainDenoiserSelection = selection;
  mainVisionDenoiserBusy.value = true;
  mainVisionDenoiser.value = type;
  mainVisionDenoiserError.value = '';
  try {
    const result = unwrapBridgeData(
      await editorApi.sceneTools.setVisionDenoiser(sceneId, cameraId, type),
    );
    if (isCurrent()) {
      if (!result?.pending && result?.type) selection.type = result.type;
      mainVisionDenoiser.value = selection.type;
      if (currentMainCamera.value) currentMainCamera.value.vision_denoiser = selection.type;
    }
    return true;
  } catch (error) {
    if (isCurrent()) {
      pendingMainDenoiserSelection = previousSelection;
      mainVisionDenoiser.value = previous;
      if (currentMainCamera.value) currentMainCamera.value.vision_denoiser = previous;
      mainVisionDenoiserError.value = error.message;
    }
    logError('Failed to set main viewport denoiser type', error);
    return false;
  } finally {
    mainVisionDenoiserBusy.value = false;
  }
};

const toggleMainVisionStablePlanes = async () => {
  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  if (mainRenderBackend.value !== 'vision' || mainVisionRenderMode.value !== 'restir'
    || mainVisionStablePlanesBusy.value || !cameraId) return false;
  const previous = mainVisionStablePlanes.value;
  const previousSelection = pendingMainStablePlanesSelection;
  const selection = { sceneId, cameraId, enabled: !previous };
  const isCurrent = () => currentMainSceneId() === sceneId && currentMainCameraId() === cameraId;
  pendingMainStablePlanesSelection = selection;
  mainVisionStablePlanesBusy.value = true;
  mainVisionStablePlanes.value = selection.enabled;
  mainVisionStablePlanesError.value = '';
  try {
    const result = unwrapBridgeData(
      await editorApi.sceneTools.setVisionStablePlanes(sceneId, cameraId, selection.enabled),
    );
    if (isCurrent()) {
      selection.enabled = result?.pending || typeof result?.enabled !== 'boolean'
        ? selection.enabled : result.enabled;
      mainVisionStablePlanes.value = selection.enabled;
      if (currentMainCamera.value) currentMainCamera.value.vision_stable_planes = selection.enabled;
    }
    return true;
  } catch (error) {
    if (isCurrent()) {
      pendingMainStablePlanesSelection = previousSelection;
      mainVisionStablePlanes.value = previous;
      if (currentMainCamera.value) currentMainCamera.value.vision_stable_planes = previous;
      mainVisionStablePlanesError.value = error.message;
    }
    logError('Failed to set main viewport stable planes', error);
    return false;
  } finally {
    mainVisionStablePlanesBusy.value = false;
  }
};

const isVector3 = (value) => Array.isArray(value) && value.length === 3;

let sceneCameraBindingRequestRevision = 0;
let sceneCameraBindingRefreshPromise = null;
let sceneCameraBindingLastRefreshAt = 0;
const SCENE_CAMERA_BINDING_REFRESH_INTERVAL_MS = 1000;

const sceneGridEnabledFromSnapshot = (snapshot = {}) => {
  if (typeof snapshot?.grid?.enabled === 'boolean') return snapshot.grid.enabled;
  if (typeof snapshot?.floor_grid_enabled === 'boolean') return snapshot.floor_grid_enabled;
  return null;
};

const applySceneSnapshot = (sceneId, payload, { preservePose = false } = {}) => {
  // Native snapshots use `scene` for the route, not a nested snapshot.
  const data = payload?.data ?? payload;
  const snapshot = data?.scene && typeof data.scene === 'object' && !Array.isArray(data.scene)
    ? data.scene : data;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    resetRealtimeCameraInput();
    currentMainCamera.value = null;
    mainVisionAccumulation.value = false;
    pendingMainAccumulationSelection = null;
    mainVisionDenoise.value = false;
    pendingMainDenoiseSelection = null;
    mainVisionDenoiser.value = 'scene';
    pendingMainDenoiserSelection = null;
    mainVisionStablePlanes.value = true;
    pendingMainStablePlanesSelection = null;
    cameraBindingState.value = {
      sceneId: sceneId ?? cameraBindingState.value.sceneId,
      cameraId: null,
      cameraName: null,
      cameraHandle: null,
    };
    return;
  }

  const normalizedSceneId =
    snapshot.scene_id ?? snapshot.sceneId ?? snapshot.id ?? sceneId ?? DEFAULT_SCENE_NAME;
  const gridEnabled = sceneGridEnabledFromSnapshot(snapshot);
  if (gridEnabled !== null) sceneGridEnabled.value = gridEnabled;
  const sun = snapshot.sun && typeof snapshot.sun === 'object' ? snapshot.sun : {};
  const lightDirection = Array.isArray(sun.direction) ? sun.direction : [1, 1, 1];
  sceneLightSettings.enabled = sun.enabled !== false;
  sceneLightSettings.direction.x = Number(lightDirection[0] ?? 1);
  sceneLightSettings.direction.y = Number(lightDirection[1] ?? 1);
  sceneLightSettings.direction.z = Number(lightDirection[2] ?? 1);
  const cameras = Array.isArray(snapshot.cameras) ? snapshot.cameras : [];
  actorPickIndex = indexActorsByHandle(Array.isArray(snapshot.actors) ? snapshot.actors : []);
  const activeCameraName =
    snapshot.active_camera_name ?? snapshot.activeCameraName ?? cameras[0]?.name ?? null;
  const activeCamera =
    cameras.find((cam) => cam?.name === activeCameraName) ?? cameras[0] ?? snapshot.camera ?? null;

  const nextHandle = activeCamera?.handle ?? activeCamera?.camera_handle ?? null;
  const bindingChanged = cameraBindingState.value.sceneId !== normalizedSceneId
    || cameraBindingState.value.cameraHandle !== nextHandle;
  if (bindingChanged) resetRealtimeCameraInput();
  cameraBindingState.value = {
    sceneId: normalizedSceneId,
    cameraId: activeCamera?.camera_id ?? activeCamera?.id ?? null,
    cameraName: activeCameraName,
    cameraHandle: activeCamera?.handle ?? activeCamera?.camera_handle ?? null,
  };
  currentMainCamera.value = activeCamera;
  if (bindingChanged) {
    mainVisionAccumulationError.value = '';
    mainVisionDenoiseError.value = '';
    mainVisionDenoiserError.value = '';
    mainVisionStablePlanesError.value = '';
  }
  lastCameraViewportSignature = '';
  scheduleCameraViewportSync();
  syncViewportUiMode();
  if (
    pendingMainRenderSelection &&
    pendingMainRenderSelection.sceneId === normalizedSceneId &&
    pendingMainRenderSelection.cameraId === currentMainCameraId() &&
    Date.now() < pendingMainRenderSelection.expiresAt
  ) {
    mainRenderBackend.value = pendingMainRenderSelection.backend;
    mainVisionRenderMode.value = pendingMainRenderSelection.visionMode;
  } else {
    pendingMainRenderSelection = null;
    mainRenderBackend.value = activeCamera?.render_backend || 'native';
    mainVisionRenderMode.value = normalizeVisionRenderMode(activeCamera?.vision_render_mode);
  }
  const snapshotAccumulation = visionAccumulationFromCamera(activeCamera);
  if (pendingMainAccumulationSelection?.sceneId === normalizedSceneId
    && pendingMainAccumulationSelection.cameraId === currentMainCameraId()) {
    mainVisionAccumulation.value = pendingMainAccumulationSelection.enabled;
    if (snapshotAccumulation === pendingMainAccumulationSelection.enabled) pendingMainAccumulationSelection = null;
  } else {
    pendingMainAccumulationSelection = null;
    mainVisionAccumulation.value = snapshotAccumulation;
  }
  const snapshotDenoise = visionDenoiseFromCamera(activeCamera);
  if (pendingMainDenoiseSelection?.sceneId === normalizedSceneId
    && pendingMainDenoiseSelection.cameraId === currentMainCameraId()) {
    mainVisionDenoise.value = pendingMainDenoiseSelection.enabled;
    if (snapshotDenoise === pendingMainDenoiseSelection.enabled) pendingMainDenoiseSelection = null;
  } else {
    pendingMainDenoiseSelection = null;
    mainVisionDenoise.value = snapshotDenoise;
  }
  const snapshotDenoiser = visionDenoiserFromCamera(activeCamera);
  if (pendingMainDenoiserSelection?.sceneId === normalizedSceneId
    && pendingMainDenoiserSelection.cameraId === currentMainCameraId()) {
    mainVisionDenoiser.value = pendingMainDenoiserSelection.type;
    if (snapshotDenoiser === pendingMainDenoiserSelection.type) pendingMainDenoiserSelection = null;
  } else {
    pendingMainDenoiserSelection = null;
    mainVisionDenoiser.value = snapshotDenoiser;
  }
  const snapshotStablePlanes = visionStablePlanesFromCamera(activeCamera);
  if (pendingMainStablePlanesSelection?.sceneId === normalizedSceneId
    && pendingMainStablePlanesSelection.cameraId === currentMainCameraId()) {
    mainVisionStablePlanes.value = pendingMainStablePlanesSelection.enabled;
    if (snapshotStablePlanes === pendingMainStablePlanesSelection.enabled) pendingMainStablePlanesSelection = null;
  } else {
    pendingMainStablePlanesSelection = null;
    mainVisionStablePlanes.value = snapshotStablePlanes;
  }
  if (currentMainCamera.value) {
    currentMainCamera.value.vision_render_mode = mainVisionRenderMode.value;
    currentMainCamera.value.vision_accumulation = mainVisionAccumulation.value;
    currentMainCamera.value.vision_denoise = mainVisionDenoise.value;
    currentMainCamera.value.vision_denoiser = mainVisionDenoiser.value;
    currentMainCamera.value.vision_stable_planes = mainVisionStablePlanes.value;
  }

  if (
    activeCamera &&
    (!preservePose || bindingChanged) &&
    !isRealtimeCameraInputActive() &&
    (isVector3(activeCamera.position) ||
      isVector3(activeCamera.forward) ||
      isVector3(activeCamera.world_up))
  ) {
    cameraState.value = {
      position: isVector3(activeCamera.position)
        ? [...activeCamera.position]
        : [...cameraState.value.position],
      forward: isVector3(activeCamera.forward)
        ? [...activeCamera.forward]
        : [...cameraState.value.forward],
      up: isVector3(activeCamera.world_up) ? [...activeCamera.world_up] : [...cameraState.value.up],
      fov: Number.isFinite(Number(activeCamera.fov))
        ? Number(activeCamera.fov)
        : cameraState.value.fov,
    };
    // Keep the editor main viewport aligned with the scene's active camera on load.
    scheduleCameraUpdate();
  }
};

const syncSceneCameraBinding = async (sceneId, { preservePose = false } = {}) => {
  if (!viewCurrent() || !sceneId) {
    return false;
  }

  const requestRevision = ++sceneCameraBindingRequestRevision;
  try {
    const result = await editorApi.scene.getSnapshot(sceneId);
    if (!viewCurrent() || requestRevision !== sceneCameraBindingRequestRevision) return false;
    applySceneSnapshot(sceneId, result, { preservePose });
    broadcastViewportControlsState();
    return true;
  } catch (e) {
    if (requestRevision === sceneCameraBindingRequestRevision) {
      logError('Failed to sync scene camera binding', e);
    }
    return false;
  }
};

const updateSceneLight = async (axis = '') => {
  if (sceneLightBusy.value) return false;
  const sceneId = cameraBindingState.value.sceneId
    || currentSceneId.value
    || DEFAULT_SCENE_NAME;
  const direction = sceneLightSettings.direction;
  sceneLightBusy.value = true;
  try {
    await editorApi.sceneTools.sunDirection(sceneId, sceneLightSettings.enabled, [
      Number(direction.x) || 0,
      Number(direction.y) || 0,
      Number(direction.z) || 0,
    ]);
    void cabbageContextService.recordEvent({
      type: 'lighting_changed',
      category: 'lighting',
      success: true,
      details: {
        sceneName: sceneId,
        axis: String(axis || '').toLowerCase(),
        value: axis ? Number(direction[axis]) || 0 : undefined,
        source: 'property_panel',
      },
    });
    return true;
  } catch (error) {
    logError('更新场景光照失败', error);
    await syncSceneCameraBinding(sceneId, { preservePose: true });
    return false;
  } finally {
    sceneLightBusy.value = false;
  }
};

const refreshSceneCameraBinding = ({ force = false, preservePose = true } = {}) => {
  const sceneId = currentSceneId.value || cameraBindingState.value.sceneId || DEFAULT_SCENE_NAME;
  const now = Date.now();
  if (!force && sceneCameraBindingRefreshPromise) return sceneCameraBindingRefreshPromise;
  if (!force && now - sceneCameraBindingLastRefreshAt < SCENE_CAMERA_BINDING_REFRESH_INTERVAL_MS) {
    return Promise.resolve(true);
  }

  sceneCameraBindingLastRefreshAt = now;
  const refreshPromise = syncSceneCameraBinding(sceneId, { preservePose });
  const trackedPromise = refreshPromise.finally(() => {
    if (sceneCameraBindingRefreshPromise === trackedPromise) {
      sceneCameraBindingRefreshPromise = null;
    }
  });
  sceneCameraBindingRefreshPromise = trackedPromise;
  return trackedPromise;
};

const restoreCameraViews = async (sceneId) => {
  if (!viewCurrent() || !sceneId) return;
  try {
    const result = await editorApi.sceneTools.listCameraViews(sceneId);
    const payload = result?.data ?? result;
    const openCameras = Array.isArray(payload?.cameras)
      ? payload.cameras.filter((camera) => camera.view_open)
      : [];
    for (const camera of openCameras) {
      if (!viewCurrent()) return;
      if (!await initializeWorldRenderBackend({ api: editorApi, sceneId,
        cameraId: camera.camera_id || camera.name, isCurrent: viewCurrent })) return;
      await appService.createCameraView({ ...camera, scene_id: sceneId });
    }
  } catch (e) {
    logError('Failed to restore camera views', e);
  }
};

const scratchMouseButton = (button) => ({ 0: 'LeftButton', 1: 'MiddleButton', 2: 'RightButton' }[button] || '');
const sendScratchPointerEvent = (type, event, pickedActor = '') => {
  const renderRect = getViewportRenderRect();
  const localX = Number(event.clientX || 0) - Number(renderRect.left || 0);
  const localY = Number(event.clientY || 0) - Number(renderRect.top || 0);
  editorApi.scripts.sendMouseEvent(
    type,
    scratchMouseButton(event.button),
    event.clientX || 0,
    event.clientY || 0,
    localX,
    localY,
    renderRect.width || 0,
    renderRect.height || 0,
    pickedActor || ''
  ).catch(() => {});
};
const vectorDistance = (left = [], right = []) => Math.sqrt(
  left.reduce((sum, value, index) => sum + ((Number(value) || 0) - (Number(right[index]) || 0)) ** 2, 0)
);

const handleWheel = (event) => {
  sendScratchPointerEvent('wheel', event);
  const before = [...cameraState.value.position];
  if (!cameraControls.wheel(event)) return;
  const actualDelta = vectorDistance(before, cameraState.value.position);
  if (actualDelta > 1e-6) {
    void cabbageContextService.recordEvent({
      type: 'camera_moved',
      category: 'camera',
      success: true,
      details: { interaction: 'wheel', actualDelta },
    });
  }
};

const handleViewportFocus = () => {
  void cabbageContextService.recordEvent({
    type: 'viewport_focused',
    category: 'viewport',
    success: true,
    details: { source: 'user' },
  });
};

const handleKeyDown = (event) => {
  // 检查输入框是否聚焦
  const inputElement = document.getElementById('new-tab-name');
  if (inputElement && inputElement === document.activeElement) {
    return;
  }
  const tag = event.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (
    (event.key === 'Escape' || event.code === 'Escape')
    && viewportGizmoController.isDragging()
  ) {
    event.preventDefault();
    viewportGizmoController.cancel('escape');
    return;
  }
  const modifiers = [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
  ].filter(Boolean).join(',');
  // Native SDL is authoritative in the editor; this is browser-dev fallback.
  if (!window.coronaBridge && !event.__coronaScratchKeyForwarded) {
    event.__coronaScratchKeyForwarded = true;
    editorApi.scripts.sendKeyEvent(
      event.code || event.key || '',
      modifiers,
      event.key || event.code || ''
    ).catch(() => {});
  }
  if (isEditorInputLocked()) {
    resetRealtimeCameraInput();
    return;
  }

  const key = cameraMovementKey(event);
  if (key) {
    const wasDown = cameraControls.isKeyDown(key);
    if (!cameraControls.keyDown(event)) return;
    if (!wasDown) {
      if (movementAxisGroups[key]) {
        cameraMovementGestures.set(key, [...cameraState.value.position]);
      }
      // A project/scene reload recreates native cameras and invalidates their old
      // handles. Refresh once when a new movement gesture starts instead of
      // continuing to publish WASD/QE updates to a released camera.
      void refreshSceneCameraBinding({ preservePose: true });
    }
  }
};

const handleKeyUp = (event) => {
  cameraControls.keyUp(event);
  const tag = event.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (!window.coronaBridge && !event.__coronaScratchKeyForwarded) {
    event.__coronaScratchKeyForwarded = true;
    editorApi.scripts.sendKeyUpEvent(
      event.code || event.key || '',
      event.key || event.code || ''
    ).catch(() => {});
  }
  if (isEditorInputLocked()) {
    resetRealtimeCameraInput();
    return;
  }

  const key = cameraMovementKey(event);
  if (key) {
    const gestureStart = cameraMovementGestures.get(key);
    cameraMovementGestures.delete(key);
    const axisGroup = movementAxisGroups[key];
    if (gestureStart && axisGroup) {
      const actualDelta = vectorDistance(gestureStart, cameraState.value.position);
      if (actualDelta > 1e-6) {
        void cabbageContextService.recordEvent({
          type: 'camera_moved',
          category: 'camera',
          success: true,
          details: { key: key.toUpperCase(), axisGroup, actualDelta },
        });
      }
    }
  }
};

const isEditorInputLocked = () => {
  const locks = window.__coronaEditorInputLocks;
  return Boolean(
    (locks instanceof Set && locks.size > 0)
  );
};

const resetRealtimeCameraInput = () => {
  cameraControls.resetInput();
  cameraMovementGestures.clear();
  mouseRotateStartForward = null;
  mouseRotateMoved = false;
};

const setEditorCameraInputLock = (reason, locked) => {
  const locks = window.__coronaEditorInputLocks instanceof Set
    ? window.__coronaEditorInputLocks
    : new Set();
  window.__coronaEditorInputLocks = locks;
  if (locked) locks.add(reason);
  else locks.delete(reason);
  if (locks.size > 0) {
    resetRealtimeCameraInput();
  }
};

function clearKnownEditorCameraInputLocks() {
  setEditorCameraInputLock('node_graph', false);
}

let cameraInputLockReconcileToken = 0;
async function reconcileEditorCameraInputLocks() {
  const token = ++cameraInputLockReconcileToken;
  try {
    const result = await editorApi.scripts.getStatus();
    if (!viewCurrent() || token !== cameraInputLockReconcileToken) return;
    const state = unwrapBridgeData(result) || {};
    setEditorCameraInputLock('node_graph', Boolean(state.threadAlive && state.inputLocked));
  } catch (error) {
    logWarn('无法读取脚本输入状态', error);
  }
}

// ---- 向量工具 ----
const vec3 = {
  length(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  },
  normalize(v) {
    const len = vec3.length(v);
    return len > 1e-8 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 1];
  },
  cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  },
  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
};

const viewportCursorShape = () => (cameraControls.isLooking() ? 'grabbing' : 'arrow');

const handleViewportPointer = (event) => {
  viewportGizmoController.pointer(event, event.type);
  if (event.type === 'pointerup') {
    try {
      viewportPickSurfaceRef.value?.releasePointerCapture?.(event.pointerId);
    } catch (_) {
      // Pointer capture may already have been released.
    }
  }
  sendScratchPointerEvent(event.type === 'pointerup' ? 'mouseup' : 'move', event);
  viewportUiPointerController.send(event, event.type, viewportCursorShape());
};

const handleViewportPointerDown = (event) => {
  try {
    viewportPickSurfaceRef.value?.setPointerCapture?.(event.pointerId);
  } catch (_) {
    // Pointer capture is best effort on embedded browser surfaces.
  }
  gizmoDownConsumed = false;
  gizmoDownPointerId = event.pointerId;
  gizmoDownRequestId = viewportGizmoController.pointer(event, event.type) || '';
  sendScratchPointerEvent('mousedown', event);
  viewportUiPointerController.send(
    event,
    event.type,
    event.button === 2 ? 'grabbing' : viewportCursorShape(),
  );
};

const handleViewportPointerCancel = (event) => {
  resetRealtimeCameraInput();
  if (event.pointerId !== gizmoDownPointerId) return;
  try {
    viewportPickSurfaceRef.value?.releasePointerCapture?.(event.pointerId);
  } catch (_) {
    // Pointer capture may already have been released.
  }
  viewportGizmoController.cancel('pointercancel');
};

const handleViewportPointerLeave = () => {
  viewportUiPointerController.hide();
};

const handleViewportGizmoPointerResult = (payload = {}) => {
  const result = viewportGizmoController.handleResult(payload);
  if (payload.requestId === gizmoDownRequestId && payload.consumed) {
    gizmoDownConsumed = true;
  }
  if (result.status === 'ended' || result.status === 'cancelled') {
    gizmoDownRequestId = '';
    gizmoDownPointerId = null;
  }
};

const handleMainViewportBlur = () => {
  resetRealtimeCameraInput();
  viewportGizmoController.cancel('blur');
};
const handleMainViewportVisibility = () => {
  if (document.hidden) handleMainViewportBlur();
};

let pendingScratchClick = null;

const finishPendingScratchClick = (pickedActor = '') => {
  const pending = pendingScratchClick;
  if (!pending) return;
  pendingScratchClick = null;
  sendScratchPointerEvent('click', pending.event, pickedActor);
};

const handleViewportScratchClick = (event) => {
  const eventSnapshot = {
    clientX: Number(event?.clientX || 0),
    clientY: Number(event?.clientY || 0),
    button: Number(event?.button || 0),
  };
  const requestId = viewportPickController.pickAt(event);
  if (!requestId) {
    sendScratchPointerEvent('click', eventSnapshot, '');
    return;
  }

  // A newer click supersedes an unfinished request. The engine may still
  // complete the old request, but viewportPickController filters it by the
  // latest requestId and finishScratchClickFromPick ignores its old pending
  // entry. This keeps a later blank click from being swallowed by a slow pick.
  pendingScratchClick = {
    requestId,
    event: eventSnapshot,
  };
};

const handleViewportClick = (event) => {
  // A single click owns selection/clearing. Ignore the synthetic second
  // click from a rapid double-click so it cannot reset an active Gizmo drag.
  if (Number(event?.detail || 0) > 1) return;
  if (gizmoClickTimer) window.clearTimeout(gizmoClickTimer);
  const eventSnapshot = {
    clientX: Number(event?.clientX || 0),
    clientY: Number(event?.clientY || 0),
    button: Number(event?.button || 0),
  };
  gizmoClickTimer = window.setTimeout(() => {
    gizmoClickTimer = 0;
    if (!gizmoDownConsumed) handleViewportScratchClick(eventSnapshot);
  }, 45);
};

const finishScratchClickFromPick = (payload, result) => {
  if (!pendingScratchClick || payload?.requestId !== pendingScratchClick.requestId) return;
  if (result?.status === 'stale') return;
  const pickedActor =
    result?.actor?.name ||
    payload?.actorName ||
    payload?.name ||
    payload?.actor?.name ||
    '';
  finishPendingScratchClick(pickedActor);
};

const onMouseDown = (event) => {
  if (!viewportPickSurfaceRef.value?.contains(event.target)) return;
  if (cameraControls.pointerDown(event)) {
    mouseRotateStartForward = [...cameraState.value.forward];
    mouseRotateMoved = false;
  }
};

const onMouseMove = (event) => {
  if (cameraControls.pointerMove(event)) mouseRotateMoved = true;
};

const onMouseUp = (event) => {
  if (!cameraControls.pointerUp(event)) return;
  const actualDelta = mouseRotateStartForward
    ? vectorDistance(mouseRotateStartForward, cameraState.value.forward) : 0;
  if (mouseRotateMoved && actualDelta > 1e-6) {
    void cabbageContextService.recordEvent({
      type: 'camera_rotated',
      category: 'camera',
      success: true,
      details: { interaction: 'right_mouse_drag', actualDelta },
    });
  }
  mouseRotateStartForward = null;
  mouseRotateMoved = false;
};

const onContextMenu = (event) => {
  if (isEditorInputLocked()) return;
  event.preventDefault();
};

const refreshActorPickIndex = async (sceneId) => {
  if (!sceneId) return false;
  const result = await editorApi.sceneTools.listSceneTree(sceneId);
  const snapshot = result?.data ?? result;
  const actors = Array.isArray(snapshot?.actors) ? snapshot.actors : [];
  actorPickIndex = indexActorsByHandle(actors);
  return actorPickIndex.size > 0;
};

const applyActorPickResult = (result, payload = result?.payload) => {
  if (result.status === 'pending' || result.status === 'stale') return;
  if (result.status === 'selected') coronaEventBus.emit('model-node-picked', { ...payload, actor_name: payload?.actor_name || result.actor?.name });
  if (result.status === 'miss') coronaEventBus.emit('model-node-picked', payload);

  if (result.status !== 'selected') {
    const fallbackActorHandle = Number(payload?.actorHandle || 0);
    if (
      result.status === 'unknown' &&
      payload?.status === 'success' &&
      Number.isFinite(fallbackActorHandle) &&
      fallbackActorHandle > 0
    ) {
      emitActorChangeFast(
        payload?.actorType || 'actor',
        payload?.sceneId || cameraBindingState.value.sceneId || DEFAULT_SCENE_NAME,
        payload?.actorName || `Actor ${fallbackActorHandle}`
      );
      return;
    }
    return;
  }

  // 选中结果已由 viewportPickController 内部 emitActorChange 驱动属性面板，
  // 此处无需额外处理。
};

const handleActorPickResult = (payload) => {
  const result = viewportPickController.handlePickResult(payload);
  applyActorPickResult(result, payload);
  // Gizmo synchronization is owned exclusively by actorSelectionChanged.
  // A miss still publishes the empty scene selection so that the same
  // selection path clears the property panel and Gizmo exactly once.
  if (result.status === 'miss') {
    emitActorChangeFast(
      'scene',
      payload?.sceneId || cameraBindingState.value.sceneId || DEFAULT_SCENE_NAME,
      '',
    );
  }
  finishScratchClickFromPick(payload, result);
};

const sendCameraUpdateFast = () => {
  if (!viewCurrent()) return;
  // During Blockly/node-graph execution the editor must not publish camera
  // poses. Keyboard/mouse events are still sent to Scratch by their handlers.
  if (isEditorInputLocked()) return true;
  const handle = cameraBindingState.value.cameraHandle;
  if (!handle) return false;
  const bridge = window.coronaBridge;
  if (!bridge || typeof bridge.cameraMove !== 'function') {
    if (!window._coronaBridgeWarned) {
      window._coronaBridgeWarned = true;
      console.warn(
        '[Camera] coronaBridge 缺失或 cameraMove 不可用，' +
        'CEF 子进程可能未运行。快速通道摄像头更新已禁用。'
      );
    }
    return false;
  }
  try {
    bridge.cameraMove(
      handle,
      [...cameraState.value.position],
      [...cameraState.value.forward],
      [...cameraState.value.up],
      cameraState.value.fov
    );
    return true;
  } catch (e) {
    return false;
  }
};

/** 发送当前 cameraState 到引擎——已移除，全部走快速通道 */

const handleCameraMove = (direction) => cameraControls.move(direction);

const handleApplyPhysics = async () => {
  const sceneId = currentSceneId.value || DEFAULT_SCENE_NAME;

  try {
    const result = await editorApi.sceneTools.setPhysicsParams(sceneId, {
      gravity: [
        physicsParams.value.gravityX,
        physicsParams.value.gravityY,
        physicsParams.value.gravityZ,
      ],
      floor_y: physicsParams.value.floorY,
      floor_restitution: physicsParams.value.floorRestitution,
      fixed_dt: physicsParams.value.fixedDt,
    });
    const data = unwrapBridgeData(result);
    if (data?.status === 'error' || data?.success === false) {
      logError('Apply physics params failed', data?.message || data?.error);
      return false;
    }
    return true;
  } catch (e) {
    logError('Apply physics params failed', e);
    return false;
  }
};

const loadPhysicsParams = async () => {
  const sceneId = currentSceneId.value || DEFAULT_SCENE_NAME;
  try {
    const result = await editorApi.sceneTools.getPhysicsParams(sceneId);
    const data = result?.data ?? result;
    if (data && data.status !== 'error') {
      const g = data.gravity || [0, -9.8, 0];
      physicsParams.value.gravityX = g[0];
      physicsParams.value.gravityY = g[1];
      physicsParams.value.gravityZ = g[2];
      physicsParams.value.floorY = data.floor_y ?? 0.0;
      physicsParams.value.floorRestitution = data.floor_restitution ?? 0.6;
      physicsParams.value.fixedDt = data.fixed_dt ?? 1.0 / 60.0;
      return true;
    }
    return false;
  } catch (e) {
    logError('Load physics params failed', e);
    return false;
  }
};

const unwrapBridgeData = (result) => result?.data ?? result;

const stopProjectResourceLoadPolling = () => {
  if (projectResourceLoadPollTimer !== null) {
    window.clearTimeout(projectResourceLoadPollTimer);
    projectResourceLoadPollTimer = null;
  }
};

const pollProjectResourceLoadStatus = async () => {
  if (!viewCurrent()) return;
  stopProjectResourceLoadPolling();
  try {
    const status = unwrapBridgeData(
      await editorApi.project.getProjectLoadStatus(),
    );
    if (!viewCurrent()) return;
    projectResourceLoadStatus.value = status?.active ? status : null;
    if (status?.loading) {
      projectResourceLoadPollTimer = window.setTimeout(
        pollProjectResourceLoadStatus,
        250,
      );
    } else {
      projectResourceLoadStatus.value = null;
    }
  } catch (error) {
    projectResourceLoadStatus.value = null;
    logWarn('Failed to query project resource load status', error);
  }
};

const getPhysicsSnapshot = () => ({
  gravityX: Number(physicsParams.value.gravityX),
  gravityY: Number(physicsParams.value.gravityY),
  gravityZ: Number(physicsParams.value.gravityZ),
  floorY: Number(physicsParams.value.floorY),
  floorRestitution: Number(physicsParams.value.floorRestitution),
  fixedDt: Number(physicsParams.value.fixedDt),
});

const coerceNumber = (value, fallback) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const setCameraSpeedFromPanel = (value) => {
  cameraControls.setSpeed(coerceNumber(value, cameraSpeed.value));
  broadcastViewportControlsState();
  return getEditorControlsState();
};

const setViewportUiModeFromPanel = (mode) => {
  if (!viewportUiModeItems.some((item) => item.mode === mode)) {
    return false;
  }
  selectViewportUiMode(mode);
  broadcastViewportControlsState();
  return getEditorControlsState();
};

const setSceneGridEnabledFromPanel = async (enabled, requestedSceneId = '') => {
  const sceneId = currentSceneId.value || DEFAULT_SCENE_NAME;
  const requested = String(requestedSceneId || '').trim();
  if (requested && requested !== sceneId) {
    await syncSceneCameraBinding(sceneId, { preservePose: true });
    broadcastViewportControlsState();
    return getEditorControlsState();
  }

  const nextEnabled = Boolean(enabled);
  try {
    await editorApi.sceneTools.floorGrid(sceneId, nextEnabled);
    sceneGridEnabled.value = nextEnabled;
    broadcastViewportControlsState();
    return getEditorControlsState();
  } catch (error) {
    logError('更新场景编辑网格失败', error);
    return false;
  }
};

const applyPhysicsFromSettings = async (nextParams = {}) => {
  const current = getPhysicsSnapshot();
  physicsParams.value = {
    gravityX: coerceNumber(nextParams.gravityX, current.gravityX),
    gravityY: coerceNumber(nextParams.gravityY, current.gravityY),
    gravityZ: coerceNumber(nextParams.gravityZ, current.gravityZ),
    floorY: coerceNumber(nextParams.floorY, current.floorY),
    floorRestitution: coerceNumber(nextParams.floorRestitution, current.floorRestitution),
    fixedDt: Math.max(0.001, coerceNumber(nextParams.fixedDt, current.fixedDt)),
  };
  const applied = await handleApplyPhysics();
  if (applied === false) return false;
  return getEditorControlsState();
};

const currentMainRenderMode = () =>
  mainRenderBackend.value === 'vision' ? mainVisionRenderMode.value : 'native';

const getEditorControlsState = () => ({
  available: true,
  sceneId: currentSceneId.value || DEFAULT_SCENE_NAME,
  visionAvailable: visionAvailable.value,
  renderMode: currentMainRenderMode(),
  renderLabel: mainRenderModeLabel.value,
  renderModes: mainRenderModeOptions.map((mode) => ({
    ...mode,
    active: currentMainRenderMode() === mode.value,
    disabled: mode.backend === 'vision' && !visionAvailable.value,
  })),
  viewportUiMode: viewportUiMode.value,
  viewportUiModes: viewportUiModeItems.map((item) => ({
    ...item,
    active: item.mode === viewportUiMode.value,
  })),
  cameraSpeed: Number(cameraSpeed.value),
  gridEnabled: Boolean(sceneGridEnabled.value),
  physics: getPhysicsSnapshot(),
});

const broadcastViewportControlsState = () => {
  if (!viewCurrent()) return;
  appService
    .crossTabBroadcast('viewport-controls-state', getEditorControlsState())
    .catch(() => {});
};

const handleViewportControlsRequest = async (payload = {}) => {
  if (!payload || typeof payload !== 'object') {
    broadcastViewportControlsState();
    return;
  }

  if (payload.action === 'setViewportUiMode') {
    setViewportUiModeFromPanel(payload.mode);
    return;
  }

  if (payload.action === 'selectRenderMode') {
    if (payload.sceneId === getEditorControlsState().sceneId &&
        mainRenderModeOptions.some((mode) => mode.value === payload.mode &&
          (mode.backend !== 'vision' || visionAvailable.value))) {
      await selectMainRenderMode(payload.mode);
    }
    broadcastViewportControlsState();
    return;
  }

  if (payload.action === 'setCameraSpeed') {
    setCameraSpeedFromPanel(payload.value);
    return;
  }

  if (payload.action === 'setGridEnabled') {
    await setSceneGridEnabledFromPanel(payload.enabled, payload.sceneId);
    return;
  }

  broadcastViewportControlsState();
};

const registerEditorControls = () => {
  window[EDITOR_CONTROLS_KEY] = {
    getState: getEditorControlsState,
    refreshPhysics: async () => {
      const loaded = await loadPhysicsParams();
      if (loaded === false) return false;
      return getEditorControlsState();
    },
    applyPhysics: applyPhysicsFromSettings,
    selectRenderMode: selectMainRenderMode,
    setViewportUiMode: setViewportUiModeFromPanel,
    setCameraSpeed: setCameraSpeedFromPanel,
    setGridEnabled: setSceneGridEnabledFromPanel,
  };
};

const unregisterEditorControls = () => {
  if (window[EDITOR_CONTROLS_KEY]?.getState === getEditorControlsState) {
    delete window[EDITOR_CONTROLS_KEY];
  }
};

const onSceneImportProgress = payload => {
  importProgress.value = payload?.active && dockStore.panels.SceneTools?.open ? payload : null;
};
watch(() => dockStore.panels.SceneTools?.open, open => {
  if (!open) importProgress.value = null;
});

const applyCameraPose = (pose = {}) => {
  const toVector3 = (value) => {
    if (!isVector3(value)) return null;
    const next = value.map((item) => Number(item));
    return next.every((item) => Number.isFinite(item)) ? next : null;
  };

  const position = toVector3(pose.position);
  const forward = toVector3(pose.forward);
  const up = toVector3(pose.up);
  if (!position || !forward || !up) {
    return false;
  }

  resetRealtimeCameraInput();
  cameraState.value = {
    position,
    forward,
    up,
    fov: Number.isFinite(Number(pose.fov)) ? Number(pose.fov) : cameraState.value.fov,
  };

  if (Number.isFinite(Number(pose.cameraHandle))) {
    cameraBindingState.value = {
      ...cameraBindingState.value,
      cameraHandle: Number(pose.cameraHandle),
      cameraId: pose.cameraId ?? cameraBindingState.value.cameraId,
      cameraName: pose.cameraName ?? cameraBindingState.value.cameraName,
    };
  }

  scheduleCameraUpdate();
  return true;
};


let projectOpenedRefreshRevision = 0;
const onProjectOpenedEvent = async (payload = {}) => {
  const refreshRevision = ++projectOpenedRefreshRevision;
  const openedSceneRoute = resolveOpenedProjectScene(payload);
  applyActualProjectChange(payload?.path, { refreshCamera: false });

  try {
    const result = await editorApi.main.onInit();
    if (!viewCurrent() || refreshRevision !== projectOpenedRefreshRevision) return;
    currentSceneId.value = resolveOpenedProjectScene(result?.data ?? result)
      || openedSceneRoute || DEFAULT_SCENE_NAME;
    resetRealtimeCameraInput();
    const sceneId = currentSceneId.value || openedSceneRoute || DEFAULT_SCENE_NAME;
    await syncSceneCameraBinding(sceneId, { preservePose: false });
    if (!viewCurrent() || refreshRevision !== projectOpenedRefreshRevision) return;
    syncViewportUiMode();
    scheduleCameraViewportSync();
    broadcastViewportControlsState();
  } catch (error) {
    logError('Failed to restore editor state after opening project', error);
  }
};

onMounted(async () => {
  // A reused CEF page must not inherit camera locks from a previous world.
  // Real active workers are added back by reconcileEditorCameraInputLocks().
  clearKnownEditorCameraInputLocks();
  const result = await editorApi.main.onInit();
  if (!viewCurrent()) return;
  const initData = result?.data ?? result;
  const openedSceneId = resolveOpenedProjectScene(initData) || DEFAULT_SCENE_NAME;
  currentSceneId.value = openedSceneId;
  if (!await initializeCreativeRenderMode() || !viewCurrent()) return;
  await pollProjectResourceLoadStatus();
  if (!viewCurrent()) return;
  try {
    const visionResult = unwrapBridgeData(await editorApi.sceneTools.isVisionAvailable());
    if (!viewCurrent()) return;
    visionAvailable.value = !!visionResult?.available;
  } catch (error) {
    visionAvailable.value = false;
  }

  if (!viewCurrent()) return;
  // 等待 Vue 渲染 dock 面板（SceneBar/Object 等），确保 eventBus 监听就绪
  await nextTick();
  if (!viewCurrent()) return;
  const initialSceneId = currentSceneId.value || DEFAULT_SCENE_NAME;
  await syncSceneCameraBinding(currentSceneId.value || DEFAULT_SCENE_NAME);
  if (!viewCurrent()) return;
  syncViewportUiMode();
  scheduleCameraViewportSync();
  if (typeof ResizeObserver !== 'undefined' && viewportPickSurfaceRef.value) {
    cameraViewportResizeObserver = new ResizeObserver(handleViewportLayoutChange);
    cameraViewportResizeObserver.observe(viewportPickSurfaceRef.value);
  }
  await restoreCameraViews(initialSceneId);
  if (!viewCurrent()) return;
  // Restoring detached camera windows can overlap native scene initialization.
  // Always take a second snapshot after that phase so the main viewport owns the
  // current camera handle rather than the camera object that was just destroyed.
  await syncSceneCameraBinding(initialSceneId);
  if (!viewCurrent()) return;
  if (!await initializeCreativeRenderMode() || !viewCurrent()) return;
  // The CEF window can survive project creation/switching, so discard stale
  // frontend lock reasons using the backend's self-healed runtime truth.
  await reconcileEditorCameraInputLocks();
  if (!viewCurrent()) return;

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('resize', handleViewportLayoutChange);
  window.addEventListener('blur', handleMainViewportBlur);
  window.addEventListener('pointercancel', resetRealtimeCameraInput);
  document.addEventListener('visibilitychange', handleMainViewportVisibility);
  registerEditorControls();

  // 跨窗口事件监听：panel / loading / viewport 等 UI 本地通道
  coronaEventBus.on('creative-panel-open', handleCreativePanelOpen);
  coronaEventBus.on('scene-import-progress', onSceneImportProgress);
  coronaEventBus.on('camera-pose-request', applyCameraPose);
  coronaEventBus.on('viewport-controls-request', handleViewportControlsRequest);
  coronaEventBus.on('node-graph-panel-open-request', handleNodeGraphPanelOpenRequest);
  if (!viewCurrent()) return;
  projectOpenedCallbackToken = await subscribeWhileCurrent(callback => editorApi.scene.observe('project', callback), onProjectOpenedEvent);
  if (!viewCurrent()) return;
  if (!viewCurrent()) return;
  actorSelectionCallbackToken = await subscribeWhileCurrent(callback => editorApi.scene.observe('selection', callback), handleActorSelectionForObjectDock);
  if (!viewCurrent()) return;
  actorTransformCallbackToken = await subscribeWhileCurrent(callback => editorApi.scene.observe('transform', callback), handleActorTransformForCabbage);
  if (!viewCurrent()) return;
  actorPickResultCallbackToken = await subscribeWhileCurrent(callback => editorApi.scene.observe('actorPickResult', callback), handleActorPickResult);
  if (!viewCurrent()) return;
  gizmoPointerResultCallbackToken =
    await subscribeWhileCurrent(callback => editorApi.scene.observe('viewportGizmoPointerResult', callback), handleViewportGizmoPointerResult);
    if (!viewCurrent()) return;
  coronaEventBus.on('model-node-selection', handleModelNodeGizmoSelection);

  await syncSceneCameraBinding(initialSceneId);
  if (!viewCurrent()) return;
  broadcastViewportControlsState();

  // Subscribe to proactive DeepSeek reviews and the world-scoped assistant context.
  unsubscribeNodeGraphReview = subscribeNodeGraphReviews(handleNodeGraphReview);
  unsubscribeCabbageContext = subscribeCabbageAssistantContext(
    (snapshot) => cabbageAssistant.hydrateContext(snapshot),
    { projectScopeId: currentProjectReviewScopeId, emitCurrent: true }
  );
  unsubscribeCabbagePreWarnings = subscribeCabbagePreWarnings(
    (warning) => cabbageAssistant.showPreWarning(warning),
    { projectScopeId: currentProjectReviewScopeId }
  );
  await loadCabbageWorldContext({ reset: true });
  if (!viewCurrent()) return;
  cabbageCandidateTimer = window.setInterval(() => promoteDueCabbageTasks(), 1000);
  window.addEventListener('cabbage-run-failed', onCabbageRunFailed);
  window.addEventListener('corona-active-project-changed', onActiveProjectChanged);
  window.addEventListener('storage', onEditorStorageChanged);
});

onUnmounted(() => {
  viewDisposed = true;
  ++cabbageWorldLoadGeneration;
  ++cameraInputLockReconcileToken;
  cameraControls.dispose();
  cancelPendingTransformEvents();
  void cancelActiveNodeGraphGeneration();
  cabbageWorldInitializationRetry.cancel();
  stopProjectResourceLoadPolling();
  clearKnownEditorCameraInputLocks();
  unregisterEditorControls();
  unsubscribeNodeGraphReview?.();
  unsubscribeNodeGraphReview = null;
  unsubscribeCabbageContext?.();
  unsubscribeCabbageContext = null;
  unsubscribeCabbagePreWarnings?.();
  unsubscribeCabbagePreWarnings = null;
  if (cabbageCandidateTimer) window.clearInterval(cabbageCandidateTimer);
  cabbageCandidateTimer = null;
  window.removeEventListener('cabbage-run-failed', onCabbageRunFailed);
  void cabbageContextService.flush();
  window.removeEventListener('corona-active-project-changed', onActiveProjectChanged);
  window.removeEventListener('storage', onEditorStorageChanged);
  closeTutorialSessionChannel();
  coronaEventBus.off('model-node-selection', handleModelNodeGizmoSelection);
  coronaEventBus.off('creative-panel-open', handleCreativePanelOpen);
  coronaEventBus.off('scene-import-progress', onSceneImportProgress);
  coronaEventBus.off('camera-pose-request', applyCameraPose);
  coronaEventBus.off('viewport-controls-request', handleViewportControlsRequest);
  coronaEventBus.off('node-graph-panel-open-request', handleNodeGraphPanelOpenRequest);
  if (gizmoClickTimer) window.clearTimeout(gizmoClickTimer);
  gizmoClickTimer = 0;
  viewportGizmoController.cancel('cancel');
  viewportGizmoController.clearTarget();
  if (actorPickResultCallbackToken) {
    editorApi.off(actorPickResultCallbackToken).catch((error) => {
      logError('Failed to unregister actor pick result callback', error);
    });
    actorPickResultCallbackToken = null;
  }
  if (actorSelectionCallbackToken) {
    editorApi.off(actorSelectionCallbackToken).catch((error) => {
      logError('Failed to unregister actor selection callback', error);
    });
    actorSelectionCallbackToken = null;
  }
  if (gizmoPointerResultCallbackToken) {
    editorApi.off(gizmoPointerResultCallbackToken).catch((error) => {
      logError('Failed to unregister viewport gizmo callback', error);
    });
    gizmoPointerResultCallbackToken = null;
  }
  if (actorTransformCallbackToken) {
    editorApi.off(actorTransformCallbackToken).catch((error) => {
      logError('Failed to unregister actor transform callback', error);
    });
    actorTransformCallbackToken = null;
  }
  actorTransformBaselines.clear();
  if (projectOpenedCallbackToken) {
    editorApi.off(projectOpenedCallbackToken).catch((error) => {
      logError('Failed to unregister project opened callback', error);
    });
    projectOpenedCallbackToken = null;
  }
  window.removeEventListener('resize', handleViewportLayoutChange);
  window.removeEventListener('blur', handleMainViewportBlur);
  window.removeEventListener('pointercancel', resetRealtimeCameraInput);
  document.removeEventListener('visibilitychange', handleMainViewportVisibility);
  sceneCameraBindingRequestRevision += 1;
  sceneCameraBindingRefreshPromise = null;
  if (cameraViewportSyncRafId != null) {
    cancelAnimationFrame(cameraViewportSyncRafId);
    cameraViewportSyncRafId = null;
  }
  cameraViewportResizeObserver?.disconnect?.();
  cameraViewportResizeObserver = null;
  viewportPickController.dispose();
  viewportUiPointerController.dispose();
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('contextmenu', onContextMenu);
});
provideCreativePanelState(() => ({
  sceneId: currentMainSceneId(), cameraId: currentMainCameraId(),
  cameraHandle: cameraBindingState.value.cameraHandle,
  available: !creativeRenderDefaultsBusy.value && Boolean(cameraBindingState.value.cameraHandle),
  mainRenderBackend: mainRenderBackend.value, mainRenderModeLabel: mainRenderModeLabel.value,
  mainRenderModeOptions, visionAvailable: visionAvailable.value,
  mainVisionRenderMode: mainVisionRenderMode.value, mainVisionDenoiser: mainVisionDenoiser.value,
  mainVisionAccumulation: mainVisionAccumulation.value, mainVisionDenoise: mainVisionDenoise.value,
  mainVisionStablePlanes: mainVisionStablePlanes.value,
  mainVisionAccumulationBusy: mainVisionAccumulationBusy.value, mainVisionDenoiseBusy: mainVisionDenoiseBusy.value,
  mainVisionDenoiserBusy: mainVisionDenoiserBusy.value, mainVisionStablePlanesBusy: mainVisionStablePlanesBusy.value,
  mainVisionAccumulationError: mainVisionAccumulationError.value, mainVisionDenoiseError: mainVisionDenoiseError.value,
  mainVisionDenoiserError: mainVisionDenoiserError.value, mainVisionStablePlanesError: mainVisionStablePlanesError.value,
  creativeRenderDefaultsBusy: creativeRenderDefaultsBusy.value, creativeRenderDefaultsError: creativeRenderDefaultsError.value,
  cameraSpeed: cameraSpeed.value, sceneGridEnabled: sceneGridEnabled.value, viewportUiMode: viewportUiMode.value,
  sceneLightSettings, sceneLightBusy: sceneLightBusy.value,
  physics: getPhysicsSnapshot(),
}), {
  refreshPhysics: loadPhysicsParams, applyPhysics: applyPhysicsFromSettings,
  selectMainRenderMode, selectMainVisionDenoiser, toggleMainVisionAccumulation,
  toggleMainVisionDenoise, toggleMainVisionStablePlanes, setCameraSpeedFromPanel,
  setSceneLightEnabled: async enabled => {
    sceneLightSettings.enabled = Boolean(enabled);
    await updateSceneLight();
  },
  setSceneLightDirection: async (axis, value) => {
    if (!['x', 'y', 'z'].includes(axis) || !Number.isFinite(value)) return;
    sceneLightSettings.direction[axis] = value;
    await updateSceneLight(axis);
  },
}, viewCurrent);

</script>

<style scoped>
[data-viewport-pick-surface] {
  touch-action: none;
}

.viewport-cursor-hidden,
.viewport-cursor-hidden * {
  cursor: none !important;
}

.dock-shortcut-bar {
  position: absolute; right: 16px; bottom: 16px; z-index: 2147483000;
  display: flex; align-items: center; gap: 7px; padding: 7px;
  border: 1px solid rgba(179, 153, 93, .48); border-radius: 9px;
  background: rgba(13, 12, 8, .96); box-shadow: 0 10px 30px rgba(0, 0, 0, .45);
  backdrop-filter: blur(8px);
}
.dock-shortcut-button {
  display: inline-flex; align-items: center; gap: 6px; border: 1px solid #56491f;
  border-radius: 6px; background: #18150d; color: #d8cfb7; padding: 7px 10px;
  font-size: 12px; line-height: 1; transition: border-color .15s ease, background .15s ease, color .15s ease;
}
.dock-shortcut-button:hover { border-color: #b79232; color: #fff4cd; }
.dock-shortcut-button.active { border-color: #b3995d; background: #332712; color: #fff4cd; box-shadow: inset 0 0 0 1px rgba(179, 153, 93, .18); }
.dock-shortcut-icon { display:grid; place-items:center; width:19px; height:19px; border-radius:4px; background:#0e0d09; color:#d6b66b; font-size:10px; font-weight:700; }

@media (max-width: 720px) {
  .dock-shortcut-bar { max-width: calc(100vw - 32px); overflow-x: auto; }
  .dock-shortcut-button { padding: 7px 8px; white-space: nowrap; }
}
</style>
