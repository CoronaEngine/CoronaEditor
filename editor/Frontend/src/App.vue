<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDockStore } from '@/stores/dockStore.js';
import NativeDockLayout from '@/components/dock/NativeDockLayout.vue';
import CabbageGuidanceOverlay from '@/components/ui/CabbageGuidanceOverlay.vue';
import { editorApi } from '@/api/editorApi.js';
import { getObserverRuntime } from '@/api/observerRuntime.js';
import { appService } from '@/services/appService.js';
import { getWebMessages } from '@/api/webMessages.js';
import { getWebDocumentIdentity } from '@/api/webDocument.js';
import { WINDOW_SESSION_POLICY_EVENT } from '@/services/windowSessionState.js';
import { LAUNCHER_ROUTES, normalizeProjectPath, editorUiAllowed, worldModeService, worldModeState } from '@/services/worldModeService.js';
import { cancelPendingProjectOpen } from '@/services/projectLauncherService.js';
import { notifyWorldError } from '@/services/worldSessionLifecycle.js';
import { coronaEventBus } from '@/utils/eventBus.js';
import { subscribeProjectChanged } from '@/services/projectMessages.js';
import { createViewLifetime } from '@/utils/viewLifetime.js';

const route = useRoute();
const router = useRouter();
const dockStore = useDockStore();

// DockLayout 只在编辑器主页面显示，StartScreen / launcher 等不显示
const isEditorRoute = computed(() => route.path === '/' && editorUiAllowed());
const isLauncherRoute = computed(() => LAUNCHER_ROUTES.has(route.path));
const preparedRevision = ref(-1);
const windowPolicyRevision = ref(0);
const worldReady = computed(() => worldModeState.status === 'ready'
  && preparedRevision.value === worldModeState.revision);
const mayRenderRoute = computed(() => isLauncherRoute.value || (worldReady.value
  && (route.path === '/' || editorUiAllowed())));
const documentIdentity = getWebDocumentIdentity();
const isStandalonePanel = computed(() => documentIdentity.role === 'peer');
function returnToLauncher() {
  if (isEditorRoute.value && !isStandalonePanel.value) void router.replace('/StartScreen');
}
function closeNativePanel() { void appService.closeThisTab('').catch(error => console.error('[NativeDock] close failed', error)); }

const viewLifetime = createViewLifetime();
let observedProjectSession = '';
let refreshRevision = 0;
let preparationRevision = 0;
let lastReadyProjectKey = '';

// Only the main surface controls native windows. Standalone pages independently
// resolve the same native metadata before mounting their panel component.
watch(() => [worldModeState.status, worldModeState.revision, route.path, route.matched.length, windowPolicyRevision.value], async () => {
  if (!viewLifetime.current() || !route.matched.length) return;
  const preparation = ++preparationRevision;
  const revision = worldModeState.revision;
  const opening = worldModeService.opening;
  const projectKey = normalizeProjectPath(worldModeState.projectPath);
  const refreshingCurrentProject = worldModeState.status === 'loading'
    && Boolean(lastReadyProjectKey) && projectKey === lastReadyProjectKey
    && !isLauncherRoute.value;
  if (worldModeState.status === 'ready') lastReadyProjectKey = projectKey;
  preparedRevision.value = -1;
  try {
    if (!isStandalonePanel.value && editorApi.window.canCloseSceneViews()) {
      const enabled = editorUiAllowed() && !isLauncherRoute.value;
      if (!enabled && !refreshingCurrentProject) dockStore.clearSession();
      await appService.setEditorUiEnabled(enabled);
    } else if (isStandalonePanel.value && editorApi.window.canCloseSceneViews()) {
      const policy = await appService.readEditorUiPolicy();
      if (!viewLifetime.current() || preparation !== preparationRevision || revision !== worldModeState.revision) return;
      if (!policy?.enabled) { await appService.closeThisTab(''); return; }
    }
    if (preparation !== preparationRevision || revision !== worldModeState.revision || !viewLifetime.current()) return;
    if (worldModeState.status !== 'ready') return;
    if (preparation === preparationRevision && revision === worldModeState.revision && viewLifetime.current()) preparedRevision.value = revision;
  } catch (error) {
    if (preparation !== preparationRevision || revision !== worldModeState.revision || !viewLifetime.current()) return;
    if (opening) return; // The opening caller owns the failure and its single notification.
    if (isStandalonePanel.value) { await appService.closeThisTab('').catch(() => {}); return; }
    await router.replace('/StartScreen');
    notifyWorldError(error, '世界界面初始化失败');
  }
}, { immediate: true });

async function refreshWorldMode(projectPath = '', force = false) {
  if (!viewLifetime.current() || worldModeService.opening) return;
  if (!force && worldModeState.status === 'ready' && projectPath
    && normalizeProjectPath(projectPath) === normalizeProjectPath(worldModeState.projectPath)) return;
  const request = ++refreshRevision;
  try {
    await worldModeService.resolve(projectPath, { force });
  } catch (error) {
    if (request !== refreshRevision || !viewLifetime.current()) return;
    if (isStandalonePanel.value) {
      await appService.closeThisTab('').catch(() => {});
      return;
    }
    await router.replace('/StartScreen');
    notifyWorldError(error, '读取项目失败');
  }
}
let gcTimer = null;
let stopNativeCloseRequested;
let stopProjectChanged;
let stopWindowPolicyChanged;

function isEscapeKey(event) {
  const modifierKeys = new Set([
    'Shift', 'Control', 'Alt', 'Meta',
    'ShiftLeft', 'ShiftRight',
    'ControlLeft', 'ControlRight',
    'AltLeft', 'AltRight',
    'MetaLeft', 'MetaRight',
  ]);
  if (modifierKeys.has(event.key) || modifierKeys.has(event.code)) return false;
  return event.key === 'Escape' && (event.code === 'Escape' || event.keyCode === 27 || event.which === 27);
}

function isEditableTarget(target) {
  const tag = target?.tagName;
  return Boolean(
    target?.isContentEditable ||
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT'
  );
}


function isGameplayKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const code = event.code || '';
  return code === 'Space'
    || code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD'
    || code === 'ArrowUp' || code === 'ArrowDown'
    || code === 'ArrowLeft' || code === 'ArrowRight';
}

function consumeNativeGameplayDomEvent(event) {
  if (!window.__coronaEditorInputLocks?.has('node_graph') || isEditableTarget(event.target) || !isGameplayKey(event)) return;
  // The native SDL event still reaches Scratch. Suppress only the mirrored DOM
  // event so Space cannot click the still-focused run button and WASD does
  // not trigger editor/browser shortcuts while a game is running.
  event.preventDefault();
  event.stopPropagation();
}

function onGlobalKeyDown(event) {
  // F11 toggles borderless fullscreen regardless of world/editor state.
  if ((event.key === 'F11' || event.code === 'F11') && !event.repeat) {
    event.preventDefault();
    appService.toggleMainWindowBorderless().catch(() => {});
    return;
  }
  // The route may not be mounted yet while native mode/window preparation waits.
  if (isEscapeKey(event) && !isStandalonePanel.value
    && (worldModeService.opening || (!isLauncherRoute.value && !worldReady.value))) {
    event.preventDefault();
    event.stopPropagation();
    cancelPendingProjectOpen();
    void router.replace('/StartScreen');
    return;
  }
  if (isLauncherRoute.value || !editorUiAllowed() || !worldReady.value) return;
  consumeNativeGameplayDomEvent(event);
  if (event.defaultPrevented) return;
  if (!isEscapeKey(event)) return;
  if (isStandalonePanel.value && route.path === '/SetUp') {
    event.preventDefault();
    closeNativePanel();
    return;
  }
  if (!isEditorRoute.value) return;

  const settingsOpen = Boolean(dockStore.panels.EditorSettings?.open);
  if (isEditableTarget(event.target) && !settingsOpen) return;

  event.preventDefault();
  event.stopPropagation();
  dockStore.togglePanel('EditorSettings');
}

function onGlobalKeyUp(event) {
  if (isLauncherRoute.value || !editorUiAllowed() || !worldReady.value) return;
  consumeNativeGameplayDomEvent(event);
}

onMounted(() => {
  if (editorApi.window.hasWindowBindings()) stopNativeCloseRequested = appService.onWindowCloseRequested(closeNativePanel);
  coronaEventBus.on('creative-return-to-launcher', returnToLauncher);
  stopProjectChanged = subscribeProjectChanged(({ projectPath }) => void refreshWorldMode(projectPath));
  stopWindowPolicyChanged = getWebMessages().on(WINDOW_SESSION_POLICY_EVENT, () => {
    if (isStandalonePanel.value) windowPolicyRevision.value++;
  });
  void viewLifetime.subscribe(callback => getObserverRuntime().observe('project', callback), (payload) => {
    const reopened = Boolean(observedProjectSession) && observedProjectSession !== payload.archive_session;
    observedProjectSession = payload.archive_session;
    void refreshWorldMode(payload.path, reopened);
  }, token => getObserverRuntime().off(token)).catch((error) => console.warn('[App] project mode subscription failed', error));

  gcTimer = setInterval(() => {
    if (typeof window.gc === 'function') {
      try {
        window.gc();
      } catch {}
    }
  }, 60000);

  document.addEventListener('keydown', onGlobalKeyDown, true);
  document.addEventListener('keyup', onGlobalKeyUp, true);
});

onUnmounted(() => {
  viewLifetime.dispose();
  stopNativeCloseRequested?.();
  coronaEventBus.off('creative-return-to-launcher', returnToLauncher);
  ++refreshRevision;
  stopProjectChanged?.();
  stopProjectChanged = null;
  stopWindowPolicyChanged?.();
  stopWindowPolicyChanged = null;

  if (gcTimer) {
    clearInterval(gcTimer);
    gcTimer = null;
  }
  document.removeEventListener('keydown', onGlobalKeyDown, true);
  document.removeEventListener('keyup', onGlobalKeyUp, true);
});
</script>

<template>
  <CabbageGuidanceOverlay v-if="worldReady && editorUiAllowed() && !isLauncherRoute" :key="worldModeState.projectPath" />
  <NativeDockLayout v-if="isEditorRoute && worldReady" :key="worldModeState.projectPath" />
  <div v-else-if="mayRenderRoute" :key="isLauncherRoute ? route.path : worldModeState.projectPath" :class="isStandalonePanel ? 'standalone-route-shell' : null">
    <router-view />
  </div>
</template>

<style>
.standalone-route-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

</style>
