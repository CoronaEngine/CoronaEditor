<template>
  <div class="border-2 border-[#84a65b] rounded-md relative">
    <!-- 标题栏 -->
    <div class="titlebar flex items-center w-full p-2 rounded-t-md justify-between bg-[#84A65B] cursor-move select-none"
      @mousedown="startDrag" @mousemove="onDrag" @mouseup="stopDrag" @mouseleave="stopDrag">
      <div class="text-white font-medium w-auto whitespace-nowrap">场景</div>
      <!-- 按钮组 -->
      <div class="flex w-full space-x-2 justify-end">
        <button @click.stop="closeFloat"
          class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
          ×
        </button>
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

    <!-- 主内容区域 -->
    <div class="p-4 shadow-md w-full bg-[#a8a4a3]/65 flex flex-col" style="height: calc(100vh - 56px);">
      <div class="relative mb-4">
        <button @click.stop="handleFileImport"
          class="mr-4 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
          导入模型
        </button>
        <button @click.stop="handleSceneImport"
          class="mr-4 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
          导入场景
        </button>
        <button @click.stop="saveScene"
          class="mr-4 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
          保存场景
        </button>
        <button @click.stop="DayNightCycle"
          class="mr-4 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors duration-200">
          昼夜变换
        </button>
      </div>
      <div class="flex items-center justify-between space-x-4 mb-4">
        <label class="text-write whitespace-nowrap">光照方向：</label>
        <label class="text-write">x</label>
        <input type="number" step="0.1" @change="updateSunPosition" @input="e => px = e.target.value"
          class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
          :value="px" />
        <label class="text-write">y</label>
        <input type="number" step="0.1" @change="updateSunPosition" @input="e => py = e.target.value"
          class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
          :value="py" />
        <label class="text-write">z</label>
        <input type="number" step="0.1" @change="updateSunPosition" @input="e => pz = e.target.value"
          class="w-20 p-1 text-center border rounded-md focus:outline-none focus:ring-2 text-write focus:ring-blue-400 bg-[#686868]/70"
          :value="pz" />
      </div>


      <div class="flex-1 overflow-y-auto">
        <!-- 场景列表-瀑布流布局 -->
        <div class="grid grid-cols-1 gap-4">
          <div v-for="scene in sceneImages" :key="scene.name" class="mb-4 break-inside-avoid">
            <div class="bg-[#E8E8E8]/80 rounded-lg shadow-sm overflow-hidden hover:bg-[#E8E8E8]/80 transition-all duration-200">
              <div class="p-3 flex justify-between items-center">
                <div class="flex flex-col w-full">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-900 truncate" :title="scene.name"
                      @dblclick="controlObject(scene)">
                      {{ scene.name }}
                    </span>
                    <button @click.stop="deleteActor(scene)" 
                      class="ml-2 w-4 h-4 flex items-center justify-center text-red-500 hover:text-red-700">
                      ×
                    </button>
                  </div>
                  <span class="text-xs text-gray-500 truncate" :title="scene.path">
                    {{ scene.type === 'obj' ? 'OBJ模型' : '其他类型' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDragResize } from '@/composables/useDragResize';

const { dragState,startDrag,startResize,stopDrag,onDrag,stopResize,onResize } = useDragResize();
const sceneImages = ref([]);
const route = useRoute();
const currentSceneName = ref('');
const px=ref('1.0'), py=ref('1.0'), pz=ref('1.0');


const controlObject = (scene) => {
  if (window.pyBridge) {
    const widgetName = `Object_${scene.name}`;
    window.pyBridge.addDockWidget(widgetName, `/Object?sceneName=${currentSceneName.value}&objectName=${scene.name}&path=${encodeURIComponent(scene.path)}&routename=${widgetName}`, "right");
  }
};

const updateSunPosition = () => {
  if (window.pyBridge) {
    window.pyBridge.sunDirection(JSON.stringify({
      sceneName: currentSceneName.value,
      px: parseFloat(px.value),
      py: parseFloat(py.value),
      pz: parseFloat(pz.value)
    }));
    console.error('updateSunDirection', px.value, py.value, pz.value); 
  } 
}

const saveScene = () => {
  if (window.pyBridge && window.pyBridge.sceneSave) {
    const sceneData = {
      actors: sceneImages.value.map(scene => ({
        name: scene.name,
        path: scene.path,
        type: scene.type
      }))
    };
    window.pyBridge.sceneSave(JSON.stringify(sceneData));
  }
};

const handleFileImport = () => {
  if (window.pyBridge && window.pyBridge.openFileDialog) {
    window.pyBridge.openFileDialog(currentSceneName.value, 'model');
  }
};

const handleSceneImport = () => {
  if (window.pyBridge && window.pyBridge.openFileDialog) {
    window.pyBridge.openFileDialog(currentSceneName.value, 'scene');
  }
};

const handleDockEvent = (event_type, event_data) => {
  if (event_type === 'actorCreated') {
    try {
      const data = JSON.parse(event_data);
      // 使用后端返回的数据创建场景项
      sceneImages.value.push({
        name: data.name,         // 使用返回的名称
        path: data.path,         // 使用返回的完整路径
        type: 'obj'
      });
    } catch (error) {
      console.error('处理Actor创建响应失败:', error);
    }
  } else if (event_type === 'sceneLoaded') {
    try {
      const data = JSON.parse(event_data);
      if (data.actors && Array.isArray(data.actors)) {
        sceneImages.value = data.actors.map(actor => ({
          name: actor.path.split('/').pop().split('.')[0], 
          path: actor.path,
          type: 'obj'
        }));
      }
    } catch (error) {
      console.error('处理场景加载响应失败:', error);
    }
  } else if (event_type === 'message'){
    print(event_data)
  }
};

const deleteActor = (scene) => {
  try {
    if (window.pyBridge && window.pyBridge.actorDelete) {
      window.pyBridge.actorDelete(currentSceneName.value,scene.name);
      // 删除关联的Dock窗口
      const widgetName = `Object_${scene.name}`;
      window.pyBridge.removeDockWidget(widgetName);
    }
    // 从场景列表中移除
    sceneImages.value = sceneImages.value.filter(item => item.name !== scene.name);
  } catch (error) {
    console.error('删除角色失败:', error);
  }
}

const DayNightCycle = () => {
  let currentTime = 0;
  const interval = setInterval(() => {
    if(currentTime === 1440){
      currentTime = 0;
    } else {
      currentTime++;
      const x = Math.cos(currentTime * Math.PI * 2 / 1440);
      const y = Math.sin(currentTime * Math.PI * 2 / 1440);
      const z = 0.0;
      
      px.value = x.toFixed(2);
      py.value = y.toFixed(2);
      pz.value = z.toFixed(2);
      
      if(window.pyBridge){
        window.pyBridge.sunDirection(JSON.stringify({
          px: x,
          py: y,
          pz: z
        }));
      }
    }
  }, 100); // Update every 100ms
  
  return () => clearInterval(interval);
};

//关闭浮动窗口
const closeFloat = () => {
  if (window.pyBridge) {
    window.pyBridge.removeDockWidget("SceneBar");
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
  currentSceneName.value = route.query.sceneName || 'scene1';
  document.addEventListener('mousemove', handleResizeMove);
  document.addEventListener('mouseup', handleResizeUp);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  window.pyBridge.sendMessageToDock("AITalkBar", JSON.stringify({"content": "Hello, World!"}));
  if (window.pyBridge) {
    window.pyBridge.dock_event.connect(handleDockEvent);
  };
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResizeMove);
  document.removeEventListener('mouseup', handleResizeUp);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  if (window.pyBridge) {
    window.pyBridge.dockEvent.disconnect(handleDockEvent);
  };
  document.removeEventListener('keydown', handleKeyDown);
});
</script>