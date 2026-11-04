import { defineAsyncComponent } from 'vue';

/**
 * Vue component owner for panels declared by config/pluginManifest.js.
 *
 * Panels are loaded LAZILY. Every editor window -- including each detached `?standalone=1`
 * panel -- is its own document that boots this whole frontend, so eager imports would make
 * every window download all ten panels (plus Blockly) before it could render anything.
 *
 * Keep page-level component paths in the view composition layer. The keys
 * intentionally match the manifest IDs.
 */
const SceneBar = defineAsyncComponent(() => import('@/views/sidebar/SceneBar.vue'));
const ObjectPanel = defineAsyncComponent(() => import('@/views/sidebar/Object.vue'));
const Pet = defineAsyncComponent(() => import('@/views/tools/Pet.vue'));
const FileManager = defineAsyncComponent(() => import('@/views/sidebar/FileManager.vue'));
const ProjectSettings = defineAsyncComponent(() => import('@/views/sidebar/ProjectSettings.vue'));
const NodeGraphPanel = defineAsyncComponent(() => import('@/views/sidebar/NodeGraphPanel.vue'));
const CabbageChatPanel = defineAsyncComponent(() => import('@/views/sidebar/CabbageChatPanel.vue'));
const EditorSettings = defineAsyncComponent(() => import('@/views/sidebar/EditorSettings.vue'));
const LightFieldCalibrationPanel = defineAsyncComponent(
  () => import('@/components/panels/LightFieldCalibrationPanel.vue')
);

export const PANEL_COMPONENTS = Object.freeze({
  SceneControls: defineAsyncComponent(() => import('@/views/sidebar/SceneControls.vue')),
  CabbageTasks: defineAsyncComponent(() => import('@/views/sidebar/CabbageTasks.vue')),
  SceneTools: SceneBar,
  LightFieldCalibration: LightFieldCalibrationPanel,
  Object: ObjectPanel,
  AITool: Pet,
  FileManager,
  ProjectSettings,
  NodeGraphPanel,
  CabbageChatPanel,
  EditorSettings,
});

export function getPluginComponent(id) {
  return PANEL_COMPONENTS[id] ?? null;
}
