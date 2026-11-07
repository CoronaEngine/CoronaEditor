<template>
  <div
    class="flex-1 min-h-0 w-full rounded-lg overflow-hidden relative bg-[#1b241d]/90 flex flex-col text-white font-sans"
  >

    <div class="flex items-center gap-2 p-2 bg-[#18221a]/50 border-b border-[#2b362d]">
      <div class="text-[10px] text-gray-400 truncate flex-1">
        <span class="text-[#b3995d] font-bold">{{ projectName }}</span>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar p-2" @contextmenu.prevent="handleContextMenu($event, null)">
      <div v-if="errorMsg" class="text-red-400 text-xs p-2">{{ errorMsg }}</div>
      <FileTreeNode
        v-if="fileTree.children"
        :nodes="fileTree.children"
        :level="0"
        @node-click="handleNodeClick"
        @node-dblclick="handleNodeDblClick"
        @contextmenu="handleContextMenu"
        @refresh="loadFileTree"
      />

      <div v-else-if="loading" class="flex justify-center items-center h-32">
        <div class="text-[#b3995d]">加载中...</div>
      </div>

      <div
        v-else
        class="h-full flex flex-col items-center justify-center text-gray-500 italic text-xs"
      >
        <div class="text-3xl mb-2">🍃</div>
        <p>暂无文件或未打开项目</p>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.show"
      data-file-context-menu
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      class="fixed z-[100] bg-[#121a14] border border-[#3a4a3c] shadow-xl py-1 min-w-[150px] text-xs"
    >
      <!-- 文件夹特有菜单 -->
      <template v-if="contextMenu.item?.isDirectory">
        <div class="px-4 py-2 hover:bg-[#b3995d] cursor-pointer" @click="handleNewFolder">
          新建文件夹
        </div>
        <div class="px-4 py-2 hover:bg-[#b3995d] cursor-pointer" @click="handleNewActor">
          新建单位
        </div>
        <div class="h-[1px] bg-[#2b362d] my-1"></div>
        <div v-if="contextMenu.item?.name !== 'scene.ini'" class="px-4 py-2 hover:bg-[#b3995d] cursor-pointer" @click="handleRename">重命名</div>
        <div
          v-if="contextMenu.item?.name !== 'scene.ini'"
          class="px-4 py-2 hover:bg-red-600 cursor-pointer text-red-400 hover:text-white"
          @click="handleDelete"
        >
          删除
        </div>
      </template>

      <!-- 文件特有菜单 -->
      <template v-else-if="contextMenu.item">
        <div class="px-4 py-2 hover:bg-[#b3995d] cursor-pointer" @click="handleOpenFile()">打开</div>
        <div class="h-[1px] bg-[#2b362d] my-1"></div>
        <div v-if="contextMenu.item?.name !== 'scene.ini'" class="px-4 py-2 hover:bg-[#b3995d] cursor-pointer" @click="handleRename">重命名</div>
        <div
          v-if="contextMenu.item?.name !== 'scene.ini'"
          class="px-4 py-2 hover:bg-red-600 cursor-pointer text-red-400 hover:text-white"
          @click="handleDelete"
        >
          删除
        </div>
      </template>

      <!-- 空白区域菜单 -->
      <template v-else>
        <div class="px-4 py-2 hover:bg-[#b3995d] cursor-pointer" @click="handleNewFolder">
          新建文件夹
        </div>
        <div class="px-4 py-2 hover:bg-[#b3995d] cursor-pointer" @click="handleNewActor">
          新建单位
        </div>
      </template>
    </div>

    <!-- 新建/重命名对话框 -->
    <div
      v-if="dialog.show"
      data-file-dialog
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
    >
      <div class="bg-[#121a14] border border-[#3a4a3c] p-4 rounded w-80">
        <div class="text-[#b3995d] font-bold mb-3">{{ dialog.title }}</div>
        <div v-if="errorMsg" class="text-red-400 text-xs mb-2">{{ errorMsg }}</div>
        <input
          v-model="dialog.value"
          type="text"
          class="w-full bg-[#2b362d] border border-[#555] px-3 py-2 text-sm text-white rounded outline-none focus:border-[#b3995d]"
          :placeholder="dialog.placeholder"
          @keyup.enter="handleDialogConfirm"
        />
        <div class="flex justify-end gap-2 mt-4">
          <button
            class="px-3 py-1 text-sm bg-[#2b362d] hover:bg-[#3a4a3c] rounded"
            @click="dialog.show = false"
          >
            取消
          </button>
          <button
            class="px-3 py-1 text-sm bg-[#b3995d] hover:bg-[#6b8a4a] rounded"
            :disabled="busy"
            @click="handleDialogConfirm"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { editorApi } from '@/api/editorApi.js';
import FileTreeNode from '@/components/ui/FileTreeNode.vue';
import { translateUiText } from '@/i18n/domTranslator.js';
import { createViewLifetime } from '@/utils/viewLifetime.js';
import { worldModeState } from '@/services/worldModeService.js';

const projectRevision = worldModeState.revision;
const lifetime = createViewLifetime(() => projectRevision === worldModeState.revision);
const projectName = ref('Corona Project');
const fileTree = ref({ children: [] });
const loading = ref(false);
const busy = ref(false);
const errorMsg = ref('');
const contextMenu = ref({ show: false, x: 0, y: 0, item: null });
const dialog = ref({ show: false, title: '', placeholder: '', value: '', type: '', targetPath: '' });
let scope = null;
let readSequence = 0;
let menuSequence = 0;
const owns = captured => lifetime.current() && captured?.archive_session === scope?.archive_session
  && captured?.project_path === scope?.project_path;

const loadFileTree = async () => {
  if (!scope || !lifetime.current()) return;
  const captured = scope;
  const sequence = ++readSequence;
  const current = () => owns(captured) && sequence === readSequence;
  loading.value = true;
  errorMsg.value = '';
  try {
    const tree = await editorApi.files.getFileTree({ ...captured, path: '' });
    if (!current()) return;
    if (tree.archive_session !== captured.archive_session) throw new Error('项目会话已失效');
    fileTree.value = tree;
  } catch (error) {
    if (current()) errorMsg.value = String(error);
  } finally {
    if (current()) loading.value = false;
  }
};

const init = async () => {
  try {
    const info = await editorApi.projectSettings.getActiveProjectInfo();
    if (!lifetime.current()) return;
    if (!info.archive_session || !info.project_path || info.read_only) return;
    scope = { archive_session: info.archive_session, project_path: info.project_path };
    projectName.value = info.name;
    await loadFileTree();
  } catch (error) {
    if (lifetime.current()) errorMsg.value = String(error);
  }
};

const handleNodeClick = node => {
  if (lifetime.current() && node.isDirectory) node.expanded = !node.expanded;
};
const closeContextMenu = () => {
  menuSequence++;
  contextMenu.value.show = false;
};
const handleContextMenu = (event, item) => {
  event.preventDefault();
  event.stopPropagation();
  if (!scope || !lifetime.current()) return;
  closeContextMenu();
  const sequence = menuSequence, captured = scope;
  nextTick(() => {
    if (sequence !== menuSequence || !owns(captured)) return;
    contextMenu.value = { show: true, x: event.clientX, y: event.clientY, item: item || null, scope: captured };
  });
};
const openDialog = (type, title, placeholder) => {
  const menu = contextMenu.value;
  if (!owns(menu.scope) || (type === 'rename' && !menu.item)) return;
  errorMsg.value = '';
  dialog.value = { show: true, type, title, placeholder, scope: menu.scope,
    value: type === 'rename' ? menu.item.name : '', targetPath: menu.item?.path || '' };
  closeContextMenu();
};
const handleNewFolder = () => openDialog('newFolder', '新建文件夹', '输入文件夹名称');
const handleNewActor = () => openDialog('newActor', '新建单位', '输入单位名称 (.actor)');
const handleRename = () => openDialog('rename', '重命名', '输入新名称');

const handleOpenFile = async (node = contextMenu.value.item, captured = contextMenu.value.scope) => {
  closeContextMenu();
  if (!node || node.isDirectory || !owns(captured)) return;
  const file_type = node.name === 'scene.ini' ? 'scene' : node.name.endsWith('.actor') ? 'actor' : '';
  if (!file_type) return;
  try {
    await editorApi.files.openFile({ ...captured, path: node.path, file_type });
  } catch (error) {
    if (owns(captured)) errorMsg.value = String(error);
  }
};
const handleNodeDblClick = node => handleOpenFile(node, scope);

const handleDelete = async () => {
  const menu = contextMenu.value, captured = menu.scope, item = menu.item;
  closeContextMenu();
  if (!item || !owns(captured) || busy.value ||
      !confirm(translateUiText(`确定要删除 "${item.name}" 吗？`))) return;
  busy.value = true;
  try {
    await editorApi.files.deleteItem({ ...captured, path: item.path });
    if (owns(captured)) await loadFileTree();
  } catch (error) {
    if (owns(captured)) errorMsg.value = String(error);
  } finally {
    if (owns(captured)) busy.value = false;
  }
};

const handleDialogConfirm = async () => {
  const active = dialog.value, captured = active.scope;
  if (!active.show || !owns(captured) || busy.value) return;
  const name = active.value.trim();
  if (!name) { errorMsg.value = translateUiText('名称不能为空'); return; }
  const method = { newFolder: 'createFolder', newActor: 'createActorTemplate', rename: 'renameItem' }[active.type];
  if (!method) return;
  const current = () => owns(captured) && dialog.value === active;
  busy.value = true;
  errorMsg.value = '';
  try {
    await editorApi.files[method]({ ...captured, path: active.targetPath, name });
    if (!current()) return;
    active.show = false;
    await loadFileTree();
  } catch (error) {
    if (current()) errorMsg.value = String(error);
  } finally {
    if (owns(captured)) busy.value = false;
  }
};

onMounted(() => {
  window.addEventListener('click', closeContextMenu);
  return init();
});
onUnmounted(() => {
  closeContextMenu();
  void lifetime.dispose();
  window.removeEventListener('click', closeContextMenu);
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #3a4a3c;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #b3995d;
}
</style>
