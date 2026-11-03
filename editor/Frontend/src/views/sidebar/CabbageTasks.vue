<template>
  <div class="cabbage-tasks-panel">
    <DockTitleBar v-if="!isDocked" title="AI 任务" routePath="/CabbageTasks" @close="closePanel" />
    <CabbageReviewAssistant resident :tasks="assistant.tasks" :attention-token="assistant.attentionToken" />
  </div>
</template>
<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useDockPanel } from '@/composables/useDockPanel.js';
import { useCabbageAssistantStore } from '@/stores/cabbageAssistantStore.js';
import { appService } from '@/services/appService.js';
import { coronaEventBus } from '@/utils/eventBus.js';
import { reviewScopeId } from '@/services/nodeGraphReviewService.js';
import { subscribeCabbageAssistantContext, subscribeCabbagePreWarnings } from '@/services/cabbageAssistantContextService.js';
import DockTitleBar from '@/components/ui/DockTitleBar.vue';
import CabbageReviewAssistant from '@/components/ui/CabbageReviewAssistant.vue';
const { isDocked, closePanel } = useDockPanel();
const assistant = useCabbageAssistantStore();
let unsubscribe = null, unsubscribeWarnings = null;
const projectScopeId = () => reviewScopeId(String(window.localStorage?.getItem('corona.activeProjectPath') || ''));
const openChat = () => {
  const payload = { panelId: 'CabbageChatPanel' };
  if (typeof window.coronaBridge?.dockCommand === 'function') {
    void appService.crossTabBroadcast('creative-panel-open', payload).catch(() => {});
  } else coronaEventBus.emit('creative-panel-open', payload);
};
onMounted(() => {
  unsubscribe = subscribeCabbageAssistantContext(snapshot => assistant.hydrateContext(snapshot), { projectScopeId, emitCurrent: true });
  unsubscribeWarnings = subscribeCabbagePreWarnings(warning => assistant.showPreWarning(warning), { projectScopeId });
  window.addEventListener('cabbage-chat-focus-request', openChat);
});
onUnmounted(() => {
  unsubscribe?.(); unsubscribeWarnings?.();
  window.removeEventListener('cabbage-chat-focus-request', openChat);
});
</script>
<style scoped>
.cabbage-tasks-panel { display:flex; flex-direction:column; min-height:0; height:100%; overflow:auto; background:#101711; padding:8px; }
.cabbage-tasks-panel :deep(.cabbage-review-root.resident) { max-height:none; flex:1; }
.cabbage-tasks-panel :deep(.task-board) { max-height:none; }
</style>
