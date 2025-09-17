<template>
  <div class="relative min-h-screen w-full bg-white/5" tabindex="0">
    <!-- 场景栏 -->
    <div class="w-full bg-[#4b6554]/90 border-b border-gray-200/65 h-12 relative">
      <div class="flex items-center space-x-1 px-2 overflow-x-auto scroll-smooth tab-container">
        <div 
          v-for="(tab, index) in tabs" 
          :key="index"
          class="px-4 py-2 cursor-pointer rounded-t-lg flex items-center gap-2" 
          :class="{
            'bg-white/65 border-b-2 border-blue-500': activeTab === index,
            'hover:bg-gray-200/65': activeTab !== index
          }" 
          @click="switchTab(index)" 
          @dblclick="openSceneBar(index)">
          <span
            class="max-w-[120px] truncate px-2 py-1 text-gray-700 select-none"
            >
            {{ tab.name }}
          </span>

        <button 
          v-if="tabs.length > 1" 
          @click.stop="closeTab(index)" 
          class="hover:bg-gray-300/50 rounded-full p-1">
          ×
        </button>
        </div>

        <button 
          @click="addNewTab" 
          class="px-4 py-2 text-xl font-bold hover:bg-gray-200/20 rounded-lg"
        >
          +
        </button>
      </div>
    </div>
    <!-- 自定义弹窗 -->
    <div
      v-if="showDialog"
      class="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black/50"
    >
      <div class="bg-gray-100/95 p-6 rounded shadow w-96 h-40 flex flex-col gap-4" >
        <div>
          <label
            for="new-tab-name"
            class="block text-sm font-medium text-gray-700"
          >
          添加场景
          </label>
          <input
            id="new-tab-name"
            v-model="inputState.newTabName"
            type="text"
            class="mt-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md w-full"
            ref="nameInput"
            @keyup.enter="confirmAddTab"
            autofocus
          />
        </div>
        <div class="flex justify-between">
          <button
            @click="confirmAddTab"
            class="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors 
                  duration-200 shadow-sm hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            创建场景
          </button>
          <button
            @click="cancelAddTab"
            class="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors 
                  duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import "@/assets/welcome-page.css";
import eventBus from '@/utils/eventBus';

const router = useRouter();

const goToHome = () => {
  if (window.pyBridge) {
    tabs.value.forEach(tab => {
      if (tab && tab.id) {
        window.pyBridge.removeDockWidget(tab.id);
      }
    });
    window.pyBridge.removeDockWidget("Pet");
    window.pyBridge.removeDockWidget("AITalkBar");
    window.pyBridge.removeDockWidget("Object");
    window.pyBridge.removeDockWidget("SceneBar");
    window.pyBridge.removeDockWidget("SetUp");
  }
  router.push('/');
};

const activeTab = ref(0);  // 当前激活的标签页

const cameraState = ref({
  position: [0.0, 5.0, 10.0],
  forward: [0.0, 1.5, 0.0],
  up: [0.0, -1.0, 0.0],
  fov: 45.0
});

// 标签页数据
const tabs = ref([
  { name: '场景1', id: 'scene1' },
]);

// 添加新标签页
const showDialog = ref(false);
const inputState = reactive({
  newTabName: '',
});

watch(showDialog, (newVal) => {
  if (newVal) {
    nextTick(() => {
      const input = document.getElementById('new-tab-name');
      if (input) {
        input.select();
      }
    });
  }
});

const addNewTab = () => {
  const sceneNumbers = tabs.value
  .map(tab => {
      const match = tab.name.match(/^场景(\d+)$/);
      return match ? parseInt(match[1]) : null
    })
    .filter(num => num !== null);
  
  const maxSceneNumber = sceneNumbers.length > 0 
    ? Math.max(...sceneNumbers) 
    : 0;
  
  inputState.newTabName = `场景${maxSceneNumber + 1}`;
  showDialog.value = true;
};

const confirmAddTab = () => {
  if (inputState.newTabName.trim()) {
    const maxSceneNumber = tabs.value.reduce((max, tab) => {
      const match = tab.name.match(/场景(\d+)/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);
    // 生成新场景名称
    const newTabName = `场景${maxSceneNumber + 1}`;
    const finalName = inputState.newTabName.trim() || newTabName;
    // 添加新标签页
    tabs.value.push({
      name: finalName,
      id: `scene${Date.now()}`,
      editing: false,
    });

    activeTab.value = tabs.value.length - 1;
    showDialog.value = false;
    inputState.newTabName = '';
  } else {
    alert('请输入标签名称');
  }
};

// 清空输入框
const cancelAddTab = () => {
  showDialog.value = false;
  inputState.newTabName = '';
};

const handleWheel = (event) => {
  const direction = event.deltaY > 0 ? 'backward' : 'forward';
  handleCameraMove(direction);
};

const handleKeyDown = (event) => {
  // 检查输入框是否聚焦
  const inputElement = document.getElementById('new-tab-name');
  if (inputElement && inputElement === document.activeElement) {
    return;
  }

  event.preventDefault();
  switch(event.key.toLowerCase()) {
    case 'w':
      handleCameraMove('up');
      break;
    case 's':
      handleCameraMove('down');
      break;
    case 'a':
      handleCameraMove('left');
      break;
    case 'd':
      handleCameraMove('right');
      break;
    case 'q':
      handleCameraMove('rotateLeft');
      break;
    case 'e':
      handleCameraMove('rotateRight');
      break;
    case 'escape':
      event.preventDefault();
      openSetup();
      break;
  }
};

const handleCameraMove = (direction) => {
  const speed = 0.2;
  const { position, forward } = cameraState.value;
  
  switch(direction) {
    case 'up':
      position[1] += speed;
      break;
    case 'down':
      position[1] -= speed;
      break;
    case 'left':
      position[0] -= speed;
      break;
    case 'right':
      position[0] += speed;
      break;
    case 'forward':
      position[2] -= speed;
      break;
    case 'backward':
      position[2] += speed;
      break;
    case 'rotateRight':
      const angleLeft = Math.PI / 180;
      const [x, z] = forward;
      forward[0] = x * Math.cos(angleLeft) - z * Math.sin(angleLeft);
      forward[2] = x * Math.sin(angleLeft) + z * Math.cos(angleLeft);
      break;
    case 'rotateLeft':
      const angleRight = -Math.PI / 180;
      const [x2, z2] = forward;
      forward[0] = x2 * Math.cos(angleRight) - z2 * Math.sin(angleRight);
      forward[2] = x2 * Math.sin(angleRight) + z2 * Math.cos(angleRight);
      break;
  }

  if (window.pyBridge) {
    window.pyBridge.cameraMove(JSON.stringify({
      sceneName: tabs.value[activeTab.value]?.id || 'scene1',
      position: [...position],
      forward: [...forward],
      up: [...cameraState.value.up],
      fov: cameraState.value.fov
    }));
  }
};
// 调用Esc
const openSetup = () => {
  if (window.pyBridge) {
    window.pyBridge.addDockWidget("SetUp", "/SetUp", "float", "center");
  }
}

// 关闭标签页
const closeTab = (index) => {
  if (tabs.value.length > 1) {
    const closedTab = tabs.value[index];
    if (window.pyBridge) {
      window.pyBridge.removeDockWidget("AITalkBar");
      window.pyBridge.removeDockWidget("Object");
      window.pyBridge.removeDockWidget("SceneBar");
    }

    tabs.value.splice(index, 1);
    if (activeTab.value >= index) {
      activeTab.value = Math.max(0, activeTab.value - 1);
    }
  }
};

// 切换标签页
const switchTab = (index) => {
  activeTab.value = index;
};

const handleReturnToWelcome = () => {
  if (window.pyBridge) {
    window.pyBridge.removeAllDockWidgets();
  }
  router.push('/');
};

// 控制包菜精显示
const cabbagetalk = () => {
  const size = { width: 160, height: 160};
  if (window.pyBridge) {
    window.pyBridge.addDockWidget("Pet", "/Pet", "float", "bottom_right", JSON.stringify(size));
  }
};

// 打开场景设置栏
const openSceneBar = (index) => {
  if (window.pyBridge) {
    const sceneName = tabs.value[index]?.id || 'scene1';
    window.pyBridge.addDockWidget("SceneBar", `/SceneBar?sceneName=${sceneName}`, "left");
  }
};

const Out = () => {
    if (window.pyBridge) {
        window.pyBridge.closeprocess();
    } else {
        console.error("Python SendMessageToDock 未连接！");
    }
}

const createScene = () => {
  if (window.pyBridge) {
    window.pyBridge.createScene(JSON.stringify({sceneName:"scene1"}));
  }
};

onMounted(() => {
  createScene();
  cabbagetalk();
  document.addEventListener('keydown', handleKeyDown);
});

// 在onUnmounted中移除事件监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>