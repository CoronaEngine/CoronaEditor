<template>
  <div
    class="relative h-screen border-2 border-[#d8b86c] bg-[#282828]/95 text-white overflow-hidden flex flex-col font-sans"
  >
    <div class="flex-1 min-h-0 p-20 bg-[#1e1e1e] flex flex-col">
      <div class="shrink-0 mb-6">
        <h3 class="text-base font-semibold text-gray-400 uppercase tracking-wider">
          最近项目
        </h3>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto pr-1">
        <div v-if="recentProjects.length > 0" class="space-y-3">
          <div
            v-for="proj in recentProjects"
            :key="proj.path"
            class="p-5 rounded bg-[#2d2d2d] transition-colors group flex items-center gap-6"
            :class="[
              proj.if_exists
                ? 'cursor-pointer hover:bg-[#3d3d3d]'
                : 'cursor-not-allowed opacity-60',
              selectedProject === proj.path
                ? 'border border-[#d8b86c]'
                : 'border border-transparent',
            ]"
            @click="proj.if_exists && (selectedProject = proj.path)"
            @dblclick="proj.if_exists && handleOpenProject(proj.path, proj)"
          >
            <div class="min-w-0 flex-1">
              <div class="text-base font-medium truncate flex items-center gap-2">
                <span v-if="proj.if_exists">{{ proj.name }}</span>
                <span v-else class="text-red-500">{{ proj.name }} (路径异常)</span>
                <span
                  v-if="proj.if_exists"
                  class="shrink-0 text-[10px] px-2 py-0.5 rounded border"
                  :class="proj.legacy
                    ? 'text-amber-300 border-amber-500/50 bg-amber-500/10'
                    : 'text-emerald-300 border-emerald-500/50 bg-emerald-500/10'"
                >
                  {{ proj.legacy ? '旧格式' : '便携场景' }}
                </span>
              </div>
              <div class="text-xs text-gray-500 truncate mt-1">{{ proj.path }}</div>
            </div>
            <div class="shrink-0 min-w-40 text-right">
              <div class="text-[11px] text-gray-600 uppercase tracking-wider">上次编辑</div>
              <div class="text-sm text-gray-400 font-mono mt-1">{{ proj.last_edited || '-' }}</div>
            </div>
          </div>
        </div>
        <div
          v-else
          class="text-sm text-gray-600 italic p-6 text-center border border-dashed border-[#333] rounded"
        >
          暂无最近记录
        </div>
      </div>

      <div class="mt-6 pt-6 border-t border-[#333] flex items-center gap-3 shrink-0">
        <button
          :disabled="!archiveReady"
          class="flex-1 py-3 px-6 text-left text-base hover:bg-[#333] rounded flex items-center gap-3"
          @click="handleImport"
        >
          <span class="text-xl">📁</span>
          {{ archiveReady ? '打开现有项目...' : '存档服务正在初始化…' }}
        </button>
        <button
          class="py-3 px-10 text-base rounded flex items-center justify-center gap-2 transition-colors shrink-0"
          :class="selectedProject && archiveReady ? 'bg-[#d8b86c] text-white hover:bg-[#9bc46d]' : 'bg-[#333] text-gray-500 cursor-not-allowed'"
          :disabled="!selectedProject || !archiveReady"
          @click="openSelectedProject"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          开始
        </button>
      </div>

      <div class="mt-6 shrink-0">
        <button
          class="px-5 py-3 text-base text-gray-400 hover:text-white hover:bg-[#333] rounded transition-colors inline-flex items-center gap-1 w-fit"
          @click="goBack"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          返回
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { notifyWorldError } from '@/services/worldSessionLifecycle.js';
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { editorApi } from '@/api/editorApi.js';
import { projectLauncherService, isProjectOpenSuperseded } from '@/services/projectLauncherService.js';

const router = useRouter();

const appVersion = ref('V1.0.0');
const recentProjects = ref([]);
const selectedProject = ref(null);
const archiveReady = ref(false);
let archiveStatusTimer = null;

const goBack = () => {
  router.push('/StartScreen');
};

onMounted(async () => {
  try {
    const version = await editorApi.project.getAppVersion();
    if (version) appVersion.value = version.data;

    const saved = await editorApi.project.getRecentProjects();
    if (saved) recentProjects.value = saved.data;

    const refreshArchiveReady = async () => {
      const response = await editorApi.project.getProjectLoadStatus();
      const status = unwrapResponse(response);
      archiveReady.value = status?.archive_service_ready === true;
    };
    await refreshArchiveReady();
    archiveStatusTimer = window.setInterval(refreshArchiveReady, 250);
  } catch (error) {
    console.error('RecentGames 初始化失败:', error);
  }
});

const unwrapResponse = (response) => response?.data ?? response;

onUnmounted(() => {
  if (archiveStatusTimer !== null) {
    window.clearInterval(archiveStatusTimer);
  }
});


const archiveDiagnostics = (result) => (result?.diagnostics || [])
  .map((item) => {
    const actor = item.actor_name || item.actor_guid || item.shape_type || '场景';
    const path = item.resource_path || item.path || '';
    const count = item.count > 1 ? `（${item.count} 项）` : '';
    return `${actor}${count}: ${path}${path ? ' — ' : ''}${item.message || item.code || '加载失败'}`;
  })
  .join('\n');

const openSelectedProject = () => {
  const project = recentProjects.value.find((item) => item.path === selectedProject.value);
  if (project) handleOpenProject(project.path, project);
};


const handleOpenProject = async (path, project = null) => {
  try {
    let result = await projectLauncherService.openProject(path);
    if (isProjectOpenSuperseded(result)) return;
    let opened = unwrapResponse(result);
    if (opened?.status === 'decision_required') {
      const details = archiveDiagnostics(opened);
      const proceed = window.confirm(
        `场景中有部分资源无法加载：\n\n${details}\n\n是否继续打开可用几何？缺失资源保留占位，不支持的形状将跳过。`,
      );
      if (!proceed) return;
      result = await projectLauncherService.openProject(path, { loadPolicy: 'degraded' });
      if (isProjectOpenSuperseded(result)) return;
      opened = unwrapResponse(result);
    }
    if (opened?.status === 'invalid_archive') {
      window.alert(`无法打开存档：\n${archiveDiagnostics(opened)}`);
      return;
    }
    if (opened?.status === 'service_initializing') {
      window.alert('存档服务正在初始化，请稍后重试');
      return;
    }
    if (opened?.status === 'archive_service_error') {
      window.alert(`存档服务错误：${opened.message || '无法解析存档'}`);
      return;
    }
    if (opened?.ok) {
      router.push('/');
    }
  } catch (error) {
    console.error('打开项目失败:', error);
    await router.replace('/StartScreen');
    notifyWorldError(error);
  }
};

const handleImport = async () => {
  try {
    const result = await editorApi.project.openProjectFile();
    if (result?.data?.path) {
      let path = result.data.path;
      if (path.toLowerCase().endsWith('.json')) {
        const imported = unwrapResponse(await projectLauncherService.importVisionScene(path));
        if (!imported?.ok || !imported.path) throw new Error(imported?.message || 'Vision 导入失败');
        path = imported.path;
      }
      await handleOpenProject(path);
    }
  } catch (error) {
    console.error('打开现有项目失败:', error);
    notifyWorldError(error);
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
