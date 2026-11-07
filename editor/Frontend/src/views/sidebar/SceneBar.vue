<template>
  <div
    class="scene-tools-panel rounded-lg overflow-hidden flex flex-col flex-1 min-h-0 h-full w-full relative"
  >

    <!-- 主内容区域 -->
    <div class="flex flex-col flex-1 min-h-0">
      <div class="flex flex-col flex-1 min-h-0">
        <!-- 工具栏 -->
        <div
          class="flex items-center gap-1 px-2 py-1.5 bg-[#2b362d]/60 border-b border-[#18221a]/30"
        >
          <!-- 导入下拉 -->
          <div class="relative" data-guidance="scene-import-model">
            <button
              class="p-1.5 hover:bg-[#3a4a3c] rounded text-[#e8ede3] text-xs flex items-center gap-1"
              title="导入"
              :disabled="importing"
              @click.stop="ToggleModelDropdown"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                ></path>
              </svg>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </button>
            <div
              v-if="ShowModelDropdown"
              v-click-outside="CloseModelDropdown"
              class="absolute z-20 mt-1 w-32 bg-[#2b362d] rounded shadow-lg border border-[#18221a]"
            >
              <button
                class="block w-full px-3 py-1.5 text-xs text-[#e8ede3] hover:bg-[#3a4a3c] text-left"
                @click.stop="HandleFileImport"
              >
                📦 模型
              </button>
              <button
                class="block w-full px-3 py-1.5 text-xs text-[#e8ede3] hover:bg-[#3a4a3c] text-left"
                @click.stop="HandleActorImport"
              >
                👤 单位
              </button>
              <button
                class="block w-full px-3 py-1.5 text-xs text-[#e8ede3] hover:bg-[#3a4a3c] text-left"
                @click.stop="HandleMultimediaImport"
              >
                🎵 音频
              </button>
              <button
                class="block w-full px-3 py-1.5 text-xs text-[#e8ede3] hover:bg-[#3a4a3c] text-left"
                @click.stop="HandleUiImageImport"
              >
                🖼 UI图片
              </button>
            </div>
          </div>
          <button
            class="p-1.5 hover:bg-[#3a4a3c] rounded text-[#e8ede3]"
            title="添加摄像头"
            @click.stop="ImportCamera"
          >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
              />
            </svg>
          </button>
          <div class="w-px h-4 bg-[#18221a] mx-1"></div>
          <button
            class="p-1.5 hover:bg-[#3a4a3c] rounded text-[#e8ede3]"
            title="保存场景"
            @click.stop="SaveScene"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              ></path>
            </svg>
          </button>
          <button
            class="p-1.5 hover:bg-[#3a4a3c] rounded text-[#e8ede3]"
            title="截图"
            @click.stop="TakeScreenshot"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <!-- Vision / Native 渲染后端切换（仅 Vision 可用时显示） -->
          <button
            v-if="visionAvailable"
            class="p-1.5 hover:bg-[#3a4a3c] rounded flex items-center gap-0.5"
            :class="activeRenderBackend === 'vision' ? 'text-[#b3995d]' : 'text-[#e8ede3]'"
            :title="
              activeRenderBackend === 'vision'
                ? '当前: Vision (路径追踪)，点击切换到 Native'
                : '当前: Native (光栅化)，点击切换到 Vision'
            "
            @click.stop="ToggleRenderBackend"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 12a9 9 0 1018 0 9 9 0 00-18 0zm9-9v18m-9-9h18"
              />
            </svg>
          </button>
          <!-- GBuffer 输出模式切换 -->
        </div>

        <!-- 场景树 -->
        <div class="scene-list-surface flex-1 overflow-y-auto">
          <div class="select-none">
            <!-- Cameras 分组 -->
            <div
              class="flex items-center px-2 py-1 bg-[#2b362d]/50 border-b border-[#18221a]/30 cursor-pointer"
              @click="camerasExpanded = !camerasExpanded"
            >
              <svg
                class="w-3 h-3 text-[#8d9e85] mr-1 transition-transform"
                :class="{ 'rotate-90': camerasExpanded }"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M10 6l6 6-6 6z" />
              </svg>
              <svg class="w-3.5 h-3.5 text-[#b3995d] mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                />
              </svg>
              <span class="text-xs text-[#e8ede3] font-medium">Cameras</span>
              <button
                class="ml-auto mr-2 text-sm leading-none text-[#b3995d] hover:text-white"
                title="Create camera view"
                aria-label="Create camera view"
                @click.stop="ImportCamera"
              >
                +
              </button>
              <span class="text-xs text-[#6f7f69]">{{ sceneCameras.length }}</span>
            </div>
            <div v-show="camerasExpanded" class="pl-2">
              <div v-for="cam in sceneCameras" :key="'cam-' + (cam.camera_id || cam.name)">
                <!-- Camera 行 -->
                <div
                  class="group flex items-center px-2 py-0.5 hover:bg-[#2b362d]/50 cursor-pointer border-l-2 border-transparent hover:border-[#b3995d]"
                  :class="{ 'bg-[#4b391c]/60': selectedItem === 'cam:' + cam.name }"
                  @mouseenter="RefreshCameraListOnHover"
                  @click="SelectCamera(cam)"
                  @dblclick="isCameraDeletable(cam) && OpenCameraView(cam)"
                >
                  <span class="w-5 flex-shrink-0">
                    <svg class="w-4 h-4 text-[#b3995d]" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                      />
                    </svg>
                  </span>
                  <span class="text-xs text-[#e8ede3] truncate flex-1" :title="cam.name">
                    {{ cam.name }}
                  </span>
                  <span
                    class="text-[10px] text-[#6f7f69] mr-1 hidden group-hover:inline"
                    :title="'fov: ' + (cam.fov != null ? cam.fov.toFixed(1) : '-')"
                  >
                    {{ cam.width }}x{{ cam.height }}
                  </span>
                  <button
                    v-if="isCameraDeletable(cam)"
                    class="hidden group-hover:inline text-xs leading-none text-[#888] hover:text-[#ef5350] disabled:opacity-30 disabled:hover:text-[#888]"
                    :disabled="sceneCameras.length <= 1"
                    title="Delete camera"
                    aria-label="Delete camera"
                    @click.stop="DeleteCamera(cam)"
                  >
                    x
                  </button>
                </div>
              </div>
              <div v-if="sceneCameras.length === 0" class="px-4 py-2 text-center">
                <span class="text-[10px] text-[#6f7f69]">无相机</span>
              </div>
            </div>

            <!-- Scene Collection 分组 -->
            <div
              class="flex items-center px-2 py-1 bg-[#2b362d]/50 border-b border-[#18221a]/30 cursor-pointer"
              @click="actorsExpanded = !actorsExpanded"
            >
              <svg
                class="w-3 h-3 text-[#8d9e85] mr-1 transition-transform"
                :class="{ 'rotate-90': actorsExpanded }"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M10 6l6 6-6 6z" />
              </svg>
              <span class="text-xs text-[#e8ede3] font-medium">Scene Collection</span>
              <span class="ml-auto text-xs text-[#6f7f69]">{{ sceneImages.length }}</span>
            </div>

            <!-- 对象列表 -->
            <div v-show="actorsExpanded" class="pl-2 pb-8" data-guidance="scene-actor-list">
              <template v-for="scene in sceneImages" :key="scene.name">
                <div
                  :data-actor-name="scene.name"
                  class="group flex items-center px-2 py-0.5 hover:bg-[#2b362d]/50 cursor-pointer border-l-2 border-transparent hover:border-[#b3995d]"
                  :class="{ 'bg-[#4b391c]/60': selectedItem === scene.name }"
                  @click="onActorRowClick(scene, $event)"
                  @dblclick="onActorRowDoubleClick(scene, $event)"
                >
                  <!-- 图标 -->
                  <span class="w-5 flex-shrink-0">
                    <template v-if="scene.type === 'light'">
                      <svg class="w-4 h-4 text-[#ffd54f]" fill="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"
                        />
                      </svg>
                    </template>
                    <template v-else-if="scene.type === 'camera'">
                      <svg class="w-4 h-4 text-[#b3995d]" fill="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                        />
                      </svg>
                    </template>
                    <template v-else-if="scene.type === 'video'">
                      <!-- 视频：胶片/播放图标 -->
                      <svg class="w-4 h-4 text-[#c586c0]" fill="currentColor" viewBox="0 0 24 24">
                        <path
                          d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm6 4v8l6-4-6-4z"
                        />
                      </svg>
                    </template>
                    <template v-else-if="scene.type === 'audio'">
                      <!-- 音频：音符图标 -->
                      <svg class="w-4 h-4 text-[#dcdcaa]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
                      </svg>
                    </template>
                    <template v-else>
                      <svg class="w-4 h-4 text-[#e8ede3]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </template>
                  </span>
                  <!-- 名称 -->
                  <span class="text-xs text-[#e8ede3] truncate flex-1" :title="scene.name">
                    {{ scene.name }}
                  </span>
                  <span
                    v-if="scene.load_status === 'gpu_uploading'"
                    class="text-[10px] text-[#8ab4f8] mr-1"
                    title="GPU 资源正在分批上传"
                    data-testid="actor-gpu-uploading"
                  >
                    上传中
                  </span>
                  <button
                    v-else-if="scene.load_status && scene.load_status !== 'loaded'"
                    class="text-[10px] text-[#f0c674] mr-1"
                    :title="scene.load_error?.message || '资源加载失败，点击重新绑定'"
                    data-testid="actor-load-warning"
                    @click.stop="RebindActorResource(scene)"
                  >
                    ⚠ 重新绑定
                  </button>
                  <!-- 类型标签 -->
                  <span class="text-[10px] text-[#6f7f69] mr-2 hidden group-hover:inline">
                    {{ getTypeShort(scene.type) }}
                  </span>
                  <!-- 显隐切换按钮 -->
                  <button
                    class="w-5 h-5 flex items-center justify-center rounded transition-all mr-0.5"
                    :class="
                      scene.visible === false
                        ? 'text-[#555] hover:text-[#999]'
                        : 'text-[#e8ede3] hover:text-[#ffd54f]'
                    "
                    :title="scene.visible === false ? '显示' : '隐藏'"
                    @click.stop="ToggleVisible(scene)"
                    @dblclick.stop
                  >
                    <svg
                      v-if="scene.visible !== false"
                      class="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <svg
                      v-else
                      class="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                      />
                    </svg>
                  </button>
                  <!-- 音频播放 / 停止按钮 -->
                  <button
                    v-if="scene.type === 'audio'"
                    class="w-5 h-5 flex items-center justify-center rounded transition-all mr-0.5"
                    :class="
                      (playingStates[scene.name] ?? scene._playing)
                        ? 'text-[#f48771] hover:text-[#f48771] hover:bg-red-400/20'
                        : 'text-[#dcdcaa] hover:text-[#dcdcaa] hover:bg-yellow-400/20'
                    "
                    :title="(playingStates[scene.name] ?? scene._playing) ? '停止' : '播放'"
                    @click.stop="handlePlayToggle(scene)"
                    @dblclick.stop
                  >
                    <!-- 播放 ▶ -->
                    <svg
                      v-if="!(playingStates[scene.name] ?? scene._playing)"
                      class="w-3.5 h-3.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <!-- 停止 ■ -->
                    <svg v-else class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 6h12v12H6z" />
                    </svg>
                  </button>
                  <!-- 删除按钮 -->
                  <button
                    class="w-5 h-5 flex items-center justify-center text-[#6f7f69] hover:text-red-400 hover:bg-red-400/20 rounded transition-all"
                    title="删除"
                    @click.stop="DeleteActor(scene)"
                    @dblclick.stop
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                <ModelNodeHierarchy
                  v-if="Number(scene.model_node_count || 0) > 0"
                  :active="actorsExpanded"
                  :scene-name="currentSceneName"
                  :actor="scene"
                  :selection="modelNodeSelection"
                  @select="selectModelNode"
                />
              </template>
              <!-- 空状态 -->
              <div v-if="sceneImages.length === 0" class="px-4 py-8 text-center">
                <span class="text-xs text-[#6f7f69]">场景为空，点击 + 添加对象</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部状态栏 -->
      <div
        class="flex items-center px-2 py-1 bg-[#2b362d]/60 border-t border-[#18221a]/30 text-[10px] text-[#8d9e85]"
      >
        <span>对象: {{ sceneImages.length }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { createViewLifetime } from '@/utils/viewLifetime.js';
const viewLifetime = createViewLifetime();
import { useRoute } from 'vue-router';
import ModelNodeHierarchy from '@/components/ui/ModelNodeHierarchy.vue';
import { pickedNodeIdentity } from '@/utils/modelHierarchy.js';
import { editorApi } from '@/api/editorApi.js';
import { appService } from '@/services/appService.js';
import { DEFAULT_SCENE_NAME } from '@/utils/constants.js';
import { resolveOpenedProjectScene } from '@/services/projectLauncherService.js';
import { emptySceneTreeSettlement, resolveSceneTreeSnapshot } from '@/utils/sceneTreeSnapshot.js';
import { useErrorHandler } from '@/composables/useErrorHandler.js';
import { setActorContext } from '@/blockly/composables/useActorContext.js';
import { coronaEventBus } from '@/utils/eventBus.js';
import { cabbageContextService } from '@/services/cabbageAssistantContextService.js';


const { error: logError, warn: logWarn } = useErrorHandler('SceneBar');

const currentSceneName = ref('');
const archiveSession = ref('');
let sceneTreeRequestSeq = 0;
let sceneTreeSettleTimer = null;
let sceneTreeSettleTimerScene = '';
const sceneTreeSettlement = ref(emptySceneTreeSettlement());

const clearSceneTreeSettleRetry = () => {
  if (sceneTreeSettleTimer) window.clearTimeout(sceneTreeSettleTimer);
  sceneTreeSettleTimer = null;
  sceneTreeSettleTimerScene = '';
};

// A project or scene opened by the native editor materializes asynchronously, so
// an empty snapshot can mean "the actors are not created yet" rather than "the
// scene is empty".  Keep asking inside the settle window instead of leaving the
// dock blank.
const scheduleSceneTreeSettleRetry = (delayMs, sceneName) => {
  if (!delayMs) return;
  if (sceneTreeSettleTimer && sceneTreeSettleTimerScene === sceneName) return;
  clearSceneTreeSettleRetry();
  sceneTreeSettleTimerScene = sceneName;
  sceneTreeSettleTimer = window.setTimeout(() => {
    sceneTreeSettleTimer = null;
    sceneTreeSettleTimerScene = '';
    if (sceneName !== currentSceneName.value) return;
    void OnInitObjTree();
  }, delayMs);
};

const importing = ref(false);
const publishImportProgress = (active, message = '', progress = 0) => {
  importing.value = active;
  void appService.crossTabBroadcast('scene-import-progress', { active, message, progress })
    .catch(error => logWarn('导入进度通知失败', error));
};

// 导入失败此前只走 console.error，用户侧完全没有反馈：模型不出现在场景栏，
// 也没有任何提示，看起来就像"点了没反应"。这里统一负责记日志 + 弹出可见错误。
const reportImportError = (label, error) => {
  logError(label, error);
  const detail = error instanceof Error ? error.message : error ? String(error) : '';
  window.alert(detail ? `${label}：${detail}` : label);
};

const getTypeShort = (type) => {
  const lowerType = (type || 'obj').toLowerCase();
  const typeMap = {
    light: 'Light',
    camera: 'Camera',
    obj: 'Mesh',
    fbx: 'Mesh',
    '3ds': 'Mesh',
    dae: 'Mesh',
    gltf: 'Mesh',
    glb: 'Mesh',
    stl: 'Mesh',
    mp4: 'Video',
    avi: 'Video',
    mov: 'Video',
    mp3: 'Audio',
    wav: 'Audio',
    video: 'Video',
    audio: 'Audio',
    actor: 'Actor',
    model: 'Model',
    mesh: 'Mesh',
    multimedia: 'Media',
  };
  return typeMap[lowerType] || 'Object';
};

const selectedItem = ref(null);
const modelNodeSelection = ref(null);
const publishModelNodeSelection = (identity) => {
  modelNodeSelection.value = identity;
  coronaEventBus.modelNodeSelection = identity;
  coronaEventBus.emit('model-node-selection', identity);
};
const selectModelNode = (identity) => {
  const previous = modelNodeSelection.value;
  publishModelNodeSelection(identity);
  selectedItem.value = null;
  const actorName = identity?.actorName || previous?.actorName;
  if (!actorName) return;
  const actor = sceneImages.value.find((item) => item.name === actorName);
  editorApi.sceneTools
    .selectActor(currentSceneName.value, actor?.type || 'model', actorName, {
      node_index: identity?.nodeIndex ?? null,
    })
    .catch((error) => logError('Failed to publish model node selection', error));
};
const handleModelNodePick = (payload) => {
  const scene = payload.sceneId || payload.scene || payload.scene_id;
  if (scene && scene !== currentSceneName.value) return;
  publishModelNodeSelection(pickedNodeIdentity(payload));
  if (modelNodeSelection.value) {
    selectedItem.value = null;
    actorsExpanded.value = true;
  }
};
const selectedCameraName = ref(null);
const sceneCameras = ref([]);
const camerasExpanded = ref(true);
const actorsExpanded = ref(true);

const sceneImages = ref([]);
const playingStates = reactive({}); // { name: true/false } — 音频播放状态
const route = useRoute();
const px = ref('1.0'),
  py = ref('1.0'),
  pz = ref('1.0');
const recording = ref(false);

const ACTOR_SINGLE_CLICK_DELAY_MS = 280;
const CAMERA_LIST_HOVER_REFRESH_MS = 500;
let actorSingleClickTimer = null;
let actorFocusSeq = 0;
let cameraListRefreshInFlight = false;
let lastCameraListHoverRefreshAt = 0;

const isMediaItem = (scene) => scene && (scene.type === 'video' || scene.type === 'audio');
// audio Actor：type 为 audio 且有真实 handle（来自场景树），按 Actor 处理（可选中、可编辑变换）。
// 区别于扁平音频媒体资源（仅 resourceId，无 handle）。
const isAudioActor = (scene) =>
  scene && scene.type === 'audio' && normalizeHandle(scene.handle) > 0;

const normalizeHandle = (value) => {
  const handle = Number(value);
  return Number.isFinite(handle) && handle > 0 ? handle : 0;
};

const clearActorSingleClickTimer = () => {
  if (actorSingleClickTimer) {
    clearTimeout(actorSingleClickTimer);
    actorSingleClickTimer = null;
  }
};

const ControlObject = async (scene) => {
  // 音视频是独立资源，没有可操作的 Actor；但 audio Actor 是真实 Actor。
  if (isMediaItem(scene) && !isAudioActor(scene)) return;
  try {
    await editorApi.sceneTools.openActor(currentSceneName.value, scene.name);
  } catch (e) {
    logError('Failed to open actor', e);
  }
};

const SelectActor = (scene) => {
  publishModelNodeSelection(null);
  selectedItem.value = scene.name;
  // 扁平音视频资源仅作选中；audio Actor 走正常 Actor 选中（打开物体栏变换编辑器）。
  if (isMediaItem(scene) && !isAudioActor(scene)) return;
  // 通知积木编辑器当前选中的物体
  setActorContext(currentSceneName.value, scene.name);
  void cabbageContextService.recordEvent({
    type: 'actor_selected',
    category: 'scene',
    success: true,
    details: {
      sceneName: currentSceneName.value,
      actorName: String(scene.name || ''),
      actorId: String(scene.handle || scene.id || scene.actor_id || ''),
      actorType: String(scene.type || 'actor'),
      source: 'scene_tree',
    },
  });
  editorApi.sceneTools
    .selectActor(currentSceneName.value, scene.type || 'actor', scene.name)
    .catch((error) => {
      logError('Failed to publish actor selection', error);
    });
};

const SelectCamera = (cam) => {
  publishModelNodeSelection(null);
  selectedItem.value = 'cam:' + cam.name;
  selectedCameraName.value = cam.name;
  RefreshRenderBackendState();
};

const OpenCameraView = async (cam) => {
  try {
    await appService.createCameraView({
      ...cam,
      scene_id: currentSceneName.value,
    });
    await OnInitObjTree();
  } catch (e) {
    logError('Failed to open camera view', e);
  }
};

const isCameraDeletable = (cam) => cam?.deletable !== false;

const DeleteCamera = async (cam) => {
  if (sceneCameras.value.length <= 1 || !isCameraDeletable(cam)) return;
  try {
    const cameraId = cam.camera_id || cam.id || cam.name;
    await appService.closeCameraView(currentSceneName.value, cameraId);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await editorApi.sceneTools.deleteCamera(currentSceneName.value, cameraId);
    if (selectedCameraName.value === cam.name) selectedCameraName.value = null;
    if (selectedItem.value === `cam:${cam.name}`) selectedItem.value = null;
    await OnInitObjTree();
  } catch (e) {
    logError('Failed to delete camera', e);
  }
};

const isActorRowActionEvent = (event) => !!event?.target?.closest?.('button');

const getTargetCamera = () => {
  const cameraName = getTargetCameraName();
  return sceneCameras.value.find((cam) => cam.name === cameraName) || sceneCameras.value[0] || null;
};

const focusActorFromList = async (scene) => {
  const focusSeq = ++actorFocusSeq;
  const sceneId = currentSceneName.value;
  const scope = { archive_session: archiveSession.value };
  try {
    const camera = getTargetCamera();
    if (!camera?.camera_id) {
      logWarn('Actor focus skipped: missing target camera identity', scene?.name);
      return;
    }
    const result = await editorApi.scene.focusActor(
      sceneId, scene.actor_guid || scene.name, camera.camera_id, scope,
    );
    if (focusSeq !== actorFocusSeq || scope.archive_session !== archiveSession.value || sceneId !== currentSceneName.value) return;
    if (result.archive_session !== scope.archive_session || result.scene !== sceneId) return;
    // Native already applied the pose. Web only synchronizes the matching viewport UI.
    await appService.crossTabBroadcast('camera-pose-applied', result);
  } catch (e) {
    if (focusSeq === actorFocusSeq) logError('Actor focus failed', e);
  }
};

const onActorRowClick = (scene, event) => {
  clearActorSingleClickTimer();
  SelectActor(scene);

  if (
    isActorRowActionEvent(event) ||
    Number(event?.detail) > 1 ||
    (isMediaItem(scene) && !isAudioActor(scene))
  ) {
    return;
  }

  actorSingleClickTimer = setTimeout(() => {
    actorSingleClickTimer = null;
    ControlObject(scene);
  }, ACTOR_SINGLE_CLICK_DELAY_MS);
};

const onActorRowDoubleClick = (scene, event) => {
  clearActorSingleClickTimer();
  SelectActor(scene);

  if (isActorRowActionEvent(event)) {
    return;
  }

  if (scene?.type === 'audio') {
    handlePlayToggle(scene);
    return;
  }

  if (scene?.type === 'video') {
    return;
  }

  focusActorFromList(scene);
};

/// 切换音频播放/停止
const handlePlayToggle = async (scene) => {
  // audio Actor（来自场景树、有 handle）走空间音频；扁平媒体资源走全局播放。
  const isAudioActor = scene.type === 'audio' && scene.handle != null && !scene.resourceId;
  const rid = scene.resourceId;
  if (!isAudioActor && !rid) {
    logWarn('[audio] No resource_id for', scene.name);
    return;
  }
  const key = scene.name;
  const playing = playingStates[key] ?? scene._playing ?? false;
  if (playing) {
    // 停止
    try {
      if (isAudioActor) {
        await editorApi.sceneTools.actorStopAudio(scene.name);
      } else {
        await editorApi.sceneTools.stopAudio(rid);
      }
    } catch (e) {
      logError('[audio] stop failed', e);
    }
    playingStates[key] = false;
    if (scene._playing !== undefined) scene._playing = false;
  } else {
    // 播放（单次，不循环）
    try {
      if (isAudioActor) {
        await editorApi.sceneTools.actorPlayAudio(scene.name, false);
      } else {
        await editorApi.sceneTools.playAudio(rid, false);
      }
    } catch (e) {
      logError('[audio] play failed', e);
    }
    playingStates[key] = true;
    if (scene._playing !== undefined) scene._playing = true;
  }
};

const ToggleVisible = async (scene) => {
  const newVisible = scene.visible === false ? true : false;
  scene.visible = newVisible;
  // 音视频资源没有对应 Actor，仅在前端切换可见标记
  if (isMediaItem(scene)) return;
  try {
    await editorApi.scene.setActorProperties(currentSceneName.value, scene.name, {
      archive_session: archiveSession.value,
      visible: newVisible,
    });
  } catch (e) {
    scene.visible = !newVisible;
    logError('Failed to toggle visibility', e);
  }
};

const SaveScene = async () => {
  try {
    const unresolvedCount = sceneImages.value.filter(
      (item) => item.load_status && item.load_status !== 'loaded'
    ).length;
    if (
      unresolvedCount > 0 &&
      !window.confirm(
        `当前场景仍有 ${unresolvedCount} 个资源未解决。存档会保留原资源引用和对象数据，是否仍然保存？`
      )
    )
      return;
    const result = await editorApi.main.sceneSave(currentSceneName.value, archiveSession.value);
    const saved = result?.data ?? result;
    if (!saved?.ok) throw new Error(saved?.message || "保存场景失败");
    cabbageContextService.notifySceneSaved(saved.filepath);
    if (saved?.unresolved_actor_count > 0) {
      logWarn(`Scene saved with ${saved.unresolved_actor_count} unresolved actors`);
    }
  } catch (e) {
    logError('Failed to save scene', e);
  }
};

const RebindActorResource = async (scene) => {
  try {
    const selected = await editorApi.sceneTools.selectModelFile(
      currentSceneName.value,
      scene.name,
      'model'
    );
    const path = selected?.data ?? selected;
    if (!path) return;
    const result = await editorApi.sceneTools.rebindActorResource(
      currentSceneName.value,
      scene.actor_guid,
      path
    );
    const rebound = result?.data ?? result;
    if (!rebound?.ok) {
      const message = rebound?.diagnostics?.[0]?.message || '资源重新绑定失败';
      window.alert(message);
      return;
    }
    await OnInitObjTree();
  } catch (e) {
    logError('Failed to rebind actor resource', e);
  }
};

const getTargetCameraName = () => {
  if (
    selectedCameraName.value &&
    sceneCameras.value.some((cam) => cam.name === selectedCameraName.value)
  ) {
    return selectedCameraName.value;
  }

  const item = selectedItem.value || '';
  if (item.startsWith('cam:')) {
    const cameraName = item.slice(4);
    if (sceneCameras.value.some((cam) => cam.name === cameraName)) {
      return cameraName;
    }
  }
  return sceneCameras.value[0]?.name;
};

const TakeScreenshot = async () => {
  try {
    const camera = getTargetCamera();
    if (!camera?.camera_id) return;
    await editorApi.scene.captureScreenshot(currentSceneName.value, camera.camera_id, {
      archive_session: archiveSession.value,
    });
  } catch (e) {
    logError('Failed to take screenshot', e);
  }
};

// Vision / Native 渲染后端切换状态
const visionAvailable = ref(false);
const activeRenderBackend = ref('native');

const RefreshRenderBackendState = async () => {
  try {
    const availResult = await editorApi.sceneTools.isVisionAvailable();
    const availPayload = availResult?.data ?? availResult;
    visionAvailable.value = !!availPayload?.available;
    if (!visionAvailable.value) {
      return;
    }
    const target = getTargetCamera();
    const modeResult = await editorApi.sceneTools.getRenderBackend(
      currentSceneName.value,
      target?.camera_id || target?.name || null
    );
    const modePayload = modeResult?.data ?? modeResult;
    if (modePayload?.mode) {
      activeRenderBackend.value = modePayload.mode;
    }
  } catch (e) {
    logError('Failed to query render backend state', e);
  }
};

const ToggleRenderBackend = async () => {
  const next = activeRenderBackend.value === 'vision' ? 'native' : 'vision';
  try {
    const target = getTargetCamera();
    const result = await editorApi.sceneTools.setRenderBackend(
      next,
      currentSceneName.value,
      target?.camera_id || target?.name || null
    );
    const payload = result?.data ?? result;
    if (result?.success === false || payload?.status === 'error') {
      logError(
        'Switch render backend failed',
        payload?.message || result?.error || 'unknown error'
      );
    } else {
      activeRenderBackend.value = next;
    }
  } catch (e) {
    logError('Failed to switch render backend', e);
  }
};

const ShowModelDropdown = ref(false);
const ToggleModelDropdown = () => {
  ShowModelDropdown.value = !ShowModelDropdown.value;
};
const CloseModelDropdown = () => {
  ShowModelDropdown.value = false;
};

const ImportCamera = async () => {
  ShowModelDropdown.value = false;
  try {
    const existingNames = new Set(sceneCameras.value.map((camera) => camera.name));
    let cameraName = 'Camera';
    let suffix = 1;
    while (existingNames.has(cameraName)) {
      cameraName = `Camera_${suffix++}`;
    }
    const payload = await editorApi.scene.createCamera(currentSceneName.value, {
      archive_session: archiveSession.value, name: cameraName,
    });
    if (!payload?.camera) throw new Error(payload?.message || 'Camera creation failed');
    await appService.createCameraView({
      ...payload.camera,
      scene_id: currentSceneName.value,
    });
    selectedCameraName.value = payload.camera.name;
    await OnInitObjTree();
  } catch (e) {
    logError('Failed to create camera view', e);
  }
};

const unwrapBridgePayload = (result) => result?.data ?? result;

const selectedPathFromImportPayload = (payload) =>
  payload?.path || payload?.file_path || payload?.selected_path || payload?.source_path || '';

const createActorFromSelectedFile = async (payload, actorType, logLabel) => {
  const status = payload?.status;
  if (status === 'canceled') {
    return null;
  }
  const selectedPath = selectedPathFromImportPayload(payload);
  if (!selectedPath) {
    // 静默 return null 会让调用方以为成功，但场景栏里什么都没有。
    // 抛出去交给统一的错误上报，用户至少知道失败了。
    throw new Error(`${logLabel}: 未能获取所选文件路径`);
  }

  publishImportProgress(true, '创建对象', 55);
  const createResult = await editorApi.sceneTools.createActor(
    currentSceneName.value,
    selectedPath,
    actorType
  );
  const createPayload = unwrapBridgePayload(createResult);
  if (createResult?.success === false || createPayload?.status === 'error') {
    throw new Error(
      createPayload?.message || createResult?.error || `${logLabel} native create failed`
    );
  }

  await OnInitObjTree();
  const actor = createPayload?.actor;
  if (actor?.name) {
    selectedItem.value = actor.name;
  }
  publishImportProgress(true, '导入完成', 100);
  if (actorType === 'model') {
    void cabbageContextService.recordEvent({
      type: 'model_imported',
      category: 'scene',
      success: true,
      details: {
        sceneName: currentSceneName.value,
        actorName: String(actor?.name || ''),
        actorId: String(actor?.handle || actor?.id || actor?.actor_id || ''),
        actorType: 'model',
        resourcePath: String(selectedPath || ''),
      },
    });
  }
  return actor || null;
};

const HandleFileImport = async () => {
  ShowModelDropdown.value = false;
  if (!currentSceneName.value) {
    reportImportError('模型导入失败', '当前没有活动场景，请先打开或新建场景');
    return;
  }
  publishImportProgress(true, '请稍候...');
  try {
    const result = await editorApi.main.importResourceFile(currentSceneName.value, 'model');
    const payload = unwrapBridgePayload(result);
    const status = payload?.status;
    if (result?.success === false || status === 'error') {
      reportImportError('模型导入失败', payload?.message || result?.error || 'unknown error');
      return;
    }
    if (status === 'canceled') {
      // 用户主动取消,无需弹错
      return;
    }
    await createActorFromSelectedFile(payload, 'model', 'File import');
  } catch (e) {
    reportImportError('模型导入失败', e);
  } finally {
    publishImportProgress(false);
  }
};

const HandleUiImageImport = async () => {
  // 导入一张图片，自动创建一个带该图为纹理的 quad（光场 UI 平面），默认作为 UI。
  ShowModelDropdown.value = false;
  if (!currentSceneName.value) {
    reportImportError('图片导入失败', '当前没有活动场景，请先打开或新建场景');
    return;
  }
  publishImportProgress(true, '请稍候...');
  try {
    const result = await editorApi.main.importResourceFile(currentSceneName.value, 'ui_image');
    const payload = unwrapBridgePayload(result);
    const status = payload?.status;
    if (result?.success === false || status === 'error') {
      reportImportError('图片导入失败', payload?.message || result?.error || 'unknown error');
      return;
    }
    if (status === 'canceled') {
      return;
    }
    await createActorFromSelectedFile(payload, 'ui_image', 'UI image import');
  } catch (e) {
    reportImportError('图片导入失败', e);
  } finally {
    publishImportProgress(false);
  }
};

const HandleActorImport = async () => {
  ShowModelDropdown.value = false;
  if (!currentSceneName.value) {
    reportImportError('Actor 导入失败', '当前没有活动场景，请先打开或新建场景');
    return;
  }
  publishImportProgress(true, '请稍候...');
  try {
    const result = await editorApi.main.importResourceFile(currentSceneName.value, 'actor');
    const payload = unwrapBridgePayload(result);
    const status = payload?.status;
    if (result?.success === false || status === 'error') {
      reportImportError('Actor 导入失败', payload?.message || result?.error || 'unknown error');
      return;
    }
    if (status === 'canceled') {
      return;
    }
    await createActorFromSelectedFile(payload, 'actor', 'Actor import');
  } catch (e) {
    reportImportError('Actor 导入失败', e);
  } finally {
    publishImportProgress(false);
  }
};

const HandleMultimediaImport = async () => {
  ShowModelDropdown.value = false;
  publishImportProgress(true, '请稍候...');
  try {
    const result = await editorApi.main.importResourceFile(currentSceneName.value, 'multimedia');
    // 兼容包装型 { success, data } 与直返型两种形态
    const payload = result?.data ?? result;
    const status = payload?.status;
    if (result?.success === false || status === 'error') {
      reportImportError('音视频导入失败', payload?.message || result?.error || 'unknown error');
      return;
    }
    if (status === 'canceled') {
      return;
    }
    // 音视频是独立资源；音频额外创建一个可定位的 audio Actor（复用物体栏控制 3D 位置）。
    const media = payload?.media;
    if (media && media.name) {
      if (media.type === 'audio' && media.resource_id) {
        // 创建 audio Actor：复用 create_actor，把 resource_id 作为 actor_data 传入。
        const createResult = await editorApi.sceneTools.createActor(
          currentSceneName.value,
          media.path,
          'audio',
          { audio_resource_id: String(media.resource_id), actor_name: media.name }
        );
        const createPayload = unwrapBridgePayload(createResult);
        if (createResult?.success === false || createPayload?.status === 'error') {
          reportImportError('音频对象创建失败', createPayload?.message || createResult?.error);
        } else {
          await OnInitObjTree();
          const actor = createPayload?.actor;
          if (actor?.name) {
            selectedItem.value = actor.name;
          }
        }
      } else {
        await addMediaToList(media);
      }
      publishImportProgress(true, '导入完成', 100);
    }
  } catch (e) {
    reportImportError('音视频导入失败', e);
  } finally {
    publishImportProgress(false);
  }
};

const addMediaToList = async (media) => {
  if (!media || !media.name) return;
  // media.type 为 'video' / 'audio'
  sceneImages.value.push({
    name: media.name,
    path: media.path,
    type: media.type || 'multimedia',
    visible: true,
    resourceId: media.resource_id,
    duration: media.duration,
    codec: media.codec,
    width: media.width,
    height: media.height,
    fps: media.fps,
    sampleRate: media.sample_rate,
    channels: media.channels,
  });
};

const DeleteActor = async (scene) => {
  sceneImages.value = sceneImages.value.filter((item) => item.name !== scene.name);

  try {
    await editorApi.sceneTools.removeActor(currentSceneName.value, scene.name);
    await OnInitObjTree();
  } catch (error) {
    logError('Delete actor failed', error);
    await OnInitObjTree();
  }
};


const OnInitObjTree = async () => {
  if (!viewLifetime.current()) return;
  const sceneName = currentSceneName.value;
  const archive = archiveSession.value;
  const requestSeq = ++sceneTreeRequestSeq;
  if (!sceneName || !archive) return;
  const current = () => viewLifetime.current() && requestSeq === sceneTreeRequestSeq
    && sceneName === currentSceneName.value && archive === archiveSession.value;
  try {
    const data = await editorApi.scene.readTree(sceneName, { archive_session: archive });
    if (!current() || data.archive_session !== archive || data.scene !== sceneName) return;
    const nextActors = Array.isArray(data.actors)
      ? data.actors.map((item) => ({
          name: item.name,
          actor_guid: item.actor_guid || '',
          model_node_count: Number(item.model_node_count || 0),
          path: item.path,
          type: item.type || 'obj',
          visible: item.visible !== false,
          handle: normalizeHandle(item.opaque_handle),
          audioResourceId: item.audio_resource_id || '',
          load_status: item.load_status || 'loaded',
          load_error: item.load_error || null,
        }))
      : [];
    // Commit the full snapshot atomically.  A failed or stale refresh keeps
    // the last known tree visible instead of presenting an empty panel.
    const decision = resolveSceneTreeSnapshot({
      sceneName,
      actors: nextActors,
      settlement: sceneTreeSettlement.value,
    });
    sceneTreeSettlement.value = decision.settlement;
    // Cameras do not depend on actor materialization.
    if (Array.isArray(data.cameras)) applyCameraList(data.cameras);
    // An empty snapshot taken while a freshly opened scene is still building its
    // actors is provisional; committing it left the dock empty for good.
    if (decision.commit) sceneImages.value = decision.rows;
    scheduleSceneTreeSettleRetry(decision.retryInMs, sceneName);
  } catch (e) {
    if (current()) logError('Failed to load scene tree', e);
  }
};

onMounted(async () => {
  coronaEventBus.on('model-node-picked', handleModelNodePick);
  const active = await editorApi.scene.readActive();
  if (!viewLifetime.current()) return;
  const queryString = window.location.hash?.split('?')[1] || window.location.search?.slice(1);
  const urlSceneName = queryString ? new URLSearchParams(queryString).get('sceneName') : null;

  archiveSession.value = active.archive_session;
  currentSceneName.value = urlSceneName || active.scene || DEFAULT_SCENE_NAME;

  await OnInitObjTree();
  if (!viewLifetime.current()) return;
  await RefreshRenderBackendState();
  if (!viewLifetime.current()) return;
  // 后端对象变化：项目打开/物体变化时重新加载场景树
  await viewLifetime.subscribe(callback => editorApi.scene.observe('selection', callback), onActorChangeEvent, editorApi.off);
  if (!viewLifetime.current()) return;
  await viewLifetime.subscribe(callback => editorApi.scene.observe('tree', callback), onSceneTreeChangedEvent, editorApi.off);
  if (!viewLifetime.current()) return;
  await viewLifetime.subscribe(callback => editorApi.scene.observe('project', callback), onProjectOpenedEvent, editorApi.off);
  if (!viewLifetime.current()) return;
  await viewLifetime.subscribe(callback => editorApi.scene.observe('selection', callback), handleModelNodePick, editorApi.off);
});

// 项目打开时刷新当前场景树；actor 选择只更新详情面板，不重建树，避免点击闪烁。
const onActorChangeEvent = (payload, maybeSceneId /*, actorId, oldPath */) => {
  if (payload?.archive_session && payload.archive_session !== archiveSession.value) return;
  const type = payload?.actor_type ?? payload?.type ?? payload;
  const sceneId = payload?.scene ?? maybeSceneId;
  if (type !== 'scene' || !sceneId) return;
  publishModelNodeSelection(null);
  currentSceneName.value = sceneId;
  OnInitObjTree();
};

const onSceneTreeChangedEvent = (payload) => {
  if (payload?.archive_session && payload.archive_session !== archiveSession.value) return;
  const sceneName = payload?.scene ?? payload;
  if (!sceneName || sceneName === currentSceneName.value) {
    OnInitObjTree();
  }
};

const onProjectOpenedEvent = (payload = {}) => {
  const sceneRoute = resolveOpenedProjectScene(payload);
  if (!sceneRoute || !payload.archive_session) return;
  publishModelNodeSelection(null);
  archiveSession.value = payload.archive_session;
  currentSceneName.value = sceneRoute;
  void OnInitObjTree();
  void RefreshRenderBackendState();
};

const normalizeCameraPayload = (cam) => ({
  archive_session: cam.archive_session,
  id: cam.id || cam.camera_id || cam.name,
  camera_id: cam.camera_id || cam.id || cam.name,
  name: cam.name || 'Camera',
  width: cam.width || 0,
  height: cam.height || 0,
  fov: cam.fov ?? null,
  handle: normalizeHandle(cam.opaque_handle ?? cam.handle ?? cam.camera_handle),
  render_backend: cam.render_backend || 'native',
  output_mode: cam.output_mode || 'final_color',
  deletable: cam.deletable !== false,
  move_speed: cam.move_speed || 1,
  view_open: !!cam.view_open,
  view_x: cam.view_x ?? 120,
  view_y: cam.view_y ?? 120,
  view_width: cam.view_width || 960,
  view_height: cam.view_height || 540,
});

const applyCameraList = (cameras) => {
  sceneCameras.value = cameras.map(normalizeCameraPayload);
  if (!sceneCameras.value.some((cam) => cam.name === selectedCameraName.value)) {
    selectedCameraName.value = sceneCameras.value[0]?.name || null;
  }
};

const RefreshCameraListOnly = async () => {
  const scene = currentSceneName.value, archive = archiveSession.value;
  const current = () => viewLifetime.current() && scene === currentSceneName.value && archive === archiveSession.value;
  if (!current() || !scene || !archive || cameraListRefreshInFlight) {
    return;
  }
  cameraListRefreshInFlight = true;
  try {
    const data = await editorApi.scene.readCameras(scene, { archive_session: archive });
    if (!current() || data.archive_session !== archive || data.scene !== scene) return;
    if (Array.isArray(data?.cameras)) {
      applyCameraList(data.cameras);
    }
  } catch (e) {
    if (current()) logError('Failed to refresh camera list', e);
  } finally {
    cameraListRefreshInFlight = false;
  }
};

const RefreshCameraListOnHover = () => {
  const now = Date.now();
  if (now - lastCameraListHoverRefreshAt < CAMERA_LIST_HOVER_REFRESH_MS) {
    return;
  }
  lastCameraListHoverRefreshAt = now;
  RefreshCameraListOnly();
};

onUnmounted(() => {
  viewLifetime.dispose();
  clearSceneTreeSettleRetry();
  coronaEventBus.off('model-node-picked', handleModelNodePick);
  clearActorSingleClickTimer();
  actorFocusSeq++;
});
</script>

<style scoped>
.scene-tools-panel {
  /* Opaque on purpose: the dock floats over the 3D viewport, and a translucent panel
     made the tree backgrounds and object names unreadable. */
  background: linear-gradient(180deg, #121a14, #11100d);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.34);
}

.scene-list-surface {
  /* Same tone the previous 24% overlay produced over the panel, now opaque. */
  background: #1d1a15;
  /* Match the editor's dark scrollbars instead of the bright CEF default. */
  scrollbar-width: thin;
  scrollbar-color: #4d4024 #14120c;
}

.scene-list-surface::-webkit-scrollbar {
  width: 8px;
}

.scene-list-surface::-webkit-scrollbar-track {
  background: #14120c;
}

.scene-list-surface::-webkit-scrollbar-thumb {
  background: #4d4024;
  border-radius: 999px;
}

.scene-list-surface::-webkit-scrollbar-thumb:hover {
  background: #a8843f;
}

.scene-list-surface::-webkit-scrollbar-corner {
  background: #14120c;
}
</style>
