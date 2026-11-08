<template>
  <div class="cabbage-tasks-panel">
    <CabbageReviewAssistant resident :tasks="assistant.tasks" :attention-token="assistant.attentionToken" />
  </div>
</template>
<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useCabbageAssistantStore } from '@/stores/cabbageAssistantStore.js';
import { appService } from '@/services/appService.js';
import { reviewScopeId } from '@/services/nodeGraphReviewService.js';
import { worldModeState } from '@/services/worldModeService.js';
import { subscribeCabbageAssistantContext, subscribeCabbagePreWarnings } from '@/services/cabbageAssistantContextService.js';
import CabbageReviewAssistant from '@/components/ui/CabbageReviewAssistant.vue';
const assistant = useCabbageAssistantStore();
let unsubscribe = null, unsubscribeWarnings = null;
const projectScopeId = () => reviewScopeId(String(worldModeState.activeProjectPath || ''));
const openChat = () => {
  void appService.crossTabBroadcast('creative-panel-open', { panelId: 'CabbageChatPanel' }).catch(() => {});
};
onMounted(() => {
  unsubscribe = subscribeCabbageAssistantContext(assistant.hydrateContext, { projectScopeId, emitCurrent: true });
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
