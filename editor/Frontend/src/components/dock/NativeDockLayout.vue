<template><router-view /></template>
<script setup>
import { watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDockStore } from '@/stores/dockStore.js';
import { PLUGIN_MANIFEST } from '@/config/pluginManifest.js';
import { appService } from '@/services/appService.js';
import { createNativePanelHosts } from '@/services/nativePanelHosts.js';
import { coronaEventBus } from '@/utils/eventBus.js';

const store = useDockStore();
const { t } = useI18n();
const hosts = createNativePanelHosts({
  open: panel => appService.openNativePanel({
    panelId: panel.id, routePath: panel.routePath, title: t(panel.displayNameKey),
    width: panel.defaultWidth, height: panel.defaultHeight,
  }),
  close: (tabId, id) => appService.closePanelTab(id),
  focus: tabId => appService.focusPanelTab(tabId),
  onError: (error, id) => { console.error('[NativeDock]', error); if (id) store.closePanel(id); },
});
const stop = watch(() => PLUGIN_MANIFEST.filter(panel => store.panels[panel.id].open),
  panels => hosts.reconcile(panels), { immediate: true });
function closed(payload) {
  if (!payload?.panelId) return;
  if (hosts.closed(payload.panelId, payload.tabId)) store.closePanel(payload.panelId);
}
const stopClosed = appService.onWindowClosed(closed);
const focusPanel = id => { void hosts.focusPanel(id).catch(error => console.error('[NativeDock] focus failed', error)); };
coronaEventBus.on('native-panel-focus', focusPanel);
onUnmounted(() => {
  stop(); stopClosed(); coronaEventBus.off('native-panel-focus', focusPanel); hosts.dispose();
});
</script>
