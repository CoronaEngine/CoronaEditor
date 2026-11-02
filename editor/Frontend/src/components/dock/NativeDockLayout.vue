<template><router-view /></template>
<script setup>
import { watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDockStore } from '@/stores/dockStore.js';
import { getPluginManifest } from '@/config/pluginManifest.js';
import { appService } from '@/services/appService.js';
import { createNativePanelHosts } from '@/services/nativePanelHosts.js';
import { coronaEventBus } from '@/utils/eventBus.js';

const store = useDockStore();
const { t } = useI18n();
const hosts = createNativePanelHosts({
  open: panel => {
    const manifest = getPluginManifest(panel.id);
    return appService.createDockedPanel({ panelId: panel.id, routePath: manifest.routePath,
      title: manifest.displayNameKey ? t(manifest.displayNameKey) : manifest.displayName,
      width: panel.width, height: panel.height, dockingPos: panel.dockZone });
  },
  close: (tabId, id) => appService.closePanelTab(tabId, id),
  onError: (error, id) => { console.error('[NativeDock]', error); if (id) store.closePanel(id); },
});
const stop = watch(() => Object.entries(store.panels)
  .filter(([, panel]) => panel.open && panel.mode === 'docked')
  .map(([id, panel]) => ({ id, ...panel })), panels => hosts.reconcile(panels), { immediate: true });
function closed(payload) {
  if (!payload?.panelId) return;
  if (hosts.closed(payload.panelId, payload.tabId)) store.closePanel(payload.panelId);
}
coronaEventBus.on('panel-closed', closed);
onUnmounted(() => { stop(); coronaEventBus.off('panel-closed', closed); hosts.dispose(); });
</script>
