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
        <!-- 场景列表 - 瀑布流布局 -->
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

const sceneImages = ref([]);

const isFloating = ref(false);
const route = useRoute();
const currentSceneName = ref('');
const px=ref('1.0'), py=ref('1.0'), pz=ref('1.0');


// 拖拽状态管理
const dragState = ref({
  isDragging: false,
  isResizing: false,
  resizeDirection: '',
  offsetX: 0,
  offsetY: 0,
  startWidth: 0,
  startHeight: 0,
  startX: 0,
  startY: 0,
  windowX: 0,
  windowY: 0
});

const startResize = (event, direction) => {
  if (event.button !== 0) return;

  dragState.value.isResizing = true;
  dragState.value.resizeDirection = direction;
  dragState.value.startWidth = event.currentTarget.parentElement.offsetWidth;
  dragState.value.startHeight = event.currentTarget.parentElement.offsetHeight;
  dragState.value.startX = event.clientX;
  dragState.value.startY = event.clientY;
  
  // 记录窗口当前位置
  const rect = event.currentTarget.parentElement.getBoundingClientRect();
  dragState.value.windowX = rect.left;
  dragState.value.windowY = rect.top;
  
  event.preventDefault();
};

const onResize = (event) => {
  if (!dragState.value.isResizing) return;

  const deltaX = event.clientX - dragState.value.startX;
  const deltaY = event.clientY - dragState.value.startY;
  
  let newWidth = dragState.value.startWidth;
  let newHeight = dragState.value.startHeight;
  let newX = dragState.value.windowX;
  let newY = dragState.value.windowY;

  switch(dragState.value.resizeDirection) {
    case 'n':
      newY = dragState.value.windowY - deltaY;
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
    case 's':
      newY = dragState.value.windowY + deltaY;
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
    case 'w':
      newX = dragState.value.windowX - deltaX;
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      break;
    case 'e':
      newX = dragState.value.windowX + deltaX;
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      break;
    case 'nw':
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      newX = dragState.value.windowX + deltaX;
      newY = dragState.value.windowY + deltaY;
      break;
    case 'ne':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      newHeight = Math.max(200, dragState.value.startHeight - deltaY);
      newY = dragState.value.windowY + deltaY;
      break;
    case 'sw':
      newWidth = Math.max(200, dragState.value.startWidth - deltaX);
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      newX = dragState.value.windowX + deltaX;
      break;
    case 'se':
      newWidth = Math.max(200, dragState.value.startWidth + deltaX);
      newHeight = Math.max(200, dragState.value.startHeight + deltaY);
      break;
  }

  // 检测是否拖到边界自动浮动
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const threshold = 50;
  
  if (newX < threshold || newX + newWidth > screenWidth - threshold ||
      newY < threshold || newY + newHeight > screenHeight - threshold) {
    if (!isFloating.value && window.pyBridge) {
      isFloating.value = true;
      window.pyBridge.forwardDockEvent('float', JSON.stringify({
        isFloating: true
      }));
    }
  }

  if (window.pyBridge) {
    window.pyBridge.forwardDockEvent('resize', JSON.stringify({
      width: newWidth,
      height: newHeight,
      x: newX,
      y: newY
    }));
  }
  event.preventDefault();
};

const stopResize = () => {
  dragState.value.isResizing = false;
};

const controlObject = (scene) => {
  if (window.pyBridge) {
    const widgetName = `Object_${scene.name}`;
    window.pyBridge.addDockWidget(widgetName, `/Object?sceneName=${currentSceneName.value}&objectName=${scene.name}&path=${encodeURIComponent(scene.path)}&routename=${widgetName}`, "right");
  }
};

const updateSunPosition = () => {
  if (window.pyBridge) {
    window.pyBridge.HandleSunDirection(JSON.stringify({
      sceneName: currentSceneName.value,
      px: parseFloat(px.value),
      py: parseFloat(py.value),
      pz: parseFloat(pz.value)
    }));
    console.error('updateSunDirection', px.value, py.value, pz.value); 
  } 
}

const saveScene = () => {
  if (window.pyBridge && window.pyBridge.HandleSceneSave) {
    const sceneData = {
      actors: sceneImages.value.map(scene => ({
        name: scene.name,
        path: scene.path,
        type: scene.type
      }))
    };
    window.pyBridge.HandleSceneSave(JSON.stringify(sceneData));
  }
};

const handleFileImport = () => {
  if (window.pyBridge && window.pyBridge.openFileDialog) {
    window.pyBridge.openFileDialog(currentSceneName.value);
  }
};

const handleSceneImport = () => {
  if (window.pyBridge && window.pyBridge.openSceneDialog) {
    window.pyBridge.openSceneDialog(currentSceneName.value);
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
    if (window.pyBridge && window.pyBridge.HandleActorDelete) {
      window.pyBridge.HandleActorDelete(currentSceneName.value,scene.name);
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
        window.pyBridge.HandleSunDirection(JSON.stringify({
          px: x,
          py: y,
          pz: z
        }));
      }
    }
  }, 100); // Update every 100ms
  
  return () => clearInterval(interval);
};

const startDrag = (event) => {
  if (event.button !== 0) return;
  dragState.value.isDragging = true;
  dragState.value.startX = event.clientX;
  dragState.value.startY = event.clientY;
  
  // 移除获取位置的代码
  event.currentTarget.classList.add('bg-[#7BA590]/80');
  event.preventDefault();
};

// 拖动中
const onDrag = (event) => {
  if (!dragState.value.isDragging) return;
  
  const deltaX = event.clientX - dragState.value.startX;
  const deltaY = event.clientY - dragState.value.startY;
  
  if (window.pyBridge) {
    window.pyBridge.forwardDockEvent('drag', JSON.stringify({
      deltaX,
      deltaY
    }));
  }
  
  dragState.value.startX = event.clientX;
  dragState.value.startY = event.clientY;
  event.preventDefault();
};

// 停止拖动
const stopDrag = (event) => {
  if (!dragState.value.isDragging) return;

  dragState.value.isDragging = false;
  dragState.value.startX = 0;
  dragState.value.startY = 0;

  event.currentTarget.classList.remove('bg-[#7BA590]/80');
  event.preventDefault();
};

// 浮动和缩放相关


//关闭浮动窗口
const closeFloat = () => {
  if (window.pyBridge) {
    window.pyBridge.removeDockWidget(currentSceneName.value);
  }
};

onMounted(() => {
  currentSceneName.value = route.query.sceneName || 'scene1';
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  window.pyBridge.send_message_to_dock("AITalkBar", JSON.stringify({"content": "Hello, World!"}));
  if (window.pyBridge) {
    window.pyBridge.dock_event.connect(handleDockEvent);
  }
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
});

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  if (window.pyBridge) {
    window.pyBridge.dockEvent.disconnect(handleDockEvent);
  }
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
});
</script>