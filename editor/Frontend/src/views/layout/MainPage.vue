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
import { editorApi } from '@/api/editorApi.js';
import { getWebMessages } from '@/api/webMessages.js';
import { getWebDocumentIdentity } from '@/api/webDocument.js';
import { createViewportCalibrationService } from '@/services/viewportCalibrationService.js';
import { createViewLifetime } from '@/utils/viewLifetime.js';
import { appService, isCurrentWindowEvent } from '@/services/appService.js';
import { viewportControlsService } from '@/services/viewportControlsService.js';
import { worldModeState } from '@/services/worldModeService.js';
import { initializeWorldRenderBackend } from '@/services/worldRenderPolicy.js';
import { useErrorHandler } from '@/composables/useErrorHandler.js';
import { useDockStore } from '@/stores/dockStore.js';
import { PLUGIN_MANIFEST } from '@/config/pluginManifest.js';
import { pickedNodeIdentity } from '@/utils/modelHierarchy.js';
import { coronaEventBus } from '@/utils/eventBus.js';
import { createViewportPickController, indexActorsByHandle } from '@/utils/viewportPick.js';
import { createScriptInputSender } from '@/utils/scriptInput.js';
import { cameraMovementKey, createViewportCameraController, readAppliedCameraPose } from '@/utils/viewportCameraController.js';
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
import { closeTutorialSessionChannel } from '@/services/cabbageTutorialSessionService.js';
import { provideCreativePanelState } from '@/services/creativePanelState.js';
import { subscribeProjectChanged } from '@/services/projectMessages.js';

const { error: logError, warn: logWarn } = useErrorHandler('MainPage');

// Every asynchronous continuation belongs to the world instance that mounted it.
const worldRevision = worldModeState.revision;
const viewLifetime = createViewLifetime(() => worldModeState.revision === worldRevision);
const viewCurrent = viewLifetime.current;
const subscribeWhileCurrent = (register, handler) => viewLifetime.subscribe(register, handler,
  token => editorApi.off(token));

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
let stopProjectChanged = null;

const currentSceneId = ref(DEFAULT_SCENE_NAME);
const environmentArchiveSession = ref('');

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
  archiveSession: '',
});
let actorPickIndex = new Map();
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

// 光场 3D UI 标定：主文档持有活动值，标定面板通过公共 Web 消息修改；
// 切到 stereo3d 自动打开标定 dock 面板并推送当前值，切回 flat2d 关闭。
const viewportUiCalibrationStore = createViewportUiCalibrationStore();
const webMessages = getWebMessages();
const viewportCalibration = createViewportCalibrationService(webMessages, {
  owner: getWebDocumentIdentity().owner, main: true, store: viewportUiCalibrationStore,
});
const VIEWPORT_UI_CALIBRATION_PANEL = 'LightFieldCalibration';
const applyViewportUiCalibration = () => {
  viewportUiCalibrationStore.applyToNative({
    api: editorApi.viewport,
    sceneId: cameraBindingState.value.sceneId,
    cameraId: cameraBindingState.value.cameraId,
    archiveSession: cameraBindingState.value.archiveSession,
    calibration: viewportCalibration.read(),
  }).catch(error => console.warn('[Viewport] Native configuration failed', error));
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

const seedActorTransformBaseline = async (sceneId, actorName, isCurrent = () => true) => {
  const scene = String(sceneId || '').trim();
  const actor = String(actorName || '').trim();
  const archive = cameraBindingState.value.archiveSession;
  if (!scene || !actor || !archive || cameraBindingState.value.sceneId !== scene || !viewCurrent() || !isCurrent()) return;
  const key = actorTransformKey(scene, actor);
  const context = mainSceneOperation(`transform:${key}`);
  if (!context.current() || context.archive !== archive || context.sceneId !== scene) return;
  try {
    const data = await editorApi.scene.readActorProperties(scene, actor, { archive_session: archive });
    if (!viewCurrent() || !context.current() || !isCurrent() || cameraBindingState.value.archiveSession !== archive
        || cameraBindingState.value.sceneId !== scene || data?.archive_session !== archive || data?.scene !== scene) return;
    actorTransformBaselines.set(
      key,
      normalizeActorTransform(data.geometry || {}),
    );
  } catch (_) {
    // Selection should still open the Object Dock when a baseline cannot be read.
  }
};

const handleActorTransformForCabbage = (payload = {}) => {
  const sceneId = String(payload?.scene || payload?.scene_id || '').trim();
  const actorName = String(payload?.actor || payload?.actor_name || '').trim();
  if (!viewCurrent() || !sceneId || !actorName || sceneId !== currentSceneId.value
      || !environmentArchiveSession.value || payload.archive_session !== environmentArchiveSession.value) return;
  const key = actorTransformKey(sceneId, actorName);
  mainSceneOperations.delete(`transform:${key}`);
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
  editorApi.scene.selectActor(sceneId, type, actorName, {
    ...nodeContext,
    sourceViewport: 'main',
  }).catch((error) => {
    logError('Failed to publish actor selection', error);
  });
};

const handleActorSelectionForObjectDock = async (payload = {}, maybeSceneId = '', maybeActorName = '') => {
  if (!viewCurrent()) return false;
  const actorType = String(payload?.actor_type || payload?.type || '').trim().toLowerCase();
  const sceneId = String(payload?.scene || payload?.scene_id || maybeSceneId || '').trim();
  const actorName = String(payload?.actor || payload?.actor_name || maybeActorName || '').trim();
  const resolvedSceneId = sceneId || currentSceneId.value || DEFAULT_SCENE_NAME;
  const archive = String(payload?.archive_session || payload?.archiveSession || '').trim();
  if (resolvedSceneId !== (currentSceneId.value || DEFAULT_SCENE_NAME)
      || (archive && archive !== environmentArchiveSession.value)) return false;
  coronaEventBus.modelNodeSelection = pickedNodeIdentity(payload);
  coronaEventBus.emit('model-node-selection', coronaEventBus.modelNodeSelection);
  const context = mainSelectionOperation();
  if (!context.current()) return false;
  if (!actorName || actorType === 'scene') {
    viewportGizmoController.clearTarget();
    return true;
  }

  void seedActorTransformBaseline(resolvedSceneId, actorName, context.current);
  const ownsGizmo = isViewportGizmoSelectionOwner({
    viewportScope: 'main',
    cameraId: cameraBindingState.value.cameraId,
    selection: payload,
  });
  if (ownsGizmo) {
    await syncMainViewportGizmoSelection({
      ...payload,
      scene: resolvedSceneId,
      actor: actorName,
      actor_type: actorType,
    }, null, context);
  } else {
    viewportGizmoController.clearTarget();
  }
  if (!context.current()) return false;
  if (!dockStore.panels.Object?.open) {
    dockStore.openPanel('Object');
  }
  return true;
};

const viewportPickController = createViewportPickController({
  api: editorApi,
  getCameraBinding: () => cameraBindingState.value,
  getHitRect: getViewportHitRect,
  getRenderRect: getViewportRenderRect,
  onResult: (payload, result) => handleActorPickResult(payload, result),
  emitActorChange: (type, sceneId, actorName, nodeContext) => emitActorChangeFast(type, sceneId, actorName, nodeContext),
});

const viewportGizmoController = createViewportGizmoController({
  getApi: () => editorApi,
  getCameraBinding: () => cameraBindingState.value,
  getHitRect: getViewportHitRect,
  getRenderRect: getViewportRenderRect,
  onResult: result => {
    if (result.requestId === gizmoDownRequestId && result.consumed) gizmoDownConsumed = true;
    if (result.status === 'ended' || result.status === 'cancelled') { gizmoDownRequestId = ''; gizmoDownPointerId = null; }
  },
});

const handleModelNodeGizmoSelection = (identity) => {
  mainSceneOperations.delete('selection');
  if (viewCurrent() && identity) viewportGizmoController.clearTarget();
};
const syncMainViewportGizmoSelection = async (selection = {}, pickResult = null, context = mainSelectionOperation()) => {
  if (!context.current()) return null;
  if (coronaEventBus.modelNodeSelection) { viewportGizmoController.clearTarget(); return; }
  const sceneId =
    String(cameraBindingState.value.sceneId || currentSceneId.value || '').trim();
  if (sceneId !== context.sceneId || cameraBindingState.value.archiveSession !== context.archive) return null;
  let target = resolveViewportGizmoTarget({
    sceneId,
    selection,
    pickResult,
    actorIndex: actorPickIndex,
  });
  if (!target && selection?.actor && String(selection.actor_type || selection.type) !== 'scene') {
    await refreshActorPickIndex(sceneId, context.current).catch(() => false);
    if (!context.current()) return null;
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
  api: editorApi.viewport,
  getBinding: () => cameraBindingState.value,
  getEnabled: () => viewportUiMode.value === 'stereo3d',
  getNativeCursorEnabled: () => nativeViewportCursorEnabled,
  getHitRect: getViewportHitRect,
  getRenderRect: getViewportRenderRect,
});

let cameraViewportSyncRafId = null;
let cameraViewportResizeObserver = null;
let lastCameraViewportSignature = '';

const syncCameraViewportRect = async () => {
  if (!viewCurrent()) return false;
  const { sceneId, cameraId, archiveSession } = cameraBindingState.value;
  const rect = getViewportHitRect();
  if (!sceneId || !cameraId || !archiveSession || !rect) {
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
  const signature = `${archiveSession}:${sceneId}:${cameraId}:${x}:${y}:${width}:${height}:${renderSize.width}:${renderSize.height}`;
  if (signature === lastCameraViewportSignature) {
    return true;
  }

  lastCameraViewportSignature = signature;
  try {
    await editorApi.viewport.configure(sceneId, cameraId, {
      archive_session: archiveSession,
      bounds: { x, y, width, height, renderWidth: renderSize.width, renderHeight: renderSize.height },
    });
    return true;
  } catch (error) {
    if (lastCameraViewportSignature === signature) lastCameraViewportSignature = '';
    console.warn('[Viewport] Native bounds update failed', error);
    return false;
  }
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
  viewportUiModeStore.applyToNative({
    api: editorApi.viewport,
    sceneId: cameraBindingState.value.sceneId,
    cameraId: cameraBindingState.value.cameraId,
    archiveSession: cameraBindingState.value.archiveSession,
    mode,
  }).catch(error => console.warn('[Viewport] Native configuration failed', error));
  if (mode !== 'stereo3d') {
    viewportUiPointerController.hide();
  }
  syncViewportUiCalibrationPanel(mode);
};

const selectViewportUiMode = (mode) => {
  viewportUiMode.value = viewportUiModeStore.set(currentViewportUiDescriptor(), mode);
  viewportUiModeStore.applyToNative({
    api: editorApi.viewport,
    sceneId: cameraBindingState.value.sceneId,
    cameraId: cameraBindingState.value.cameraId,
    archiveSession: cameraBindingState.value.archiveSession,
    mode: viewportUiMode.value,
  }).catch(error => console.warn('[Viewport] Native configuration failed', error));
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
let unregisterViewportControls = null;

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

const mainRenderOperations = new Map();
const mainCameraOperation = (kind) => {
  const sceneId = currentMainSceneId(), cameraId = currentMainCameraId();
  const { archiveSession: archive, cameraHandle } = cameraBindingState.value;
  const token = {};
  mainRenderOperations.set(kind, token);
  return { sceneId, cameraId, archive, current: () => viewCurrent() && !!archive && !!cameraId
    && mainRenderOperations.get(kind) === token
    && sceneId === currentMainSceneId() && cameraId === currentMainCameraId()
    && archive === cameraBindingState.value.archiveSession && archive === environmentArchiveSession.value
    && cameraHandle === cameraBindingState.value.cameraHandle };
};
const retireMainRenderOperations = () => {
  mainRenderOperations.clear();
  creativeRenderDefaultsBusy.value = false;
  creativeRenderDefaultsError.value = '';
  pendingMainRenderSelection = null;
  pendingMainAccumulationSelection = null;
  pendingMainDenoiseSelection = null;
  pendingMainDenoiserSelection = null;
  pendingMainStablePlanesSelection = null;
  mainVisionAccumulationBusy.value = false;
  mainVisionDenoiseBusy.value = false;
  mainVisionDenoiserBusy.value = false;
  mainVisionStablePlanesBusy.value = false;
};

const mainSceneOperations = new Map();
const mainEnvironmentWrites = new Map();
let mainEnvironmentRevision = 0;
const mainSceneOperation = (kind) => {
  const sceneId = currentSceneId.value || DEFAULT_SCENE_NAME, archive = environmentArchiveSession.value;
  const token = {};
  mainSceneOperations.set(kind, token);
  return { sceneId, archive, current: () => viewCurrent() && !!archive
    && sceneId === (currentSceneId.value || DEFAULT_SCENE_NAME) && archive === environmentArchiveSession.value
    && mainSceneOperations.get(kind) === token };
};

const mainSelectionOperation = () => {
  const context = mainSceneOperation('selection');
  const { sceneId, cameraId, cameraHandle, archiveSession } = cameraBindingState.value;
  return { ...context, current: () => context.current()
    && sceneId === cameraBindingState.value.sceneId && cameraId === cameraBindingState.value.cameraId
    && cameraHandle === cameraBindingState.value.cameraHandle
    && archiveSession === cameraBindingState.value.archiveSession };
};
const beginEnvironmentWrite = (kind) => {
  const context = mainSceneOperation(kind);
  if (context.current()) {
    mainEnvironmentRevision++;
    mainEnvironmentWrites.set(kind, context);
  }
  return { ...context, finish: () => {
    if (mainEnvironmentWrites.get(kind) !== context) return;
    mainEnvironmentWrites.delete(kind);
    mainEnvironmentRevision++;
  } };
};

// Cabbage assistant: world-scoped tutorial and node-logic tasks.
let unsubscribeNodeGraphReview = null;
let unsubscribeCabbageContext = null;
let unsubscribeCabbagePreWarnings = null;
let cabbageCandidateTimer = null;
let cabbageWorldLoadGeneration = 0;
const cabbageWorldInitializationRetry = createServiceInitializationRetry();
function normalizeActiveProjectPath(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

function readActiveProjectPath() {
  return String(worldModeState.activeProjectPath || '').trim();
}

let activeProjectPathSnapshot = normalizeActiveProjectPath(readActiveProjectPath());

function currentProjectReviewScopeId() {
  return reviewScopeId(readActiveProjectPath());
}

async function persistCabbageTaskActions(actions = []) {
  const validActions = Array.isArray(actions) ? actions.filter((item) => item?.task) : [];
  if (!validActions.length || !viewCurrent()) return;
  // Each batch remains independent; scene/archive retirement invalidates all batches.
  const kind = Symbol('cabbage-tasks');
  const context = mainSceneOperation(kind);
  const projectPath = normalizeActiveProjectPath(readActiveProjectPath());
  const current = () => context.current()
    && projectPath === normalizeActiveProjectPath(readActiveProjectPath());
  try {
    for (const action of validActions) {
      if (!current()) return;
      try {
        await cabbageContextService.updateTask(action);
      } catch (error) {
        if (!current()) return;
        console.warn('[CabbageContext] failed to persist task', error?.message || error);
      }
    }
    if (current()) {
      void cabbageContextService.requestProfileScoreUpdate().catch(() => {});
    }
  } finally {
    mainSceneOperations.delete(kind);
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
        mode: 'creative',
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
  const projectPath = typeof event === 'string'
    ? event
    : event?.projectPath || event?.path || readActiveProjectPath();
  applyActualProjectChange(projectPath);
}

let stopViewportUiCalibrationMessages = null;

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
  const context = mainCameraOperation('mode');
  const { sceneId, cameraId, archive } = context;
  if (!context.current() || !cameraBindingState.value.cameraHandle) return false;
  const current = () => context.current() && worldModeState.status === 'ready';
  creativeRenderDefaultsBusy.value = true;
  creativeRenderDefaultsError.value = '';
  try {
    if (!await initializeWorldRenderBackend({ api: editorApi, sceneId, cameraId,
      archiveSession: archive, isCurrent: current })) return false;
    pendingMainRenderSelection = { sceneId, cameraId, backend: 'vision',
      visionMode: mainVisionRenderMode.value, expiresAt: Date.now() + 3000 };
    mainRenderBackend.value = 'vision';
    await syncSceneCameraBinding(sceneId, { preservePose: true });
    return current();
  } catch (error) {
    if (current()) {
      creativeRenderDefaultsError.value = `初始化创造模式渲染设置失败：${error.message}`;
      logError('Failed to initialize creative viewport rendering', error);
    }
    return false;
  } finally {
    if (current()) creativeRenderDefaultsBusy.value = false;
  }
};

const selectMainRenderMode = async (mode) => {
  const context = mainCameraOperation('mode');
  if (!context.current()) return false;
  const { sceneId, cameraId } = context;
  creativeRenderDefaultsBusy.value = false;
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
      const result = await editorApi.scene.setCameraRenderSettings(sceneId, cameraId, {
        archive_session: context.archive,
        render_backend: 'native',
      });
      if (!context.current()) return false;
      mainRenderBackend.value = result?.render_backend || 'native';
      await syncSceneCameraBinding(sceneId);
      return context.current();
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

    const result = await editorApi.scene.setCameraRenderSettings(sceneId, cameraId, {
      archive_session: context.archive,
      render_backend: 'vision',
      output_mode: 'final_color',
      vision: { render_mode: mode },
    });
    if (!context.current()) return false;
    mainVisionRenderMode.value = result?.pending ? mode : result?.vision?.render_mode || mode;
    mainRenderBackend.value = result?.render_backend || 'native';
    if (mainRenderBackend.value !== 'vision') {
      pendingMainRenderSelection = null;
      return false;
    }
    await syncSceneCameraBinding(sceneId);
    return context.current();
  } catch (error) {
    if (!context.current()) return false;
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
  const context = mainCameraOperation('Accumulation');
  if (!context.current()) return false;
  const previous = mainVisionAccumulation.value;
  const previousSelection = pendingMainAccumulationSelection;
  const selection = { sceneId, cameraId, enabled: !previous };
  const isCurrent = context.current;
  pendingMainAccumulationSelection = selection;
  mainVisionAccumulationBusy.value = true;
  mainVisionAccumulation.value = selection.enabled;
  mainVisionAccumulationError.value = '';
  try {
    const result = await editorApi.scene.setCameraRenderSettings(sceneId, cameraId, {
      archive_session: context.archive,
      vision: { accumulation: selection.enabled },
    });
    if (!isCurrent()) return false;
    selection.enabled = result?.pending || typeof result?.vision?.accumulation !== 'boolean'
      ? selection.enabled : result.vision.accumulation;
    mainVisionAccumulation.value = selection.enabled;
    if (currentMainCamera.value) currentMainCamera.value.vision_accumulation = selection.enabled;
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    pendingMainAccumulationSelection = previousSelection;
    mainVisionAccumulation.value = previous;
    if (currentMainCamera.value) currentMainCamera.value.vision_accumulation = previous;
    mainVisionAccumulationError.value = error.message;
    logError('Failed to set main viewport sample accumulation', error);
    return false;
  } finally {
    if (isCurrent()) mainVisionAccumulationBusy.value = false;
  }
};

const toggleMainVisionDenoise = async () => {
  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  if (mainRenderBackend.value !== 'vision' || mainVisionRenderMode.value === 'ssat'
    || mainVisionDenoiseBusy.value || !cameraId) return false;
  const context = mainCameraOperation('Denoise');
  if (!context.current()) return false;
  const previous = mainVisionDenoise.value;
  const previousSelection = pendingMainDenoiseSelection;
  const selection = { sceneId, cameraId, enabled: !previous };
  const isCurrent = context.current;
  pendingMainDenoiseSelection = selection;
  mainVisionDenoiseBusy.value = true;
  mainVisionDenoise.value = selection.enabled;
  mainVisionDenoiseError.value = '';
  try {
    const result = await editorApi.scene.setCameraRenderSettings(sceneId, cameraId, {
      archive_session: context.archive,
      vision: { denoise: selection.enabled },
    });
    if (!isCurrent()) return false;
    selection.enabled = result?.pending || typeof result?.vision?.denoise !== 'boolean'
      ? selection.enabled : result.vision.denoise;
    mainVisionDenoise.value = selection.enabled;
    if (currentMainCamera.value) currentMainCamera.value.vision_denoise = selection.enabled;
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    pendingMainDenoiseSelection = previousSelection;
    mainVisionDenoise.value = previous;
    if (currentMainCamera.value) currentMainCamera.value.vision_denoise = previous;
    mainVisionDenoiseError.value = error.message;
    logError('Failed to set main viewport denoising', error);
    return false;
  } finally {
    if (isCurrent()) mainVisionDenoiseBusy.value = false;
  }
};

const selectMainVisionDenoiser = async (type) => {

  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  if (mainRenderBackend.value !== 'vision' || mainVisionRenderMode.value === 'ssat'
    || mainVisionDenoiserBusy.value || !cameraId) return false;
  const context = mainCameraOperation('Denoiser');
  if (!context.current()) return false;
  const previous = mainVisionDenoiser.value;
  const previousSelection = pendingMainDenoiserSelection;
  const selection = { sceneId, cameraId, type };
  const isCurrent = context.current;
  pendingMainDenoiserSelection = selection;
  mainVisionDenoiserBusy.value = true;
  mainVisionDenoiser.value = type;
  mainVisionDenoiserError.value = '';
  try {
    const result = await editorApi.scene.setCameraRenderSettings(sceneId, cameraId, {
      archive_session: context.archive,
      vision: { denoiser: type },
    });
    if (!isCurrent()) return false;
    if (!result?.pending && result?.vision?.denoiser) selection.type = result.vision.denoiser;
    mainVisionDenoiser.value = selection.type;
    if (currentMainCamera.value) currentMainCamera.value.vision_denoiser = selection.type;
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    pendingMainDenoiserSelection = previousSelection;
    mainVisionDenoiser.value = previous;
    if (currentMainCamera.value) currentMainCamera.value.vision_denoiser = previous;
    mainVisionDenoiserError.value = error.message;
    logError('Failed to set main viewport denoiser type', error);
    return false;
  } finally {
    if (isCurrent()) mainVisionDenoiserBusy.value = false;
  }
};

const toggleMainVisionStablePlanes = async () => {
  const sceneId = currentMainSceneId();
  const cameraId = currentMainCameraId();
  if (mainRenderBackend.value !== 'vision' || mainVisionRenderMode.value !== 'restir'
    || mainVisionStablePlanesBusy.value || !cameraId) return false;
  const context = mainCameraOperation('StablePlanes');
  if (!context.current()) return false;
  const previous = mainVisionStablePlanes.value;
  const previousSelection = pendingMainStablePlanesSelection;
  const selection = { sceneId, cameraId, enabled: !previous };
  const isCurrent = context.current;
  pendingMainStablePlanesSelection = selection;
  mainVisionStablePlanesBusy.value = true;
  mainVisionStablePlanes.value = selection.enabled;
  mainVisionStablePlanesError.value = '';
  try {
    const result = await editorApi.scene.setCameraRenderSettings(sceneId, cameraId, {
      archive_session: context.archive,
      vision: { stable_planes: selection.enabled },
    });
    if (!isCurrent()) return false;
    selection.enabled = result?.pending || typeof result?.vision?.stable_planes !== 'boolean'
      ? selection.enabled : result.vision.stable_planes;
    mainVisionStablePlanes.value = selection.enabled;
    if (currentMainCamera.value) currentMainCamera.value.vision_stable_planes = selection.enabled;
    return true;
  } catch (error) {
    if (!isCurrent()) return false;
    pendingMainStablePlanesSelection = previousSelection;
    mainVisionStablePlanes.value = previous;
    if (currentMainCamera.value) currentMainCamera.value.vision_stable_planes = previous;
    mainVisionStablePlanesError.value = error.message;
    logError('Failed to set main viewport stable planes', error);
    return false;
  } finally {
    if (isCurrent()) mainVisionStablePlanesBusy.value = false;
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

const applySceneSnapshot = (sceneId, payload, { preservePose = false, preserveEnvironment = false } = {}) => {
  const snapshot = payload;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    retireMainRenderOperations();
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
      archiveSession: '',
    };
    return;
  }

  const normalizedSceneId =
    snapshot.scene_id ?? snapshot.sceneId ?? snapshot.id ?? sceneId ?? DEFAULT_SCENE_NAME;
  if (!preserveEnvironment) {
    const gridEnabled = sceneGridEnabledFromSnapshot(snapshot);
    if (gridEnabled !== null) sceneGridEnabled.value = gridEnabled;
    const sun = snapshot.sun && typeof snapshot.sun === 'object' ? snapshot.sun : {};
    const lightDirection = Array.isArray(sun.direction) ? sun.direction : [1, 1, 1];
    sceneLightSettings.enabled = sun.enabled !== false;
    sceneLightSettings.direction.x = Number(lightDirection[0] ?? 1);
    sceneLightSettings.direction.y = Number(lightDirection[1] ?? 1);
    sceneLightSettings.direction.z = Number(lightDirection[2] ?? 1);
  }
  const cameras = Array.isArray(snapshot.cameras) ? snapshot.cameras : [];
  actorPickIndex = indexActorsByHandle(Array.isArray(snapshot.actors) ? snapshot.actors : []);
  const activeCameraName =
    snapshot.active_camera_name ?? snapshot.activeCameraName ?? cameras[0]?.name ?? null;
  const activeCamera =
    cameras.find((cam) => cam?.camera_id === snapshot.active_camera_id)
    ?? cameras.find((cam) => cam?.name === activeCameraName) ?? cameras[0] ?? snapshot.camera ?? null;

  const nextHandle = activeCamera?.opaque_handle ?? activeCamera?.handle ?? activeCamera?.camera_handle ?? null;
  const bindingChanged = cameraBindingState.value.sceneId !== normalizedSceneId
    || cameraBindingState.value.cameraHandle !== nextHandle
    || cameraBindingState.value.cameraId !== (activeCamera?.camera_id ?? activeCamera?.id ?? null)
    || cameraBindingState.value.archiveSession !== (activeCamera?.archive_session || snapshot.archive_session || '');
  if (bindingChanged) {
    retireMainRenderOperations();
    resetRealtimeCameraInput();
  }
  cameraBindingState.value = {
    sceneId: normalizedSceneId,
    archiveSession: activeCamera?.archive_session || snapshot.archive_session || '',
    cameraId: activeCamera?.camera_id ?? activeCamera?.id ?? null,
    cameraName: activeCamera?.name ?? activeCameraName,
    cameraHandle: nextHandle,
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
  const archive = environmentArchiveSession.value;
  if (!viewCurrent() || !sceneId || !archive) {
    return false;
  }

  const environmentRevision = mainEnvironmentRevision;
  const requestRevision = ++sceneCameraBindingRequestRevision;
  const current = () => viewCurrent() && requestRevision === sceneCameraBindingRequestRevision
    && archive === environmentArchiveSession.value && sceneId === currentSceneId.value;
  try {
    const scope = { archive_session: archive };
    const [snapshot, environment] = await Promise.all([
      editorApi.scene.readScene({ ...scope, scene: sceneId, actors: 'index', cameras: true }),
      editorApi.scene.getEnvironment(sceneId, scope),
    ]);
    if (!current() || [snapshot, environment].some(value => value.archive_session !== archive || value.scene !== sceneId)) return false;
    applySceneSnapshot(sceneId, { ...snapshot, scene_id: snapshot.scene,
      sun: environment.sun, grid: environment.grid }, { preservePose,
      ...(environmentRevision !== mainEnvironmentRevision || mainEnvironmentWrites.size
        ? { preserveEnvironment: true } : {}) });
    broadcastViewportControlsState();
    return true;
  } catch (e) {
    if (current()) {
      logError('Failed to sync scene camera binding', e);
    }
    return false;
  }
};

const updateSceneLight = async (axis = '') => {
  if (sceneLightBusy.value) return false;
  const context = beginEnvironmentWrite('light');
  if (!context.current()) return false;
  const { sceneId, archive } = context;
  const direction = { ...sceneLightSettings.direction };
  const sun = { enabled: sceneLightSettings.enabled,
    direction: [Number(direction.x) || 0, Number(direction.y) || 0, Number(direction.z) || 0] };
  sceneLightBusy.value = true;
  try {
    await editorApi.scene.setEnvironment(sceneId, { archive_session: archive, sun });
    if (!context.current()) return false;
    void cabbageContextService.recordEvent({
      type: 'lighting_changed', category: 'lighting', success: true,
      details: { sceneName: sceneId, axis: String(axis || '').toLowerCase(),
        value: axis ? Number(direction[axis]) || 0 : undefined, source: 'property_panel' },
    });
    return true;
  } catch (error) {
    if (!context.current()) return false;
    logError('更新场景光照失败', error);
    context.finish();
    await syncSceneCameraBinding(sceneId, { preservePose: true });
    return false;
  } finally {
    context.finish();
    if (context.current()) sceneLightBusy.value = false;
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
  const archive = environmentArchiveSession.value;
  const current = () => viewCurrent() && archive === environmentArchiveSession.value;
  if (!current() || !sceneId || !archive) return;
  try {
    const payload = await editorApi.scene.readScene({ archive_session: archive, scene: sceneId, cameras: true });
    if (!current() || payload.archive_session !== archive || payload.scene !== sceneId) return;
    const openCameras = Array.isArray(payload?.cameras)
      ? payload.cameras.filter((camera) => camera.view_open)
      : [];
    for (const camera of openCameras) {
      if (!current()) return;
      if (!await initializeWorldRenderBackend({ api: editorApi, sceneId,
        cameraId: camera.camera_id, archiveSession: payload.archive_session, isCurrent: current }) || !current()) return;
      await appService.createCameraView({ ...camera, scene_id: sceneId });
    }
  } catch (e) {
    if (current()) logError('Failed to restore camera views', e);
  }
};

const sendScriptInput = createScriptInputSender({ api: editorApi,
  getBinding: () => cameraBindingState.value, getRenderRect: getViewportRenderRect });
const sendScratchPointerEvent = (type, event, pickedActor = '') => {
  sendScriptInput(type, event, pickedActor).catch(error => logError('Script input failed', error));
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
    const state = result || {};
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
  viewportUiPointerController.hide();
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

const handleMainViewportBlur = () => {
  viewportUiPointerController.hide();
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
  pending.send(pickedActor).catch(error => logError('Script input failed', error));
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
    send: sendScriptInput.capture('click', eventSnapshot),
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
  const pickedActor = result?.actor?.name || '';
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

const refreshActorPickIndex = async (sceneId, isCurrent = () => true) => {
  const archive = cameraBindingState.value.archiveSession;
  const current = () => viewCurrent() && isCurrent() && cameraBindingState.value.archiveSession === archive && cameraBindingState.value.sceneId === sceneId;
  if (!sceneId || !archive || !current()) return false;
  const snapshot = await editorApi.scene.readScene({ archive_session: archive, scene: sceneId, actors: 'index' });
  if (!current() || snapshot.archive_session !== archive || snapshot.scene !== sceneId) return false;
  const actors = Array.isArray(snapshot?.actors) ? snapshot.actors : [];
  actorPickIndex = indexActorsByHandle(actors);
  return actorPickIndex.size > 0;
};

const applyActorPickResult = (result, payload = result?.payload) => {
  if (result.status === 'pending' || result.status === 'stale') return;
  if (result.status === 'selected') coronaEventBus.emit('model-node-picked', { ...payload, actor_name: payload?.actor_name || result.actor?.name });
  if (result.status === 'miss') coronaEventBus.emit('model-node-picked', payload);

  // 选中结果已由 viewportPickController 内部 emitActorChange 驱动属性面板，
  // 此处无需额外处理。
};

const handleActorPickResult = (payload, result) => {
  applyActorPickResult(result, payload);
  // Gizmo synchronization is owned exclusively by actorSelectionChanged.
  // A miss still publishes the empty scene selection so that the same
  // selection path clears the property panel and Gizmo exactly once.
  if (result.status === 'miss') {
    emitActorChangeFast(
      'scene',
      payload?.scene || cameraBindingState.value.sceneId || DEFAULT_SCENE_NAME,
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
  const { sceneId, cameraId, archiveSession } = cameraBindingState.value;
  if (!sceneId || !cameraId || !archiveSession) return false;
  try {
    editorApi.scene.updateCamera(sceneId, cameraId, {
      archive_session: archiveSession,
      position: [...cameraState.value.position],
      forward: [...cameraState.value.forward],
      world_up: [...cameraState.value.up],
      fov: cameraState.value.fov,
    }).catch(error => {
      if (viewCurrent() && archiveSession === cameraBindingState.value.archiveSession)
        console.warn('[Camera] Native camera update failed', error);
    });
    return true;
  } catch {
    return false;
  }
};

const handleCameraMove = (direction) => cameraControls.move(direction);

const handleApplyPhysics = async () => {
  const context = beginEnvironmentWrite('physics');
  if (!context.current()) return false;
  const { sceneId } = context;
  const scope = { archive_session: context.archive };

  try {
    await editorApi.scene.setEnvironment(sceneId, { ...scope, physics: {
      gravity: [
        physicsParams.value.gravityX,
        physicsParams.value.gravityY,
        physicsParams.value.gravityZ,
      ],
      floor_y: physicsParams.value.floorY,
      floor_restitution: physicsParams.value.floorRestitution,
      fixed_dt: physicsParams.value.fixedDt,
    } });
    return context.current();
  } catch (e) {
    if (!context.current()) return false;
    logError('Apply physics params failed', e);
    return false;
  } finally {
    context.finish();
  }
};

const loadPhysicsParams = async () => {
  if (mainEnvironmentWrites.has('physics')) return false;
  const context = mainSceneOperation('physics');
  if (!context.current()) return false;
  const { sceneId } = context;
  const scope = { archive_session: context.archive };
  try {
    const environment = await editorApi.scene.getEnvironment(sceneId, scope);
    if (!context.current() || environment.archive_session !== context.archive || environment.scene !== sceneId) return false;
    const data = environment.physics;
    if (data) {
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
    if (!context.current()) return false;
    logError('Load physics params failed', e);
    return false;
  }
};

const stopProjectResourceLoadPolling = () => {
  mainSceneOperations.delete('resources');
  if (projectResourceLoadPollTimer !== null) {
    window.clearTimeout(projectResourceLoadPollTimer);
    projectResourceLoadPollTimer = null;
  }
};

const pollProjectResourceLoadStatus = async () => {
  if (!viewCurrent()) return;
  stopProjectResourceLoadPolling();
  const context = mainSceneOperation('resources');
  if (!context.current()) return;
  try {
    const status = await editorApi.project.getProjectLoadStatus();
    if (!context.current()) return;
    projectResourceLoadStatus.value = status?.active ? status : null;
    if (status?.loading) {
      projectResourceLoadPollTimer = window.setTimeout(
        () => { if (context.current()) void pollProjectResourceLoadStatus(); },
        250,
      );
    } else {
      projectResourceLoadStatus.value = null;
    }
  } catch (error) {
    if (!context.current()) return;
    projectResourceLoadStatus.value = null;
    logWarn('Failed to query project resource load status', error);
  }
};

watch(() => [currentSceneId.value, environmentArchiveSession.value], () => {
  mainSceneOperations.clear();
  actorTransformBaselines.clear();
  mainEnvironmentWrites.clear();
  mainEnvironmentRevision++;
  sceneLightBusy.value = false;
  stopProjectResourceLoadPolling();
  projectResourceLoadStatus.value = null;
}, { flush: 'sync' });

watch([
  () => cameraBindingState.value.sceneId, () => cameraBindingState.value.cameraId,
  () => cameraBindingState.value.cameraHandle, () => cameraBindingState.value.archiveSession,
], () => mainSceneOperations.delete('selection'), { flush: 'sync' });

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
  const context = beginEnvironmentWrite('grid');
  if (!context.current()) return false;
  const { sceneId } = context;
  const requested = String(requestedSceneId || '').trim();
  const nextEnabled = Boolean(enabled);
  const scope = { archive_session: context.archive };
  try {
    if (requested && requested !== sceneId) {
      context.finish();
      await syncSceneCameraBinding(sceneId, { preservePose: true });
      if (!context.current()) return false;
      broadcastViewportControlsState();
      return getEditorControlsState();
    }

    await editorApi.scene.setEnvironment(sceneId, { ...scope, grid: { enabled: nextEnabled } });
    if (!context.current()) return false;
    sceneGridEnabled.value = nextEnabled;
    broadcastViewportControlsState();
    return getEditorControlsState();
  } catch (error) {
    if (!context.current()) return false;
    logError('更新场景编辑网格失败', error);
    return false;
  } finally {
    context.finish();
  }
};

const applyPhysicsFromSettings = async (nextParams = {}) => {
  if (!viewCurrent() || !environmentArchiveSession.value) return false;
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
  cameraId: cameraBindingState.value.cameraId,
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
  viewportControlsService
    .publish(getEditorControlsState())
    .catch(() => {});
};

const registerEditorControls = () => {
  unregisterViewportControls = viewportControlsService.provide({
    snapshot: getEditorControlsState,
    isCurrent: viewCurrent,
    actions: {
      selectRenderMode: payload => {
        if (!mainRenderModeOptions.some(mode => mode.value === payload.mode &&
            (mode.backend !== 'vision' || visionAvailable.value))) return false;
        return selectMainRenderMode(payload.mode);
      },
      setViewportUiMode: payload => setViewportUiModeFromPanel(payload.mode),
      setCameraSpeed: payload => setCameraSpeedFromPanel(payload.value),
      setGridEnabled: payload => setSceneGridEnabledFromPanel(payload.enabled, payload.sceneId),
    },
  });
};

const unregisterEditorControls = () => {
  unregisterViewportControls?.();
  unregisterViewportControls = null;
};

const onSceneImportProgress = payload => {
  importProgress.value = payload?.active && dockStore.panels.SceneTools?.open ? payload : null;
};
watch(() => dockStore.panels.SceneTools?.open, open => {
  if (!open) importProgress.value = null;
});

const onCameraPoseApplied = (result = {}) => {
  if (!viewCurrent()) return false;
  const pose = readAppliedCameraPose(result, { archiveSession: environmentArchiveSession.value,
    sceneId: currentMainSceneId(), cameraId: currentMainCameraId() });
  if (!pose) return false;
  resetRealtimeCameraInput();
  cameraState.value = pose;
  return true;
};


let projectOpenedRefreshRevision = 0;
let projectOpenedRequestSequence = 0;
const onProjectOpenedEvent = async (payload = {}) => {
  if (!viewCurrent()) return;
  const refreshRevision = ++projectOpenedRequestSequence;
  let archive = environmentArchiveSession.value, scene = currentSceneId.value;
  const current = () => viewCurrent() && refreshRevision >= projectOpenedRefreshRevision
    && archive === environmentArchiveSession.value && scene === currentSceneId.value;
  try {
    const active = await editorApi.scene.readActive();
    if (!current()) return;
    const sceneId = typeof active?.scene === 'string' ? active.scene.trim() : '';
    // A sampled project event can arrive after a newer world has committed.
    // Only the active native archive may establish this view's binding.
    if (!payload.archive_session || active?.archive_session !== payload.archive_session || !sceneId) return;
    projectOpenedRefreshRevision = refreshRevision;
    environmentArchiveSession.value = active.archive_session;
    currentSceneId.value = sceneId;
    archive = active.archive_session;
    scene = sceneId;
    applyActualProjectChange(active.project_path, { refreshCamera: false });
    void pollProjectResourceLoadStatus();
    resetRealtimeCameraInput();
    await syncSceneCameraBinding(sceneId, { preservePose: false });
    if (!current() || refreshRevision !== projectOpenedRefreshRevision) return;
    syncViewportUiMode();
    scheduleCameraViewportSync();
    broadcastViewportControlsState();
  } catch (error) {
    if (current()) {
      logError('Failed to restore editor state after opening project', error);
    }
  }
};

onMounted(async () => {
  // A reused CEF page must not inherit camera locks from a previous world.
  // Real active workers are added back by reconcileEditorCameraInputLocks().
  clearKnownEditorCameraInputLocks();
  const active = await editorApi.scene.readActive();
  if (!viewCurrent()) return;
  const openedSceneId = typeof active?.scene === 'string' ? active.scene.trim() : '';
  if (!active?.archive_session || !openedSceneId) return;
  environmentArchiveSession.value = active.archive_session;
  currentSceneId.value = openedSceneId;
  // Render settings require the observed archive and exact camera identity.
  // A retired or failed binding must not leave a partially mounted viewport.
  if (!await syncSceneCameraBinding(openedSceneId) || !viewCurrent()) return;
  if (!await initializeCreativeRenderMode() || !viewCurrent()) return;
  await pollProjectResourceLoadStatus();
  if (!viewCurrent()) return;
  try {
    const visionResult = await editorApi.scene.isVisionAvailable();
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
  coronaEventBus.on('camera-pose-applied', onCameraPoseApplied);
  coronaEventBus.on('node-graph-panel-open-request', handleNodeGraphPanelOpenRequest);
  if (!viewCurrent()) return;
  await subscribeWhileCurrent(callback => editorApi.scene.observe('project', callback), onProjectOpenedEvent);
  if (!viewCurrent()) return;
  if (!viewCurrent()) return;
  await subscribeWhileCurrent(callback => editorApi.scene.observe('selection', callback), handleActorSelectionForObjectDock);
  if (!viewCurrent()) return;
  await subscribeWhileCurrent(callback => editorApi.scene.observe('transform', callback), handleActorTransformForCabbage);
  if (!viewCurrent()) return;
    if (!viewCurrent()) return;
  coronaEventBus.on('model-node-selection', handleModelNodeGizmoSelection);

  await syncSceneCameraBinding(initialSceneId);
  if (!viewCurrent()) return;
  broadcastViewportControlsState();

  // Subscribe to proactive DeepSeek reviews and the world-scoped assistant context.
  unsubscribeNodeGraphReview = subscribeNodeGraphReviews(handleNodeGraphReview);
  unsubscribeCabbageContext = subscribeCabbageAssistantContext(
    cabbageAssistant.hydrateContext,
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
  stopProjectChanged = subscribeProjectChanged(onActiveProjectChanged);
  stopViewportUiCalibrationMessages = viewportCalibration.subscribe(() => {
    if (viewportUiMode.value === 'stereo3d') applyViewportUiCalibration();
  });
});

onUnmounted(() => {
  sendScriptInput.dispose();
  viewLifetime.dispose();
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
  stopProjectChanged?.();
  stopProjectChanged = null;
  stopViewportUiCalibrationMessages?.();
  stopViewportUiCalibrationMessages = null;
  viewportCalibration.dispose();
  closeTutorialSessionChannel();
  coronaEventBus.off('model-node-selection', handleModelNodeGizmoSelection);
  coronaEventBus.off('creative-panel-open', handleCreativePanelOpen);
  coronaEventBus.off('scene-import-progress', onSceneImportProgress);
  coronaEventBus.off('camera-pose-applied', onCameraPoseApplied);
  coronaEventBus.off('node-graph-panel-open-request', handleNodeGraphPanelOpenRequest);
  if (gizmoClickTimer) window.clearTimeout(gizmoClickTimer);
  gizmoClickTimer = 0;
  viewportGizmoController.cancel('cancel');
  viewportGizmoController.clearTarget();
  actorTransformBaselines.clear();
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
  sceneLightSettings: { enabled: sceneLightSettings.enabled, direction: { ...sceneLightSettings.direction } },
  sceneLightBusy: sceneLightBusy.value,
  physics: getPhysicsSnapshot(),
}), {
  refreshPhysics: loadPhysicsParams, applyPhysics: applyPhysicsFromSettings,
  selectMainRenderMode, selectMainVisionDenoiser, toggleMainVisionAccumulation,
  toggleMainVisionDenoise, toggleMainVisionStablePlanes, setCameraSpeedFromPanel,
  setSceneLightEnabled: async enabled => {
    if (!viewCurrent() || !environmentArchiveSession.value) return false;
    sceneLightSettings.enabled = Boolean(enabled);
    return updateSceneLight();
  },
  setSceneLightDirection: async (axis, value) => {
    if (!viewCurrent() || !environmentArchiveSession.value) return false;
    if (!['x', 'y', 'z'].includes(axis) || !Number.isFinite(value)) return false;
    sceneLightSettings.direction[axis] = value;
    return updateSceneLight(axis);
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
