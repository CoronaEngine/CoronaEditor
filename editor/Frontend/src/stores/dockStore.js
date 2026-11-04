import { defineStore } from 'pinia';
import { PLUGIN_MANIFEST } from '@/config/pluginManifest.js';
import { editorUiAllowed } from '../services/worldModeService.js';

// The main page owns open/close intent. ImGui owns geometry, docking, and window dragging.
export const useDockStore = defineStore('dock', {
  state: () => ({
    panels: Object.fromEntries(PLUGIN_MANIFEST.map(({ id }) => [id, { open: false }])),
  }),
  actions: {
    clearSession() {
      for (const panel of Object.values(this.panels)) panel.open = false;
    },
    openPanel(id) {
      if (editorUiAllowed() && this.panels[id]) this.panels[id].open = true;
    },
    closePanel(id) {
      if (this.panels[id]) this.panels[id].open = false;
    },
    togglePanel(id) {
      if (editorUiAllowed() && this.panels[id]) this.panels[id].open = !this.panels[id].open;
    },
  },
});
