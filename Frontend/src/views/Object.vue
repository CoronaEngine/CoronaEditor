<template>
  <div class=" border-2 border-[#84a65b] rounded-md relative">
  <div class="titlebar flex items-center w-full p-2 justify-between bg-[#84A65B] cursor-move select-none"
    @mousedown="startDrag" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag" @dblclick="handleDoubleClick">
    <div class="text-white font-medium w-auto whitespace-nowrap">角色</div>
    <!-- 按钮组 -->
    <div class="flex w-full space-x-2 justify-end">
      <button @click.stop="closeFloat"
        class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
        ×
      </button>
    </div>
  </div>
  <div class="w-full bg-[#a8a4a3]/65 flex flex-col" style="height: calc(100vh - 56px);">
    <!-- 角色输入框 -->
    <div class="flex items-center space-x-2 mb-4">
      <label class="text-gray-600">角色</label>
      <input type="text" placeholder="角色路径"
        class="flex-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400" v-model="character" />
    </div>

    <!-- 坐标调整 -->
    <div class="flex items-center justify-between space-x-4 mb-4">
      <label class="text-write whitespace-nowrap">坐标：</label>
      <label class="text-write">x</label>
      <input type="number" step="0.1" @change="updatePosition" @input="e => px = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="px" />
      <label class="text-write">y</label>
      <input type="number" step="0.1" @change="updatePosition" @input="e => py = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="py" />
      <label class="text-write">z</label>
      <input type="number" step="0.1" @change="updatePosition" @input="e => pz = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="pz" />
    </div>

    <div class="flex items-center justify-between space-x-4 mb-4">
      <label class="text-write whitespace-nowrap">旋转：</label>
      <label class="text-write">x</label>
      <input type="number" step="0.1" @change="updateRotation" @input="e => rx = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="rx" />
      <label class="text-write">y</label>
      <input type="number" step="0.1" @change="updateRotation" @input="e => ry = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="ry" />
      <label class="text-write">z</label>
      <input type="number" step="0.1" @change="updateRotation" @input="e => rz = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="rz" />
    </div>

    <div class="flex items-center justify-between space-x-4 mb-4">
      <label class="text-write whitespace-nowrap">缩放：</label>
      <label class="text-write">x</label>
      <input type="number" step="0.1" @change="updateScale" @input="e => sx = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="sx" />
      <label class="text-write">y</label>
      <input type="number" step="0.1" @change="updateScale" @input="e => sy = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="sy" />
      <label class="text-write">z</label>
      <input type="number" step="0.1" @change="updateScale" @input="e => sz = e.target.value"
        class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
        :value="sz" />
    </div>
    <div class="flex-1 overflow-y-auto">
      <div id="blockdiv" class="blockly-container"></div>
    </div>
  </div>
    <!-- 四周拖动边框 -->
    <div class="absolute top-0 left-0 w-full h-2 cursor-n-resize z-40" @mousedown="(e) => startResize(e, 'n')"></div>
    <div class="absolute bottom-0 left-0 w-full h-2 cursor-s-resize z-40" @mousedown="(e) => startResize(e, 's')"></div>
    <div class="absolute top-0 left-0 h-full w-2 cursor-w-resize z-40" @mousedown="(e) => startResize(e, 'w')"></div>
    <div class="absolute top-0 right-0 h-full w-2 cursor-e-resize z-40" @mousedown="(e) => startResize(e, 'e')"></div>
    <div class="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-40" @mousedown="(e) => startResize(e, 'nw')"></div>
    <div class="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-40" @mousedown="(e) => startResize(e, 'ne')"></div>
    <div class="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-40" @mousedown="(e) => startResize(e, 'sw')"></div>
    <div class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-40" @mousedown="(e) => startResize(e, 'se')"></div>
</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import * as Blockly from 'blockly/core';
import * as CN from 'blockly/msg/zh-hans';
import { pythonGenerator } from 'blockly/python';
import { useDragResize } from '@/composables/useDragResize';

const { dragState,startDrag,startResize,stopDrag,onDrag,stopResize,onResize, handleDoubleClick} = useDragResize();
const workspace = ref(null);
const character = ref('');
const px=ref('0.0'), py=ref('0.0'), pz=ref('0.0');
const rx=ref('0.0'), ry=ref('0.0'), rz=ref('0.0');
const sx=ref('1.0'), sy=ref('1.0'), sz=ref('1.0');

const route = useRoute();
const scenename = ref(null);
const actorname = ref(null);
const routename = ref(null);
const flash = ref(null);

import { defineEngineBlocks } from '@/blockly/blocks/engine.js';
import { defineAppearanceBlocks } from '@/blockly/blocks/appearance.js';
import { defineEventBlocks } from '@/blockly/blocks/event.js';
import { defineControlBlocks } from '@/blockly/blocks/control.js';
import { defineDetectBlocks } from '@/blockly/blocks/detect.js';
import { defineMathBlocks } from '@/blockly/blocks/math.js';
import { defineVariableBlocks } from '@/blockly/blocks/variable.js';
import { defineListBlocks } from '@/blockly/blocks/list.js';

import { defineEngineGenerators } from '@/blockly/generators/engine.js';
import { defineAppearanceGenerators } from '@/blockly/generators/appearance.js';
import { defineEventGenerators } from '@/blockly/generators/event.js';
import { defineControlGenerators } from '@/blockly/generators/control.js';
import { defineDetectGenerators } from '@/blockly/generators/detect.js';
import { defineMathGenerators } from '@/blockly/generators/math.js';
import { defineVariableGenerators } from '@/blockly/generators/variable.js';
import { defineListGenerators } from '@/blockly/generators/list.js';

import { BLOCK_CATEGORY_MAP } from '@/blockly/configs/categoryMap.js';
import { WORKSPACE_CONFIG } from '@/blockly/configs/workspaceConfig.js';

// 定义响应式的广播列表，初始为空
const broadcastList = ref([]);
// 新建广播的函数
const createNewBroadcast = () => {
  const newBroadcastName = prompt('请输入新广播的名称：');
  if (newBroadcastName && newBroadcastName.trim() !== '') {
    broadcastList.value.push(newBroadcastName.trim());
  }
};

const initBlocklyAndGenerators = () => {

  defineEngineBlocks(actorname);
  defineAppearanceBlocks(actorname);
  defineEventBlocks(actorname, flash, broadcastList, createNewBroadcast);
  defineControlBlocks(actorname);
  defineDetectBlocks(actorname);
  defineMathBlocks();
  defineVariableBlocks();
  defineListBlocks(actorname);

  defineEngineGenerators();
  defineAppearanceGenerators();
  defineEventGenerators();
  defineControlGenerators();
  defineDetectGenerators();
  defineMathGenerators();
  defineVariableGenerators();
  defineListGenerators();

};

const saveWorkspaceToFile = async (workspaceData) => {
  try {
    if (!window.showSaveFilePicker) {
      console.error('File System Access API不可用');
      return false;
    }
    
    const jsonStr = JSON.stringify(workspaceData, null, 2);
    const options = {
      types: [{
        description: 'JSON文件',
        accept: {
          'application/json': ['.json']
        }
      }],
      suggestedName: `blockly_workspace_${Date.now()}.json`
    };
    
    const handle = await window.showSaveFilePicker(options);
    const writable = await handle.createWritable();

    await writable.write(jsonStr);
    await writable.close();
    
    return true;
  } catch (e) {
    console.error('保存文件失败:', e);
    return false;
  }
};

const loadWorkspaceFromFile = async () => {
  try {
    if (!window.showOpenFilePicker) {
      console.error('File System Access API不可用');
      return false;
    }
    
    const [fileHandle] = await window.showOpenFilePicker({
      types: [{
        description: 'JSON文件',
        accept: {
          'application/json': ['.json']
        }
      }]
    });
    
    const file = await fileHandle.getFile();
    const content = await file.text();
    
    if (!content || content.trim() === '') {
      console.error('文件内容为空');
      return false;
    }
    
    const workspaceData = JSON.parse(content);
    
    if (!workspaceData || 
        typeof workspaceData !== 'object' ||
        !workspaceData.blocks || 
        typeof workspaceData.blocks !== 'object') {
      console.error('无效的工作区数据格式');
      return false;
    }
    
    // 清空当前工作区
    workspace.value.clear();
    
    Blockly.serialization.workspaces.load(workspaceData, workspace.value);
    console.log('工作区已从文件载入');
    return true;
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('载入工作区失败:', e);
    }
    return false;
  }
};


// 初始化 Blockly
const initBlockly = () => {
  const blocklyDiv = document.getElementById('blockdiv');
  if (!blocklyDiv) {
    console.error('Blockly 容器未找到');
    return;
  }

  // 设置语言
  Blockly.setLocale(CN);
  initBlocklyAndGenerators();

  // 创建工作区
  workspace.value = Blockly.inject(blocklyDiv, WORKSPACE_CONFIG);

  Blockly.ContextMenuRegistry.registry.register({
    displayText: '保存工作区',
    preconditionFn: (scope) => {
      return workspace.value && workspace.value.getAllBlocks(false).length > 0 ? 'enabled' : 'disabled';
    },
    callback: async () => {
      const workspaceData = Blockly.serialization.workspaces.save(workspace.value);
      const success = await saveWorkspaceToFile(workspaceData);
      if (success) {
        console.log('工作区已保存到文件');
      }
    },
    scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: 'saveWorkspace',
    weight: 1
  });
  Blockly.ContextMenuRegistry.registry.register({
    displayText: '载入工作区',
    preconditionFn: () => 'enabled',
    callback: async () => {
      await loadWorkspaceFromFile();
    },
    scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: 'loadWorkspace', 
    weight: 2
  });
  Blockly.ContextMenuRegistry.registry.register({
    displayText: '运行',
    preconditionFn: (scope) => {
      return workspace.value && workspace.value.getAllBlocks(false).length > 0 ? 'enabled' : 'disabled';
    },
    callback: async () => {
        const code = pythonGenerator.workspaceToCode(workspace.value);
        if (window.pyBridge) {
            window.pyBridge.executePythonCode(code,actorname.value);
        }
    },
    scopeType: Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: 'executePythonCode',
    weight: 3
  });
  // 配置工具箱样式
  const toolbox = blocklyDiv.querySelector('.blocklyToolboxDiv');
  if (toolbox) {
    toolbox.style.overflow = 'hidden';
  }
  const toolboxDiv = document.querySelector('.blocklyToolboxDiv');
  if (toolboxDiv) {
    toolboxDiv.style.overflow = 'hidden';
  }

  // 添加块创建事件监听器
  setupBlockListener();

  workspace.value.addChangeListener((event) => {
    if (event.type === Blockly.Events.TOOLBOX_ITEM_SELECT) {
      console.log('选中分类:', event.itemName);
    }
  });
};

const setupBlockListener = () => {
  if (!workspace.value) return;

  workspace.value.addChangeListener((event) => {
    if (event.type === Blockly.Events.BLOCK_CREATE) {
      handleBlockCreate(event);
    }
  });
};

// 处理块创建事件
const handleBlockCreate = (event) => {
  const block = workspace.value.getBlockById(event.blockId);
  if (!block) return;

  const blockType = block.type;
  const categoryName = BLOCK_CATEGORY_MAP[blockType];

  if (categoryName) {
    const toolbox = workspace.value.getToolbox();
    if (toolbox) {
      const categories = toolbox.getToolboxItems();
      const targetCategory = categories.find(cat => cat.name === categoryName);
      if (targetCategory) {
        toolbox.setSelectedItem(targetCategory);
      }
    }
  }
};

const updatePosition = () => {
  if (window.pyBridge) {
    window.pyBridge.actorOperation(JSON.stringify({
      Operation: "Move",
      sceneName: scenename.value,
      x: parseFloat(px.value),
      y: parseFloat(py.value),
      z: parseFloat(pz.value),
      actorName: actorname.value
    }));
    console.error('updatePosition', actorname.value, px.value, py.value, pz.value); // 调试用，确保值正确传递到 Python 端
  } 
}

const updateRotation = () => {
  if (window.pyBridge) {
    window.pyBridge.actorOperation(JSON.stringify({
      Operation: "Rotate",
      sceneName: scenename.value,
      x: parseFloat(rx.value),
      y: parseFloat(ry.value),
      z: parseFloat(rz.value),
      actorName: actorname.value
    }));
    console.error('updateRotation', rx.value, ry.value, rz.value); // 调试用，确保值正确传递到 Python 端
  }
}

const updateScale = () => {
  if (window.pyBridge) {
    window.pyBridge.actorOperation(JSON.stringify({
      Operation: "Scale",
      sceneName: scenename.value,
      x: parseFloat(sx.value),
      y: parseFloat(sy.value),
      z: parseFloat(sz.value),
      actorName: actorname.value
    }));
    console.error('updateScale', sx.value, sy.value, sz.value); // 调试用，确保值正确传递到 Python 端
  } 
}

//关闭浮动窗口
const closeFloat = () => {
  if (window.pyBridge) {
    window.pyBridge.removeDockWidget(routename.value);
  }
};

const handleResizeMove = (e) => {
  if (dragState.value.isResizing) onResize(e);
};

const handleResizeUp = () => {
  if (dragState.value.isResizing) stopResize();
};

const handleKeyDown = (event) => {
  event.preventDefault();
  switch(event.key.toLowerCase()) {
    case 'escape':
      openSetup();
      break;
  }
};
// 调用Esc
const openSetup = () => {
  if (window.pyBridge) {
    window.pyBridge.addDockWidget("SetUp", "/SetUp", "float", "center");
  }
}

onMounted(() => {
  scenename.value = route.query.sceneName;
  actorname.value = route.query.objectName;
  character.value = decodeURIComponent(route.query.path);
  routename.value = route.query.routename;
  initBlockly();
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeUp);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  document.addEventListener('keydown', handleKeyDown);
});

// 组件卸载时清理
onUnmounted(() => {
  // 这里假设 closeWorkspace 是一个自定义函数，需要根据实际情况实现
  // closeWorkspace();
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeUp);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.blockly-container {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #fff;
}
#blockdiv :deep(.blocklyZoom) {
  display: flex !important;
  opacity: 1 !important;
}
#blockdiv :deep(.blocklyTrash) {
  opacity: 1 !important;
}
svg {
  display: inline !important;
}
svg[display="none"] {
  display: none !important;
}
</style>