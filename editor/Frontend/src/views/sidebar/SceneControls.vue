<template>
  <div class="scene-controls-panel">
    <p v-if="!ready" class="panel-status" role="status">正在连接主视口…</p>
    <p v-if="error" class="panel-status panel-error" role="alert">{{ error }}</p>
    <div v-if="ready" class="scene-controls-body">
    <aside
      class="scene-quick-controls" :inert="!state.available"
      :aria-label="translate('layout.sceneControls')"
      @mousedown.stop
      @pointerdown.stop
      @click.stop
      @wheel.stop
    >
      <details>
        <summary>{{ translate('layout.menuView') }}</summary>
        <div class="panel-commands">
          <button v-for="panel in toolPanels" :key="panel.id" @click="openTool(panel.id)">{{ translate(panel.displayNameKey) }}</button>
        </div>
      </details>
      <details @toggle="refreshPhysics">
        <summary>{{ translate('editorSettings.physics') }}</summary>
        <form class="physics-fields" @submit.prevent="act('applyPhysics', { ...physicsDraft })">
          <label v-for="field in physicsFields" :key="field">
            {{ translate('editorSettings.' + field) }}
            <input v-model.number="physicsDraft[field]" type="number" step="any" required />
          </label>
          <button>{{ translate('editorSettings.applyPhysics') }}</button>
        </form>
      </details>
      <section class="scene-quick-render" aria-label="渲染设置" data-guidance="render-settings"
        :inert="state.creativeRenderDefaultsBusy" :aria-busy="state.creativeRenderDefaultsBusy">
        <div class="scene-quick-render-mode">
          <span>渲染模式</span>
          <!-- CEF's offscreen renderer paints PET_VIEW only, so keep the menu in the page. -->
          <div
            class="scene-quick-render-menu"
            @keydown.esc.stop="activeMenu = null; $refs.mainRenderModeButton?.focus()"
          >
            <button
              ref="mainRenderModeButton"
              type="button"
              class="scene-quick-render-trigger"
              aria-label="渲染模式"
              aria-haspopup="menu"
              :aria-expanded="activeMenu === 'render'"
              :disabled="!state.cameraId"
              @click="toggleMenu('render')"
              @keydown.down.prevent="activeMenu = 'render'"
            >
              <span>{{ state.mainRenderModeLabel }}</span>
              <span aria-hidden="true">▾</span>
            </button>
            <div v-if="activeMenu === 'render'" class="scene-quick-render-dropdown" role="menu" aria-label="渲染模式选项">
              <button
                v-for="mode in state.mainRenderModeOptions"
                :key="mode.value"
                type="button"
                role="menuitemradio"
                :aria-checked="mode.value === (state.mainRenderBackend === 'vision' ? state.mainVisionRenderMode : 'native')"
                :disabled="mode.backend === 'vision' && !state.visionAvailable"
                @click="select('selectMainRenderMode', mode.value)"
              >
                {{ mode.label }}
              </button>
            </div>
          </div>
        </div>
        <div class="scene-quick-render-mode">
          <span>降噪类型</span>
          <div
            class="scene-quick-render-menu"
            @keydown.esc.stop="activeMenu = null; $refs.mainDenoiserButton?.focus()"
          >
            <button
              ref="mainDenoiserButton"
              type="button"
              class="scene-quick-render-trigger"
              aria-label="降噪类型"
              aria-haspopup="menu"
              :aria-expanded="activeMenu === 'denoiser'"
              :disabled="state.mainRenderBackend !== 'vision' || state.mainVisionRenderMode === 'ssat' || state.mainVisionDenoiserBusy || !state.cameraId"
              @click="toggleMenu('denoiser')"
              @keydown.down.prevent="activeMenu = 'denoiser'"
            >
              <span>{{ state.mainVisionRenderMode === 'ssat' ? 'SSAT' : visionDenoisers.find(item => item.value === state.mainVisionDenoiser)?.label }}</span>
              <span aria-hidden="true">▾</span>
            </button>
            <div v-if="activeMenu === 'denoiser'" class="scene-quick-render-dropdown" role="menu" aria-label="降噪类型选项">
              <button
                v-for="denoiser in visionDenoisers"
                :key="denoiser.value"
                type="button"
                role="menuitemradio"
                :aria-checked="denoiser.value === state.mainVisionDenoiser"
                @click="select('selectMainVisionDenoiser', denoiser.value)"
              >
                {{ denoiser.label }}
              </button>
            </div>
          </div>
        </div>
        <PtSettings :scene-id="state.sceneId" :camera-id="state.cameraId || ''"
          :enabled="state.mainRenderBackend === 'vision' && state.mainVisionRenderMode === 'path_tracing'" />
        <RestirSettings :scene-id="state.sceneId" :camera-id="state.cameraId || ''"
          :enabled="state.mainRenderBackend === 'vision' && state.mainVisionRenderMode === 'restir'" />
        <ReblurSettings :scene-id="state.sceneId" :camera-id="state.cameraId || ''"
          :enabled="state.mainRenderBackend === 'vision' && state.mainVisionRenderMode !== 'ssat' && state.mainVisionDenoiser === 'reblur' && !state.mainVisionDenoiserBusy" />
        <RelaxSettings :scene-id="state.sceneId" :camera-id="state.cameraId || ''"
          :enabled="state.mainRenderBackend === 'vision' && state.mainVisionRenderMode !== 'ssat' && state.mainVisionDenoiser === 'relax' && !state.mainVisionDenoiserBusy" />
        <div class="scene-quick-render-options">
          <label title="累积 PT / ReSTIR 样本">
            <input
              type="checkbox"
              aria-label="累积样本"
              :checked="state.mainVisionAccumulation"
              :disabled="state.mainRenderBackend !== 'vision' || state.mainVisionRenderMode === 'ssat' || state.mainVisionAccumulationBusy || !state.cameraId"
              @change="act('toggleMainVisionAccumulation')"
            />
            <span>累积样本</span>
          </label>
          <label title="启用所选降噪算法">
            <input
              type="checkbox"
              aria-label="降噪"
              :checked="state.mainVisionDenoise"
              :disabled="state.mainRenderBackend !== 'vision' || state.mainVisionRenderMode === 'ssat' || state.mainVisionDenoiseBusy || !state.cameraId"
              @change="act('toggleMainVisionDenoise')"
            />
            <span>降噪</span>
          </label>
          <label title="ReSTIR Stable Plane">
            <input
              type="checkbox"
              aria-label="Stable Plane"
              :checked="state.mainVisionStablePlanes"
              :disabled="state.mainRenderBackend !== 'vision' || state.mainVisionRenderMode !== 'restir' || state.mainVisionStablePlanesBusy || !state.cameraId"
              @change="act('toggleMainVisionStablePlanes')"
            />
            <span>Stable Plane</span>
          </label>
        </div>
        <p v-if="state.creativeRenderDefaultsError || state.mainVisionAccumulationError || state.mainVisionDenoiseError || state.mainVisionDenoiserError || state.mainVisionStablePlanesError" role="alert" class="text-red-300 text-xs">
          {{ state.creativeRenderDefaultsError || state.mainVisionAccumulationError || state.mainVisionDenoiseError || state.mainVisionDenoiserError || state.mainVisionStablePlanesError }}
        </p>
      </section>
      <label class="scene-quick-camera-speed" data-guidance="camera-speed">
        <span>{{ translate('editorSettings.cameraSpeed') }}</span>
        <input
          type="range"
          min="0.01"
          max="2"
          step="0.01"
          :value="state.cameraSpeed"
          :aria-label="translate('editorSettings.cameraSpeed')"
          :title="translate('editorSettings.cameraSpeed')"
          @input="act('setCameraSpeedFromPanel', Number($event.target.value))"
        />
        <strong>{{ state.cameraSpeed.toFixed(2) }}</strong>
      </label>
      <section
        class="scene-quick-lighting"
        data-guidance="scene-lighting"
        :data-assistant-title="translate('layout.sceneLighting')"
        :data-assistant-description="translate('layout.sceneLightingDescription')"
      >
        <div class="scene-quick-lighting-header">
          <span>{{ translate('layout.sceneLighting') }}</span>
          <label class="scene-quick-light-toggle">
            <input
              :checked="state.sceneLightSettings.enabled"
              type="checkbox"
              :disabled="state.sceneLightBusy"
              @change="act('setSceneLightEnabled', $event.target.checked)"
            />
            <span>{{ state.sceneLightSettings.enabled ? translate('common.yes') : translate('common.no') }}</span>
          </label>
        </div>
        <div class="scene-quick-direction" :class="{ disabled: !state.sceneLightSettings.enabled || state.sceneLightBusy }">
          <span class="scene-quick-direction-label">{{ translate('layout.lightDirection') }}</span>
          <label v-for="axis in ['x', 'y', 'z']" :key="axis">
            <span>{{ axis.toUpperCase() }}</span>
            <input
              :value="state.sceneLightSettings.direction[axis]"
              type="number"
              step="0.1"
              :disabled="!state.sceneLightSettings.enabled || state.sceneLightBusy"
              :data-guidance="axis === 'x' ? 'scene-light-x' : undefined"
              @change="act('setSceneLightDirection', axis, Number($event.target.value))"
            />
          </label>
        </div>
      </section>
    </aside>
    </div>
  </div>
</template>
<script setup>
import { PLUGIN_MANIFEST } from '@/config/pluginManifest.js';
import { appService } from '@/services/appService.js';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCreativePanelState } from '@/services/creativePanelState.js';
import { visionDenoisers } from '@/utils/visionRenderModes.js';
import PtSettings from '@/components/ui/PtSettings.vue';
import RestirSettings from '@/components/ui/RestirSettings.vue';
import ReblurSettings from '@/components/ui/ReblurSettings.vue';
import RelaxSettings from '@/components/ui/RelaxSettings.vue';
const { t: translate } = useI18n();
const { state, ready, error, act } = useCreativePanelState();
const toolPanels = PLUGIN_MANIFEST.filter(panel => panel.id !== 'SceneControls');
const openTool = panelId => appService.crossTabBroadcast('creative-panel-open', { panelId });
const physicsFields = ['gravityX', 'gravityY', 'gravityZ', 'floorY', 'floorRestitution', 'fixedDt'];
const physicsDraft = ref({});
// Camera state is broadcast frequently. Refresh the form only when the actual physics values change.
watch(physicsFields.map(field => () => state.value.physics?.[field]), () => {
  physicsDraft.value = { ...(state.value.physics ?? {}) };
}, { immediate: true });
const refreshPhysics = event => { if (event.target.open) void act('refreshPhysics'); };
const activeMenu = ref(null);
const toggleMenu = menu => { activeMenu.value = activeMenu.value === menu ? null : menu; };
const select = (action, value) => { activeMenu.value = null; return act(action, value); };
</script>
<style scoped>
.physics-fields { display:grid; gap:6px; padding:8px; }
.physics-fields label { display:flex; justify-content:space-between; }
.physics-fields input { width:7em; background:#19211c; }
.panel-commands { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:6px 0; }
.panel-commands button { border:1px solid #434d46; border-radius:4px; padding:3px 8px; }
.panel-commands button:disabled { opacity:0.5; }

.scene-controls-panel { height:100%; min-height:0; display:flex; flex-direction:column; color:#e8ede3; background:#101711; }
.scene-controls-body { min-height:0; overflow:auto; flex:1; padding:12px; }
.scene-quick-controls { width:100%; }
.panel-status { padding:8px 12px; font-size:12px; }
.panel-error { color:#fca5a5; }
.scene-quick-render {
  padding-bottom: 9px;
  margin-bottom: 9px;
  border-bottom: 1px solid #4d4024;
  font-size: 11px;
}

.scene-quick-render-mode,
.scene-quick-render-options,
.scene-quick-render-options label {
  display: flex;
  align-items: center;
  gap: 7px;
}

.scene-quick-render-mode {
  justify-content: space-between;
  font-family: var(--ce-font-display);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #e6d5a7;
}

.scene-quick-render-menu {
  position: relative;
  min-width: 0;
  flex: 0 1 180px;
}

.scene-quick-render-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #4d4024;
  border-radius: 2px;
  background: #101711;
  color: #e8ede3;
}

.scene-quick-render-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 1;
  padding: 4px;
  border: 1px solid #8a7440;
  border-radius: 2px;
  background: #101711;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.6);
}

.scene-quick-render-dropdown button {
  display: block;
  width: 100%;
  padding: 7px 8px;
  border-radius: 3px;
  text-align: left;
}

.scene-quick-render-dropdown button[aria-checked='true'] {
  color: #e6d5a7;
  background: #1d2820;
}

.scene-quick-render-dropdown button:not(:disabled):hover,
.scene-quick-render-dropdown button:not(:disabled):focus-visible {
  background: #2b362d;
  color: #e6d5a7;
}

.scene-quick-render-options {
  margin-top: 8px;
  gap: 18px;
}

.scene-quick-render-options input {
  accent-color: #b3995d;
}

.scene-quick-render input:disabled,
.scene-quick-render button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scene-quick-camera-speed {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-bottom: 9px;
  margin-bottom: 9px;
  border-bottom: 1px solid #4d4024;
  font-size: 11px;
}

.scene-quick-camera-speed span {
  white-space: nowrap;
}

.scene-quick-camera-speed input {
  flex: 1;
  min-width: 0;
  accent-color: #b3995d;
  cursor: pointer;
}

.scene-quick-camera-speed input:focus-visible {
  outline: 2px solid #b3995d;
  outline-offset: 3px;
}

.scene-quick-camera-speed strong {
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.scene-quick-lighting-header,
.scene-quick-direction,
.scene-quick-light-toggle,
.scene-quick-direction label {
  display: flex;
  align-items: center;
}

.scene-quick-lighting {
  margin: 0;
}

.scene-quick-lighting-header {
  justify-content: space-between;
  color: #eadfbd;
  font-size: 11px;
  font-weight: 700;
}

.scene-quick-light-toggle {
  gap: 5px;
  color: #bfb493;
  font-size: 10px;
  font-weight: 500;
}

.scene-quick-light-toggle input {
  accent-color: #b3995d;
}

.scene-quick-direction {
  min-width: 0;
  margin-top: 7px;
  gap: 5px;
}

.scene-quick-direction.disabled {
  opacity: 0.5;
}

.scene-quick-direction-label {
  flex: 0 0 auto;
  margin-right: 2px;
  color: #a99d80;
  font-size: 10px;
}

.scene-quick-direction label {
  min-width: 0;
  flex: 1 1 0;
  gap: 3px;
  color: #91876e;
  font-size: 9px;
}

.scene-quick-direction input {
  width: 100%;
  min-width: 0;
  padding: 4px 5px;
  border: 1px solid #4d4024;
  border-radius: 4px;
  outline: none;
  background: #0c120e;
  color: #e8ede3;
  font-size: 10px;
}

.scene-quick-direction input:focus {
  border-color: #b3995d;
}

</style>
