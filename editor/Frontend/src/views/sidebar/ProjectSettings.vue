<template>
  <div
    class="flex-1 min-h-0 w-full rounded-lg overflow-hidden relative bg-[#1b241d]/90 flex flex-col text-white font-sans"
  >

    <div v-if="loading" class="flex-1 flex items-center justify-center text-[#b3995d] text-sm">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="errorMsg" class="flex-1 flex items-center justify-center text-red-400 text-sm">
      {{ errorMsg }}
    </div>

    <div v-else class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 text-xs">
      <!-- 项目名称 -->
      <div class="flex flex-col gap-1">
        <label class="text-gray-400">{{ t('projectSettings.projectName') }}</label>
        <input
          v-model="form.name"
          type="text"
          class="bg-[#18221a] border border-[#2b362d] rounded px-2 py-1.5 text-white focus:border-[#b3995d] outline-none"
          :placeholder="t('projectSettings.projectName')"
        />
      </div>

      <!-- 核心版本 -->
      <div class="flex flex-col gap-1">
        <label class="text-gray-400">{{ t('projectSettings.coreVersion') }}</label>
        <input
          v-model="form.core_version"
          type="text"
          class="bg-[#18221a] border border-[#2b362d] rounded px-2 py-1.5 text-white focus:border-[#b3995d] outline-none"
          placeholder="1.0.0"
        />
      </div>

      <!-- 只读信息 -->
      <div class="grid grid-cols-2 gap-3 pt-2 border-t border-[#2b362d]">
        <div class="flex flex-col gap-1">
          <label class="text-gray-400">{{ t('projectSettings.createdAt') }}</label>
          <div class="text-gray-300 truncate">{{ form.create_time || '-' }}</div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-gray-400">{{ t('projectSettings.lastOpened') }}</label>
          <div class="text-gray-300 truncate">{{ form.last_opened || '-' }}</div>
        </div>
      </div>

      <!-- 提示信息 -->
      <div v-if="statusMsg" :class="['text-xs', statusOk ? 'text-[#b3995d]' : 'text-red-400']">
        {{ statusMsg }}
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div
      v-if="!loading && !errorMsg"
      class="flex justify-end gap-2 p-3 border-t border-[#2b362d] bg-[#18221a]/50"
    >
      <button
        class="px-4 py-1.5 bg-[#2b362d] hover:bg-[#3a4a3c] rounded text-xs text-white"
        :disabled="saving"
        @click="loadSettings"
      >
        {{ t('common.reset') }}
      </button>
      <button
        class="px-4 py-1.5 bg-[#b3995d] hover:bg-[#6f8d4b] rounded text-xs text-white disabled:opacity-50"
        :disabled="saving || form.read_only"
        @click="handleSave"
      >
        {{ saving ? t('common.saving') : t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { editorApi } from '@/api/editorApi.js';

import { createViewLifetime } from '@/utils/viewLifetime.js';
import { worldModeState } from '@/services/worldModeService.js';

const projectRevision = worldModeState.revision;
const lifetime = createViewLifetime(() => projectRevision === worldModeState.revision);
const { t } = useI18n();

const loading = ref(true);
const saving = ref(false);
const errorMsg = ref('');
const statusMsg = ref('');
const statusOk = ref(true);

const form = ref({
  name: '',
  core_version: '',
  create_time: '',
  last_opened: '',
});

let generation = 0;
let statusTimer;
const clearStatus = () => {
  clearTimeout(statusTimer);
  statusMsg.value = '';
};
const setStatus = (msg, ok = true) => {
  clearStatus();
  statusMsg.value = msg;
  statusOk.value = ok;
  if (msg) statusTimer = setTimeout(() => {
    if (lifetime.current()) statusMsg.value = '';
  }, 3000);
};

const loadSettings = async () => {
  if (!lifetime.current()) return;
  const current = ++generation;
  const owns = () => lifetime.current() && current === generation;
  loading.value = true;
  saving.value = false;
  errorMsg.value = '';
  clearStatus();
  try {
    const info = await editorApi.projectSettings.getActiveProjectInfo();
    if (!owns()) return;
    if (!info?.archive_session || !info.project_path) throw new Error(t('projectSettings.loadFailed'));
    form.value = { ...info };
  } catch (e) {
    if (owns()) errorMsg.value = String(e);
  } finally {
    if (owns()) loading.value = false;
  }
};

const handleSave = async () => {
  if (!lifetime.current() || saving.value || loading.value || errorMsg.value || form.value.read_only) return;
  const current = generation;
  const owns = () => lifetime.current() && current === generation;
  const payload = {
    archive_session: form.value.archive_session,
    project_path: form.value.project_path,
    name: form.value.name,
    core_version: form.value.core_version,
  };
  saving.value = true;
  try {
    await editorApi.project.saveActiveProjectInfo(payload);
    if (owns()) setStatus(t('projectSettings.saveSuccess'), true);
  } catch (e) {
    if (owns()) setStatus(String(e), false);
  } finally {
    if (owns()) saving.value = false;
  }
};

onUnmounted(() => { clearTimeout(statusTimer); void lifetime.dispose(); });
onMounted(loadSettings);
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #3a4a3c;
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #b3995d;
}
</style>
