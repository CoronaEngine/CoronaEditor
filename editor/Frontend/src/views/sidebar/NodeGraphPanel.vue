<template>
  <div class="node-graph-panel flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
    <NodeGraphWorkspace
      ref="workspaceRef"
      class="min-h-0 flex-1"
      :key="actorName"
      :actor-name="actorName"
      :scene-name="sceneName"
      :target-type="actorName ? 'actor' : 'project'"
      @select-target="selectTarget"
      :review-active="true"
    />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import NodeGraphWorkspace from '@/blockly/components/NodeGraphWorkspace.vue';
import { viewportControlsService } from '@/services/viewportControlsService.js';

// An empty route binds to the current scene until MainPage publishes its identity.
const sceneName = ref('');
const actorName = ref('');
function selectTarget(target) {
  sceneName.value = target.sceneName;
  actorName.value = target.actorName;
}
const workspaceRef = ref(null);
let closeStopPromise = null;
let unsubscribeViewportControls = null;
const viewportRequests = new globalThis.AbortController();

function applyViewportState(state = {}) {
  const nextSceneName = String(state?.sceneId || '').trim();
  if (nextSceneName && nextSceneName !== sceneName.value) {
    sceneName.value = nextSceneName;
  }
}

function requestViewportState() {
  void viewportControlsService.request({ action: 'getState' }, { signal: viewportRequests.signal })
    .then(applyViewportState).catch(() => {});
}

function stopNodeRunForClose() {
  if (!closeStopPromise) {
    closeStopPromise = Promise.resolve(workspaceRef.value?.stopForPanelClose?.());
  }
  return closeStopPromise;
}
function handleWindowClosing() {
  stopNodeRunForClose().catch(() => {});
}

onMounted(() => {
  // Read the scene initialized by MainPage. Calling MainView.on_init here would reset
  // the scene and camera every time the node panel is opened.
  unsubscribeViewportControls = viewportControlsService.subscribe(applyViewportState);
  window.addEventListener('pagehide', handleWindowClosing);
  window.addEventListener('beforeunload', handleWindowClosing);
  requestViewportState();
});

onBeforeUnmount(() => {
  unsubscribeViewportControls?.();
  viewportRequests.abort();
  window.removeEventListener('pagehide', handleWindowClosing);
  window.removeEventListener('beforeunload', handleWindowClosing);
  stopNodeRunForClose().catch(() => {});
});

</script>

<style scoped>
.node-graph-panel {
  position: relative;
  z-index: 2147483100;
  background: linear-gradient(180deg, rgba(33, 29, 18, 0.72), rgba(17, 16, 13, 0.7));
  border: 1px solid rgba(179, 153, 93, 0.18);
  border-radius: 8px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.34);
}
</style>
