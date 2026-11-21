<template>
  <div
    class="relative min-h-screen bg-[#0d0d0d] text-white overflow-hidden flex flex-col font-sans"
  >
    <!-- 背景装饰：径向辉光，延续 StartScreen 视觉 -->
    <div class="absolute inset-0 bg-gradient-to-b from-[#1a2a1a]/30 via-transparent to-transparent pointer-events-none"></div>
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[#d8b86c]/[0.04] rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-[#d8b86c]/[0.025] rounded-full blur-3xl pointer-events-none"></div>

    <!-- 创建世界没有可填的内容：只剩返回与创建两个动作 -->
    <div class="relative z-10 flex-1 flex items-center justify-center px-8 py-6" data-creation-page>
      <div class="w-full max-w-3xl flex items-center justify-between">
        <button
          class="px-5 py-3 text-base text-gray-400 hover:text-white hover:bg-[#222] rounded-lg transition-colors inline-flex items-center gap-1"
          @click="goHome"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          返回主页
        </button>

        <button
          :disabled="creating || !archiveReady"
          class="px-14 py-3 bg-[#d8b86c] hover:bg-[#95b86c] disabled:bg-gray-700 disabled:cursor-not-allowed
                 rounded-lg font-bold text-base transition-all shadow-lg
                 inline-flex items-center gap-2"
          @click="handleCreate"
        >
          <svg v-if="!creating" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M3 12h18"/><path d="M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>
          <svg v-else class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ creating ? '创造中…' : (archiveReady ? '创造世界' : '存档服务正在初始化…') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { editorApi } from '@/api/editorApi.js';
import { worldModeState } from '@/services/worldModeService.js';
import { projectLauncherService, isProjectOpenSuperseded, cancelPendingProjectOpen } from '@/services/projectLauncherService.js';
import { notifyWorldError } from '@/services/worldSessionLifecycle.js';
import { translateUiText } from '@/i18n/domTranslator.js';
import { createViewLifetime } from '@/utils/viewLifetime.js';

const router = useRouter();

const creating = ref(false);
const archiveReady = ref(false);
let archiveStatusTimer = null;
const viewLifetime = createViewLifetime();
let activationDelayTimer = null;
let finishActivationDelay = null;

const refreshArchiveReady = async () => {
  if (!viewLifetime.current()) return;
  try {
    const status = await editorApi.project.get_project_load_status();
    if (!viewLifetime.current()) return;
    archiveReady.value = status?.archive_service_ready === true;
    // The flag is one-way in practice: once Python registered its dispatcher it cannot go back
    // while this page exists, so keep polling only while it is still false.
    if (archiveReady.value) stopArchivePolling();
  } catch {
    if (viewLifetime.current()) archiveReady.value = false;
  }
};

const stopArchivePolling = () => {
  if (archiveStatusTimer !== null) {
    window.clearInterval(archiveStatusTimer);
    archiveStatusTimer = null;
  }
};

onMounted(() => {
  void refreshArchiveReady();
  archiveStatusTimer = window.setInterval(refreshArchiveReady, 500);
});

onUnmounted(() => {
  void viewLifetime.dispose();
  if (archiveStatusTimer !== null) {
    window.clearInterval(archiveStatusTimer);
  }
  if (activationDelayTimer !== null) window.clearTimeout(activationDelayTimer);
  finishActivationDelay?.();
});

const goHome = () => {
  cancelPendingProjectOpen();
  router.push('/StartScreen');
};

const normalizeProjectPath = (value) => String(value || '')
  .trim()
  .replace(/\\/g, '/')
  .replace(/\/+$/, '')
  .toLocaleLowerCase('en-US');

const activeProjectPathFrom = (response) => String(response?.project_path || '');

const waitForPythonProjectActivation = async (expectedPath, current, timeoutMs = 7000) => {
  const expected = normalizeProjectPath(expectedPath);
  const deadline = Date.now() + timeoutMs;
  while (current() && Date.now() < deadline) {
    try {
      const response = await editorApi.projectSettings.getActiveProjectInfo();
      if (!current()) return false;
      if (normalizeProjectPath(activeProjectPathFrom(response)) === expected) return true;
    } catch (_) {}
    if (!current()) return false;
    await new Promise((resolve) => {
      finishActivationDelay = () => {
        activationDelayTimer = null;
        finishActivationDelay = null;
        resolve();
      };
      activationDelayTimer = window.setTimeout(finishActivationDelay, 200);
    });
  }
  return false;
};

const handleCreate = async () => {
  if (!viewLifetime.current() || creating.value || !archiveReady.value) return;

  creating.value = true;
  try {
    // 后端自动命名 + 存到引擎 data 目录，返回 { name, path }。世界设定已经去掉，
    // 所以这里不再有描述可传：服务端用默认命名建一个空世界。
    const info = await editorApi.project.create_world_project({});
    if (!viewLifetime.current()) return;

    if (info && info.path) {
      const opened = await projectLauncherService.open_project(info.path, { newProject: true });
      if (!viewLifetime.current() || isProjectOpenSuperseded(opened)) return;
      const openResult = opened;
      if (openResult?.status === 'service_initializing') {
        alert('存档服务正在初始化，请稍后重试');
        return;
      }
      if (openResult?.ok) {
        const revision = worldModeState.revision;
        const current = () => viewLifetime.current() && worldModeState.status === 'ready' && worldModeState.revision === revision;
        // Enter the editor only once Python confirms that the new world is the active project;
        // otherwise the editor would open the previous world for a moment.
        const projectReady = await waitForPythonProjectActivation(info.path, current);
        if (!current()) return;
        if (!projectReady) {
          console.warn('Python project activation is still pending; the editor will wait for the world on its own.');
        }
        router.push('/');
        return;
      }
    }
    alert(translateUiText('创建失败'));
  } catch (error) {
    if (!viewLifetime.current()) return;
    console.error('创造世界失败:', error);
    await router.replace('/StartScreen');
    notifyWorldError(error, '创建失败');
  } finally {
    if (viewLifetime.current()) creating.value = false;
  }
};
</script>

<style scoped>
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #d8b86c;
}
</style>
